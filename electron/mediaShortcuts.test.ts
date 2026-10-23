import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn(),
  },
}));

import {
  MediaShortcutsController,
  type GlobalShortcutApi,
} from "./mediaShortcuts";
import type { SmtcMediaAction } from "./preload";

describe("MediaShortcutsController", () => {
  let mockShortcuts: Map<string, () => void>;
  let mockShortcutApi: GlobalShortcutApi;
  let sentActions: SmtcMediaAction[];
  let fakeWindow: any;

  beforeEach(() => {
    mockShortcuts = new Map();
    sentActions = [];

    mockShortcutApi = {
      register: vi.fn((acc: string, cb: () => void) => {
        mockShortcuts.set(acc, cb);
        return true;
      }),
      unregister: vi.fn((acc: string) => {
        mockShortcuts.delete(acc);
      }),
      unregisterAll: vi.fn(() => {
        mockShortcuts.clear();
      }),
      isRegistered: vi.fn((acc: string) => mockShortcuts.has(acc)),
    };

    fakeWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        isDestroyed: vi.fn(() => false),
        send: vi.fn(),
      },
    };
  });

  it("registers default media shortcuts (MediaPlayPause, MediaNextTrack, MediaPreviousTrack, MediaStop)", () => {
    const controller = new MediaShortcutsController(
      () => fakeWindow,
      (action) => sentActions.push(action),
      mockShortcutApi,
    );

    const ok = controller.register();
    expect(ok).toBe(true);

    expect(controller.isRegistered("MediaPlayPause")).toBe(true);
    expect(controller.isRegistered("MediaNextTrack")).toBe(true);
    expect(controller.isRegistered("MediaPreviousTrack")).toBe(true);
    expect(controller.isRegistered("MediaStop")).toBe(true);
    expect(mockShortcutApi.register).toHaveBeenCalledTimes(4);
  });

  it("routes hardware key callbacks to sendAction when callback provided", () => {
    const controller = new MediaShortcutsController(
      () => fakeWindow,
      (action) => sentActions.push(action),
      mockShortcutApi,
    );
    controller.register();

    // Trigger MediaPlayPause callback
    const playPauseCb = mockShortcuts.get("MediaPlayPause");
    expect(playPauseCb).toBeDefined();
    playPauseCb!();
    expect(sentActions).toEqual(["togglePlay"]);
    expect(fakeWindow.webContents.send).not.toHaveBeenCalled();

    // Trigger MediaNextTrack callback
    const nextCb = mockShortcuts.get("MediaNextTrack");
    nextCb!();
    expect(sentActions).toEqual(["togglePlay", "next"]);
    expect(fakeWindow.webContents.send).not.toHaveBeenCalled();

    // Trigger MediaPreviousTrack callback
    const prevCb = mockShortcuts.get("MediaPreviousTrack");
    prevCb!();
    expect(sentActions).toEqual(["togglePlay", "next", "prev"]);
    expect(fakeWindow.webContents.send).not.toHaveBeenCalled();

    // Trigger MediaStop callback
    const stopCb = mockShortcuts.get("MediaStop");
    stopCb!();
    expect(sentActions).toEqual(["togglePlay", "next", "prev", "stop"]);
    expect(fakeWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("routes hardware key callbacks to IPC channel desktop:media-action when only getWindow provided", () => {
    const controller = new MediaShortcutsController(
      () => fakeWindow,
      undefined,
      mockShortcutApi,
    );
    controller.register();

    // Trigger MediaPlayPause callback
    const playPauseCb = mockShortcuts.get("MediaPlayPause");
    expect(playPauseCb).toBeDefined();
    playPauseCb!();
    expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(1);
    expect(fakeWindow.webContents.send).toHaveBeenCalledWith("desktop:media-action", "togglePlay");

    // Trigger MediaNextTrack callback
    const nextCb = mockShortcuts.get("MediaNextTrack");
    nextCb!();
    expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(2);
    expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith("desktop:media-action", "next");

    // Trigger MediaPreviousTrack callback
    const prevCb = mockShortcuts.get("MediaPreviousTrack");
    prevCb!();
    expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(3);
    expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith("desktop:media-action", "prev");

    // Trigger MediaStop callback
    const stopCb = mockShortcuts.get("MediaStop");
    stopCb!();
    expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(4);
    expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith("desktop:media-action", "stop");
  });

  it("handles registration collisions gracefully when shortcut is blocked (R3-C5)", () => {
    (mockShortcutApi.register as any).mockImplementation((acc: string) => {
      if (acc === "MediaPlayPause") return false;
      return true;
    });

    const controller = new MediaShortcutsController(
      () => fakeWindow,
      (action) => sentActions.push(action),
      mockShortcutApi,
    );

    const result = controller.register();
    expect(result).toBe(false);
    expect(controller.isRegistered("MediaPlayPause")).toBe(false);
    expect(controller.isRegistered("MediaNextTrack")).toBe(true);
  });

  it("handles exceptions thrown by globalShortcut.register without crashing", () => {
    (mockShortcutApi.register as any).mockImplementation((acc: string) => {
      if (acc === "MediaPlayPause") {
        throw new Error("System shortcut lock violation");
      }
      return true;
    });

    const controller = new MediaShortcutsController(
      () => fakeWindow,
      (action) => sentActions.push(action),
      mockShortcutApi,
    );

    expect(() => controller.register()).not.toThrow();
    expect(controller.isRegistered("MediaPlayPause")).toBe(false);
    expect(controller.isRegistered("MediaNextTrack")).toBe(true);
  });

  it("unregisters specific shortcuts and unregisters all on teardown", () => {
    const controller = new MediaShortcutsController(
      () => fakeWindow,
      (action) => sentActions.push(action),
      mockShortcutApi,
    );
    controller.register();

    controller.unregister("MediaPlayPause");
    expect(controller.isRegistered("MediaPlayPause")).toBe(false);
    expect(mockShortcutApi.unregister).toHaveBeenCalledWith("MediaPlayPause");

    controller.unregisterAll();
    expect(controller.isRegistered("MediaNextTrack")).toBe(false);
    expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
    expect(controller.isRegistered("MediaStop")).toBe(false);
  });

  it("supports options object constructor pattern", () => {
    const controller = new MediaShortcutsController({
      getWindow: () => fakeWindow,
      sendAction: (action) => sentActions.push(action),
      shortcutApi: mockShortcutApi,
    });

    controller.register();
    expect(controller.isRegistered("MediaPlayPause")).toBe(true);

    controller.destroy();
    expect(controller.isRegistered("MediaPlayPause")).toBe(false);
  });

  describe("accelerator parameter validation & edge cases", () => {
    it("returns false and does not register shortcuts when accelerator is an empty string", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      const result = controller.register("");
      expect(result).toBe(false);
      expect(mockShortcutApi.register).not.toHaveBeenCalled();
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
    });

    it("returns false and does not register shortcuts when accelerator is whitespace only", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      const result = controller.register("   \t\n  ");
      expect(result).toBe(false);
      expect(mockShortcutApi.register).not.toHaveBeenCalled();
    });

    it("returns false when accelerator is unknown or unsupported", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      expect(controller.register("VolumeUp")).toBe(false);
      expect(controller.register("Ctrl+Alt+Delete")).toBe(false);
      expect(mockShortcutApi.register).not.toHaveBeenCalled();
    });

    it("registers single shortcut with leading/trailing whitespace trimmed", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      const result = controller.register("  MediaPlayPause  ");
      expect(result).toBe(true);
      expect(controller.isRegistered("MediaPlayPause")).toBe(true);
      expect(controller.isRegistered("  MediaPlayPause  ")).toBe(true);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(mockShortcutApi.register).toHaveBeenCalledTimes(1);
      expect(mockShortcutApi.register).toHaveBeenCalledWith("MediaPlayPause", expect.any(Function));
    });

    it("returns false safely when passed non-string or null parameters", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      expect(controller.register(null as any)).toBe(false);
      expect(controller.register(123 as any)).toBe(false);
      expect(controller.register({} as any)).toBe(false);
      expect(mockShortcutApi.register).not.toHaveBeenCalled();
    });

    it("handles edge cases in unregister and isRegistered cleanly", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      controller.register("MediaPlayPause");
      expect(controller.isRegistered("MediaPlayPause")).toBe(true);

      // Empty string, whitespace, unknown keys, or null should not throw or affect registered keys
      expect(controller.isRegistered("")).toBe(false);
      expect(controller.isRegistered("   ")).toBe(false);
      expect(controller.isRegistered("UnknownKey")).toBe(false);
      expect(controller.isRegistered(null as any)).toBe(false);

      expect(() => controller.unregister("")).not.toThrow();
      expect(() => controller.unregister("   ")).not.toThrow();
      expect(() => controller.unregister("UnknownKey")).not.toThrow();
      expect(() => controller.unregister(null as any)).not.toThrow();

      expect(controller.isRegistered("MediaPlayPause")).toBe(true);

      // Unregister with trimmed string
      controller.unregister("  MediaPlayPause  ");
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(mockShortcutApi.unregister).toHaveBeenCalledWith("MediaPlayPause");
    });
  });
});
