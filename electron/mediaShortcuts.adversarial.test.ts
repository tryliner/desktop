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
  type MediaShortcutKey,
  MEDIA_SHORTCUT_ACTION_MAP,
} from "./mediaShortcuts";
import type { SmtcMediaAction } from "./preload";

describe("Adversarial Stress Test: MediaShortcutsController", () => {
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

  // =========================================================================
  // 1. Full Collision Simulation
  // =========================================================================
  describe("1. Full Collision Simulation", () => {
    it("simulates Spotify holding MediaPlayPause (returns false); other keys register and dispatch cleanly", () => {
      (mockShortcutApi.register as any).mockImplementation((acc: string, cb: () => void) => {
        if (acc === "MediaPlayPause") return false;
        mockShortcuts.set(acc, cb);
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
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(true);
      expect(controller.isRegistered("MediaStop")).toBe(true);

      // Verify remaining keys still dispatch their actions
      mockShortcuts.get("MediaNextTrack")!();
      expect(sentActions).toEqual(["next"]);

      mockShortcuts.get("MediaPreviousTrack")!();
      expect(sentActions).toEqual(["next", "prev"]);

      mockShortcuts.get("MediaStop")!();
      expect(sentActions).toEqual(["next", "prev", "stop"]);
    });

    it("simulates Chrome holding MediaNextTrack (throws Error); controller does not rethrow and registers others", () => {
      (mockShortcutApi.register as any).mockImplementation((acc: string, cb: () => void) => {
        if (acc === "MediaNextTrack") {
          throw new Error("ACCELERATOR_ALREADY_BOUND: Chrome locked MediaNextTrack");
        }
        mockShortcuts.set(acc, cb);
        return true;
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      let result: boolean | undefined;
      expect(() => {
        result = controller.register();
      }).not.toThrow();

      expect(result).toBe(false);
      expect(controller.isRegistered("MediaPlayPause")).toBe(true);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(true);
      expect(controller.isRegistered("MediaStop")).toBe(true);
    });

    it("simulates multi-application collision: Spotify false, Chrome throws, System throws; only MediaStop succeeds", () => {
      (mockShortcutApi.register as any).mockImplementation((acc: string, cb: () => void) => {
        if (acc === "MediaPlayPause") return false;
        if (acc === "MediaNextTrack") throw new Error("Chrome lock");
        if (acc === "MediaPreviousTrack") throw new TypeError("OS shortcut permission denied");
        if (acc === "MediaStop") {
          mockShortcuts.set(acc, cb);
          return true;
        }
        return false;
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      const result = controller.register();
      expect(result).toBe(false);
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
      expect(controller.isRegistered("MediaStop")).toBe(true);

      mockShortcuts.get("MediaStop")!();
      expect(sentActions).toEqual(["stop"]);
    });

    it("simulates total collision: all 4 keys return false or throw; register returns false without unhandled error", () => {
      (mockShortcutApi.register as any).mockImplementation((acc: string) => {
        if (acc === "MediaPlayPause" || acc === "MediaStop") return false;
        throw new Error(`Total collision on ${acc}`);
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      expect(() => controller.register()).not.toThrow();
      expect(controller.register()).toBe(false);
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
      expect(controller.isRegistered("MediaStop")).toBe(false);
    });

    it("handles invalid accelerator string gracefully when registered individually", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      // Unknown key name not in MEDIA_SHORTCUT_ACTION_MAP returns false without throwing
      expect(controller.register("InvalidKeyName" as any)).toBe(false);
      // Empty string returns false without registering all shortcuts
      expect(controller.register("" as any)).toBe(false);
      expect(mockShortcutApi.register).toHaveBeenCalledTimes(0);
    });
  });

  // =========================================================================
  // 2. Repeated register/unregister lifecycle & listener leaks
  // =========================================================================
  describe("2. Repeated Lifecycle & Listener Leak Stress Testing", () => {
    it("runs 20x re-registration loops without unregistering; unregisters prior shortcuts on each pass to prevent leak", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      for (let i = 0; i < 20; i++) {
        const ok = controller.register();
        expect(ok).toBe(true);
      }

      // 4 keys * 20 cycles = 80 registrations
      expect(mockShortcutApi.register).toHaveBeenCalledTimes(80);
      // Because registerKey calls unregister(key) first for currently registered keys:
      // Loop 0: 0 unregisters (none previously registered)
      // Loops 1-19: 4 keys * 19 loops = 76 unregistrations
      expect(mockShortcutApi.unregister).toHaveBeenCalledTimes(76);

      // Verify that triggering the final callback triggers exactly 1 dispatch to callback and 0 to window (mutual exclusivity)
      mockShortcuts.get("MediaPlayPause")!();
      expect(sentActions).toEqual(["togglePlay"]);
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(0);
    });

    it("runs 20x register -> unregisterAll -> re-register cycles cleanly", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );

      for (let i = 0; i < 20; i++) {
        controller.register();
        expect(controller.isRegistered("MediaPlayPause")).toBe(true);
        expect(controller.isRegistered("MediaNextTrack")).toBe(true);
        expect(controller.isRegistered("MediaPreviousTrack")).toBe(true);
        expect(controller.isRegistered("MediaStop")).toBe(true);

        controller.unregisterAll();
        expect(controller.isRegistered("MediaPlayPause")).toBe(false);
        expect(controller.isRegistered("MediaNextTrack")).toBe(false);
        expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
        expect(controller.isRegistered("MediaStop")).toBe(false);
      }

      // Re-register once more and test dispatch
      controller.register();
      mockShortcuts.get("MediaNextTrack")!();
      expect(sentActions).toEqual(["next"]);
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(0);
    });

    it("verifies single event dispatching when initialized as in electron/main.ts", () => {
      // In electron/main.ts: mediaShortcuts = new MediaShortcutsController(() => mainWindow);
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );
      controller.register();

      // Trigger shortcut
      mockShortcuts.get("MediaPlayPause")!();

      // Verify single IPC call
      const sendCalls = fakeWindow.webContents.send.mock.calls;
      expect(sendCalls.length).toBe(1);
      expect(sendCalls[0]).toEqual(["desktop:media-action", "togglePlay"]);
    });

    it("calls sendActionCallback OR win.webContents.send, NOT both when both are provided", () => {
      const customSendAction = vi.fn();
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        customSendAction,
        mockShortcutApi,
      );
      controller.register();

      mockShortcuts.get("MediaPlayPause")!();

      // sendActionCallback must be invoked exactly once
      expect(customSendAction).toHaveBeenCalledTimes(1);
      expect(customSendAction).toHaveBeenCalledWith("togglePlay");

      // win.webContents.send must NOT be called directly by MediaShortcutsController
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(0);
    });

    it("calls win.webContents.send exactly once when instantiated with only getWindow", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );
      controller.register();

      mockShortcuts.get("MediaPlayPause")!();
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(1);
      expect(fakeWindow.webContents.send).toHaveBeenCalledWith("desktop:media-action", "togglePlay");

      mockShortcuts.get("MediaNextTrack")!();
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(2);
      expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith("desktop:media-action", "next");

      mockShortcuts.get("MediaPreviousTrack")!();
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(3);
      expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith("desktop:media-action", "prev");

      mockShortcuts.get("MediaStop")!();
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(4);
      expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith("desktop:media-action", "stop");
    });
  });

  // =========================================================================
  // 3. Destroy and null window safety
  // =========================================================================
  describe("3. Destroy and Null Window Boundary Handling", () => {
    it("handles null window safely without throwing or unhandled rejections", () => {
      const controller = new MediaShortcutsController(
        () => null,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      expect(() => {
        mockShortcuts.get("MediaPlayPause")!();
      }).not.toThrow();

      expect(sentActions).toEqual(["togglePlay"]);
    });

    it("handles destroyed window (isDestroyed === true) without calling webContents.send", () => {
      fakeWindow.isDestroyed.mockReturnValue(true);

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      expect(() => {
        mockShortcuts.get("MediaPlayPause")!();
      }).not.toThrow();

      expect(fakeWindow.webContents.send).not.toHaveBeenCalled();
      expect(sentActions).toEqual(["togglePlay"]);
    });

    it("handles destroyed webContents (webContents.isDestroyed === true) safely", () => {
      fakeWindow.webContents.isDestroyed.mockReturnValue(true);

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      expect(() => {
        mockShortcuts.get("MediaNextTrack")!();
      }).not.toThrow();

      expect(fakeWindow.webContents.send).not.toHaveBeenCalled();
      expect(sentActions).toEqual(["next"]);
    });

    it("handles null webContents safely without throwing", () => {
      fakeWindow.webContents = null;

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      expect(() => {
        mockShortcuts.get("MediaPreviousTrack")!();
      }).not.toThrow();

      expect(sentActions).toEqual(["prev"]);
    });

    it("handles webContents.send throwing 'Object has been destroyed' without crashing", () => {
      fakeWindow.webContents.send.mockImplementation(() => {
        throw new Error("Object has been destroyed");
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      expect(() => {
        mockShortcuts.get("MediaStop")!();
      }).not.toThrow();

      expect(sentActions).toEqual(["stop"]);
    });

    it("handles sendAction callback throwing an unexpected error without crashing and without fallback leak", () => {
      const crashingSendAction = vi.fn(() => {
        throw new Error("Unexpected crash inside sendAction consumer");
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        crashingSendAction,
        mockShortcutApi,
      );
      controller.register();

      expect(() => {
        mockShortcuts.get("MediaPlayPause")!();
      }).not.toThrow();

      expect(crashingSendAction).toHaveBeenCalledTimes(1);
      expect(fakeWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Teardown Verification
  // =========================================================================
  describe("4. Teardown Verification", () => {
    it("unregisterAll() empties registry completely", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      expect(controller.isRegistered("MediaPlayPause")).toBe(true);
      expect(controller.isRegistered("MediaNextTrack")).toBe(true);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(true);
      expect(controller.isRegistered("MediaStop")).toBe(true);

      controller.unregisterAll();

      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
      expect(controller.isRegistered("MediaStop")).toBe(false);
      expect(mockShortcutApi.unregister).toHaveBeenCalledTimes(4);
    });

    it("handles exceptions during unregisterAll() gracefully and continues unregistering remaining keys", () => {
      (mockShortcutApi.unregister as any).mockImplementation((acc: string) => {
        if (acc === "MediaPlayPause") {
          throw new Error("Failed to unregister MediaPlayPause");
        }
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      expect(() => controller.unregisterAll()).not.toThrow();
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
      expect(controller.isRegistered("MediaStop")).toBe(false);
    });

    it("calling destroy() delegates to unregisterAll() and is idempotent", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        (action) => sentActions.push(action),
        mockShortcutApi,
      );
      controller.register();

      controller.destroy();
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);

      // Calling destroy() a second time on an already destroyed controller
      expect(() => controller.destroy()).not.toThrow();
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
    });
  });
});
