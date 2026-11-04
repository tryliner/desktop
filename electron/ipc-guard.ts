import {
  ipcMain,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from "electron";

export function isAppUrl(
  url: string | undefined,
  devServerUrl = process.env.VITE_DEV_SERVER_URL,
): boolean {
  if (!url) return false;
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  if (!devServerUrl) return target.protocol === "file:";
  try {
    return target.origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}

export function isTrustedSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
): boolean {
  return isAppUrl(event.senderFrame?.url);
}

export function handleTrusted(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event))
      throw new Error(`untrusted sender for ${channel}`);
    return handler(event, ...args);
  });
}

export function onTrusted(
  channel: string,
  listener: (event: IpcMainEvent, ...args: any[]) => void,
): void {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      event.returnValue = null;
      return;
    }
    listener(event, ...args);
  });
}

function openIfWeb(url: string): void {
  if (url.startsWith("https:") || url.startsWith("http:"))
    void shell.openExternal(url);
}

export function confineToApp(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    openIfWeb(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openIfWeb(url);
  });
  contents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
}
