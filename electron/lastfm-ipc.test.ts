// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";

vi.mock("electron", () => ({
  app: {},
  ipcMain: {},
  net: {},
  safeStorage: {},
  shell: {},
}));
import { isLastfmSender } from "./lastfm-ipc";

describe("Last.fm IPC sender authorization", () => {
  it("accepts only the primary frame of the main application window", () => {
    const mainFrame = {};
    const webContents = { mainFrame };
    const window = {
      isDestroyed: () => false,
      webContents,
    } as unknown as BrowserWindow;
    const sender = (contents: unknown, frame: unknown) =>
      ({ sender: contents, senderFrame: frame }) as IpcMainInvokeEvent;
    expect(isLastfmSender(sender(webContents, mainFrame), window)).toBe(true);
    expect(isLastfmSender(sender(webContents, {}), window)).toBe(false);
    expect(isLastfmSender(sender({}, mainFrame), window)).toBe(false);
    expect(isLastfmSender(sender(webContents, mainFrame), null)).toBe(false);
    expect(
      isLastfmSender(sender(webContents, mainFrame), {
        ...window,
        isDestroyed: () => true,
      } as BrowserWindow),
    ).toBe(false);
  });
});
