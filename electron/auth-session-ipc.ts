import { app, BrowserWindow, ipcMain, net, safeStorage, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { AuthSessionStore } from "./auth-session-store.js";
import { signRequest, syncServerTime } from "./crypto.js";

function signedRequestHeaders(method: string, path: string, body: string): Record<string, string> {
  try {
    const signed = signRequest({ method, path, body });
    return {
      "x-liner-signature": signed.signature,
      "x-liner-timestamp": String(signed.timestamp),
      "x-liner-nonce": signed.nonce,
    };
  } catch (err) {
    console.error("\x1b[41;37m signer \x1b[0m auth refresh signing failed:", err);
    return {};
  }
}

function isAppUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("file:")) return true;
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (!devServer) return false;
  try {
    return new URL(url).origin === new URL(devServer).origin;
  } catch {
    return false;
  }
}

function fromApp(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return isAppUrl(event.senderFrame?.url);
}

export function registerAuthSessionIpc(): AuthSessionStore {
  const store = new AuthSessionStore(
    path.join(app.getPath("userData"), "auth", "session.json"),
    {
      available: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (data) => safeStorage.decryptString(data),
    },
    {
      fetch: (url, init) => net.fetch(url, init),
      syncClock: (dateHeader) => {
        syncServerTime(dateHeader);
      },
      signHeaders: signedRequestHeaders,
    },
  );

  store.onChange((session, origin) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      const contents = win.webContents;
      if (contents.id === origin || !isAppUrl(contents.getURL())) continue;
      contents.send("auth:session-changed", session);
    }
  });

  ipcMain.on("auth:get-session", (event) => {
    event.returnValue = fromApp(event) ? store.get() : null;
  });

  ipcMain.handle("auth:set-session", (event, next: unknown) => {
    if (!fromApp(event)) return null;
    return store.set(next, event.sender.id);
  });

  ipcMain.handle(
    "auth:refresh",
    (event, input: { apiBaseUrl?: unknown; refreshToken?: unknown } | undefined) => {
      if (!fromApp(event)) return { outcome: "no_session", session: null };
      const apiBaseUrl = typeof input?.apiBaseUrl === "string" ? input.apiBaseUrl : "";
      const refreshToken = typeof input?.refreshToken === "string" ? input.refreshToken : undefined;
      return store.refresh(apiBaseUrl, refreshToken, event.sender.id);
    },
  );

  return store;
}
