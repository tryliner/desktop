import {
  app,
  ipcMain,
  net,
  safeStorage,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import type { AuthSessionStore } from "./auth-session-store";
import { LastfmApi, validCredentials } from "./lastfm-api";
import { LastfmService } from "./lastfm-service";
import { LastfmStore } from "./lastfm-store";

declare const __LASTFM_CREDENTIALS__: { apiKey: string; secret: string };

export function isLastfmSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
  window: BrowserWindow | null,
): boolean {
  return Boolean(
    window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame,
  );
}

export function registerLastfmIpc(
  auth: AuthSessionStore,
  getWindow: () => BrowserWindow | null,
): LastfmService {
  const secure = () =>
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" ||
      safeStorage.getSelectedStorageBackend() !== "basic_text");
  const store = new LastfmStore(path.join(app.getPath("userData"), "lastfm"), {
    available: secure,
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (data) => safeStorage.decryptString(data),
  });
  const buildCredentials =
    typeof __LASTFM_CREDENTIALS__ === "undefined"
      ? undefined
      : __LASTFM_CREDENTIALS__;
  const service = new LastfmService({
    api: new LastfmApi((url, init) =>
      net.fetch(url instanceof URL ? url.toString() : url, init),
    ),
    credentials: validCredentials(buildCredentials)
      ? buildCredentials
      : undefined,
    load: (owner) => store.load(owner),
    save: (owner, data) => store.save(owner, data),
    secure,
    openBrowser: (url) => shell.openExternal(url),
    changed: (status) => {
      const win = getWindow();
      if (win && !win.isDestroyed())
        win.webContents.send("lastfm:changed", status);
    },
  });
  const updateOwner = () => {
    const user = auth.get()?.user as { id?: unknown } | undefined;
    service.setOwner(typeof user?.id === "string" && user.id ? user.id : null);
  };
  updateOwner();
  const unsubscribe = auth.onChange(updateOwner);
  const handlers = {
    status: () => service.status(),
    connect: (input: unknown) =>
      service.connect(input as Parameters<LastfmService["connect"]>[0]),
    finish: () => service.finish(),
    cancel: () => service.cancel(),
    disconnect: () => service.disconnect(),
    settings: (input: unknown) =>
      service.settings(input as Parameters<LastfmService["settings"]>[0]),
    retry: () => service.retry(),
    scrobble: (input: unknown) =>
      service.enqueue(input as Parameters<LastfmService["enqueue"]>[0]),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    ipcMain.handle(`lastfm:${action}`, (event, input: unknown) => {
      if (!isLastfmSender(event, getWindow()))
        throw new Error("Unauthorized Last.fm request.");
      return handler(input);
    });
  }
  ipcMain.on("lastfm:now-playing", (event, input: unknown) => {
    if (isLastfmSender(event, getWindow()))
      void service.updateNowPlaying(
        input as Parameters<LastfmService["updateNowPlaying"]>[0],
      );
  });
  app.once("before-quit", () => {
    unsubscribe();
    service.destroy();
  });
  return service;
}
