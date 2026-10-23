import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MediaShortcutsController,
  type GlobalShortcutApi,
  MEDIA_SHORTCUT_ACTION_MAP,
  type MediaShortcutKey,
} from "../../electron/mediaShortcuts";

describe("Empirical Challenger: MediaShortcuts Boundary & Collision Harness", () => {
  let mockShortcuts: Map<string, () => void>;
  let mockShortcutApi: GlobalShortcutApi;
  let fakeWindow: any;

  beforeEach(() => {
    mockShortcuts = new Map();
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
  // 1. Single Dispatch Guarantee under electron/main.ts configuration
  // =========================================================================
  describe("1. Single Dispatch Guarantee (main.ts initialization pattern)", () => {
    it("verifies hardware key triggers invoke fakeWindow.webContents.send EXACTLY ONCE per trigger", () => {
      // Configuration strictly matching electron/main.ts line 439
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );
      const registered = controller.register();
      expect(registered).toBe(true);

      // Verify all 4 hardware keys trigger EXACTLY ONCE each
      const keys: MediaShortcutKey[] = [
        "MediaPlayPause",
        "MediaNextTrack",
        "MediaPreviousTrack",
        "MediaStop",
      ];

      let expectedCallCount = 0;
      for (const key of keys) {
        const action = MEDIA_SHORTCUT_ACTION_MAP[key];
        const trigger = mockShortcuts.get(key);
        expect(trigger).toBeDefined();

        // Fire key once
        trigger!();
        expectedCallCount++;

        expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(expectedCallCount);
        expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith(
          "desktop:media-action",
          action,
        );
      }

      // Fire MediaPlayPause 5 additional times -> must result in exactly 5 additional calls
      for (let i = 0; i < 5; i++) {
        mockShortcuts.get("MediaPlayPause")!();
        expectedCallCount++;
        expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(expectedCallCount);
        expect(fakeWindow.webContents.send).toHaveBeenLastCalledWith(
          "desktop:media-action",
          "togglePlay",
        );
      }
    });

    it("options object constructor with only getWindow preserves single dispatch", () => {
      const controller = new MediaShortcutsController({
        getWindow: () => fakeWindow,
        shortcutApi: mockShortcutApi,
      });
      controller.register();

      mockShortcuts.get("MediaPlayPause")!();
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(1);
      expect(fakeWindow.webContents.send).toHaveBeenCalledWith(
        "desktop:media-action",
        "togglePlay",
      );
    });
  });

  // =========================================================================
  // 2. Accelerator Parameter Validation & Boundary Edge Cases
  // =========================================================================
  describe("2. Accelerator Parameter Validation & Boundary Edge Cases", () => {
    it("empty string accelerator register('') returns false and registers 0 keys", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      const result = controller.register("");
      expect(result).toBe(false);
      expect(mockShortcutApi.register).toHaveBeenCalledTimes(0);
      expect(mockShortcuts.size).toBe(0);
      expect(controller.isRegistered("")).toBe(false);
    });

    it("whitespace-only accelerators return false and register 0 keys", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      const invalidInputs = [" ", "   ", "\t", "\n", "\r\n  \t "];
      for (const input of invalidInputs) {
        const result = controller.register(input as any);
        expect(result).toBe(false);
        expect(mockShortcutApi.register).toHaveBeenCalledTimes(0);
        expect(controller.isRegistered(input)).toBe(false);
      }
    });

    it("non-string accelerators safely return false and register 0 keys", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      const weirdInputs = [null, 0, 123, false, true, {}, [], Symbol("acc")];
      for (const input of weirdInputs) {
        const result = controller.register(input as any);
        expect(result).toBe(false);
        expect(mockShortcutApi.register).toHaveBeenCalledTimes(0);
      }
    });

    it("unregister and isRegistered handle invalid and whitespace inputs safely", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      expect(() => {
        controller.unregister("");
        controller.unregister("   ");
        controller.unregister(null as any);
        controller.unregister(undefined as any);
      }).not.toThrow();

      expect(controller.isRegistered("")).toBe(false);
      expect(controller.isRegistered("   ")).toBe(false);
      expect(controller.isRegistered(null as any)).toBe(false);
      expect(controller.isRegistered(undefined as any)).toBe(false);
    });

    it("unsupported accelerator name returns false without registering", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      const result = controller.register("VolumeUp" as any);
      expect(result).toBe(false);
      expect(mockShortcutApi.register).toHaveBeenCalledTimes(0);
    });

    it("trimmed valid accelerator succeeds", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      const result = controller.register("  MediaPlayPause  " as any);
      expect(result).toBe(true);
      expect(mockShortcutApi.register).toHaveBeenCalledTimes(1);
      expect(controller.isRegistered("MediaPlayPause")).toBe(true);
      expect(controller.isRegistered("  MediaPlayPause  ")).toBe(true);
    });
  });

  // =========================================================================
  // 3. Mutual Exclusivity Guarantees
  // =========================================================================
  describe("3. Mutual Exclusivity Guarantees", () => {
    it("when sendAction callback is provided, window.webContents.send is NOT called (0 times)", () => {
      const mockSendAction = vi.fn();
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        mockSendAction,
        mockShortcutApi,
      );
      controller.register();

      // Trigger all 4 keys
      const keys: MediaShortcutKey[] = [
        "MediaPlayPause",
        "MediaNextTrack",
        "MediaPreviousTrack",
        "MediaStop",
      ];

      for (const key of keys) {
        mockShortcuts.get(key)!();
      }

      // Callback received all 4 actions
      expect(mockSendAction).toHaveBeenCalledTimes(4);
      expect(mockSendAction).toHaveBeenNthCalledWith(1, "togglePlay");
      expect(mockSendAction).toHaveBeenNthCalledWith(2, "next");
      expect(mockSendAction).toHaveBeenNthCalledWith(3, "prev");
      expect(mockSendAction).toHaveBeenNthCalledWith(4, "stop");

      // fakeWindow.webContents.send MUST NOT have been called even once
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(0);
    });

    it("when sendAction throws an error, mutual exclusivity holds and window is NOT called as fallback", () => {
      const faultySendAction = vi.fn(() => {
        throw new Error("Consumer exploded");
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        faultySendAction,
        mockShortcutApi,
      );
      controller.register();

      // Trigger should not crash app
      expect(() => {
        mockShortcuts.get("MediaPlayPause")!();
      }).not.toThrow();

      expect(faultySendAction).toHaveBeenCalledTimes(1);
      // Absolute guarantee: no fallback leakage to IPC
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(0);
    });
  });

  // =========================================================================
  // 4. Collision Simulation & Fault Tolerance
  // =========================================================================
  describe("4. Collision Simulation & Fault Tolerance", () => {
    it("handles registration failure on arbitrary keys gracefully and returns false for registerAll()", () => {
      // Simulate MediaNextTrack collision (already registered by another app, e.g. Spotify)
      mockShortcutApi.register = vi.fn((acc: string, cb: () => void) => {
        if (acc === "MediaNextTrack") {
          return false;
        }
        mockShortcuts.set(acc, cb);
        return true;
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      const allRegistered = controller.registerAll();
      expect(allRegistered).toBe(false);

      // Remaining 3 keys are registered and work
      expect(controller.isRegistered("MediaPlayPause")).toBe(true);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(true);
      expect(controller.isRegistered("MediaStop")).toBe(true);

      // Trigger MediaPlayPause -> still works
      mockShortcuts.get("MediaPlayPause")!();
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(1);
      expect(fakeWindow.webContents.send).toHaveBeenCalledWith(
        "desktop:media-action",
        "togglePlay",
      );
    });

    it("handles native exception thrown by globalShortcut.register without crashing", () => {
      mockShortcutApi.register = vi.fn((acc: string, cb: () => void) => {
        if (acc === "MediaPreviousTrack") {
          throw new Error("OS Shortcut Access Denied");
        }
        mockShortcuts.set(acc, cb);
        return true;
      });

      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      let allRegistered = false;
      expect(() => {
        allRegistered = controller.registerAll();
      }).not.toThrow();

      expect(allRegistered).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
      expect(controller.isRegistered("MediaPlayPause")).toBe(true);
    });
  });

  // =========================================================================
  // 5. Teardown & Lifecycle Verification
  // =========================================================================
  describe("5. Teardown & Lifecycle Verification", () => {
    it("unregisterAll() cleanly unregisters all keys from shortcutApi and state", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      controller.register();
      expect(mockShortcutApi.register).toHaveBeenCalledTimes(4);
      expect(controller.isRegistered("MediaPlayPause")).toBe(true);
      expect(controller.isRegistered("MediaNextTrack")).toBe(true);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(true);
      expect(controller.isRegistered("MediaStop")).toBe(true);

      controller.unregisterAll();
      expect(mockShortcutApi.unregister).toHaveBeenCalledTimes(4);
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
      expect(controller.isRegistered("MediaStop")).toBe(false);
      expect(mockShortcuts.size).toBe(0);
    });

    it("destroy() cleanly delegates to unregisterAll()", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      controller.register();
      controller.destroy();

      expect(mockShortcutApi.unregister).toHaveBeenCalledTimes(4);
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
    });

    it("handles exceptions thrown during unregisterAll() without stopping remaining unregistrations", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );
      controller.register();

      mockShortcutApi.unregister = vi.fn((acc: string) => {
        if (acc === "MediaPlayPause") {
          throw new Error("Simulated unregister crash");
        }
        mockShortcuts.delete(acc);
      });

      expect(() => controller.unregisterAll()).not.toThrow();

      // All keys must still be removed from controller internal state
      expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      expect(controller.isRegistered("MediaNextTrack")).toBe(false);
      expect(controller.isRegistered("MediaPreviousTrack")).toBe(false);
      expect(controller.isRegistered("MediaStop")).toBe(false);
    });

    it("stress test: 50 rapid register and unregisterAll cycles", () => {
      const controller = new MediaShortcutsController(
        () => fakeWindow,
        undefined,
        mockShortcutApi,
      );

      for (let i = 0; i < 50; i++) {
        controller.register();
        expect(controller.isRegistered("MediaPlayPause")).toBe(true);
        controller.unregisterAll();
        expect(controller.isRegistered("MediaPlayPause")).toBe(false);
      }

      // Re-register and verify functional
      controller.register();
      mockShortcuts.get("MediaPlayPause")!();
      expect(fakeWindow.webContents.send).toHaveBeenCalledTimes(1);
    });
  });
});
