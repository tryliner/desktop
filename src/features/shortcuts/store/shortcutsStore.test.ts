import { describe, it, expect, beforeEach, vi } from "vitest";
import { useShortcutsStore } from "./shortcutsStore";
import { DEFAULT_SHORTCUTS } from "../types";
import { useOverlaySettingsStore } from "@/features/overlay/store/overlaySettingsStore";

describe("shortcutsStore", () => {
  beforeEach(() => {
    useShortcutsStore.getState().resetAll();
  });

  it("initializes with default shortcuts across all sections", () => {
    const state = useShortcutsStore.getState();
    expect(state.global.toggleOverlay).toBe(
      DEFAULT_SHORTCUTS.global.toggleOverlay,
    );
    expect(state.global.quickLikeSong).toBe(
      DEFAULT_SHORTCUTS.global.quickLikeSong,
    );
    expect(state.mainApp.playPause).toBe("Space");
    expect(state.mainApp.nextTrack).toBe("Control+Right");
    expect(state.miniplayer.playPause).toBe("Space");
    expect(state.miniplayer.likeTrack).toBe("L");
  });

  it("updates global shortcuts and normalizes them", () => {
    const updateOverlaySettings = vi.fn();
    (window as any).linerElectron = { updateOverlaySettings };

    useShortcutsStore
      .getState()
      .setGlobalShortcut("quickLikeSong", "Ctrl+Alt+L");
    expect(useShortcutsStore.getState().global.quickLikeSong).toBe(
      "Control+Alt+L",
    );
    expect(updateOverlaySettings).toHaveBeenCalledWith(
      expect.objectContaining({ likeShortcut: "Control+Alt+L" }),
    );

    useShortcutsStore
      .getState()
      .setGlobalShortcut("toggleOverlay", "Alt+Shift+Щ");
    expect(useShortcutsStore.getState().global.toggleOverlay).toBe(
      "Alt+Shift+O",
    );
    expect(useOverlaySettingsStore.getState().shortcut).toBe("Alt+Shift+O");
  });

  it("updates main app and miniplayer shortcuts", () => {
    useShortcutsStore.getState().setMainAppShortcut("playPause", "P");
    expect(useShortcutsStore.getState().mainApp.playPause).toBe("P");

    useShortcutsStore.getState().setMiniplayerShortcut("nextTrack", "N");
    expect(useShortcutsStore.getState().miniplayer.nextTrack).toBe("N");
  });

  it("resets individual shortcuts to default", () => {
    useShortcutsStore.getState().setMainAppShortcut("playPause", "P");
    expect(useShortcutsStore.getState().mainApp.playPause).toBe("P");

    useShortcutsStore.getState().resetShortcut("mainApp", "playPause");
    expect(useShortcutsStore.getState().mainApp.playPause).toBe("Space");
  });

  it("resets an entire section to default", () => {
    useShortcutsStore.getState().setMiniplayerShortcut("nextTrack", "N");
    useShortcutsStore.getState().setMiniplayerShortcut("likeTrack", "H");

    useShortcutsStore.getState().resetSection("miniplayer");
    expect(useShortcutsStore.getState().miniplayer.nextTrack).toBe("]");
    expect(useShortcutsStore.getState().miniplayer.likeTrack).toBe("L");
  });

  it("resets all shortcuts to defaults", () => {
    useShortcutsStore
      .getState()
      .setGlobalShortcut("quickLikeSong", "Alt+Shift+K");
    useShortcutsStore.getState().setMainAppShortcut("toggleMute", "X");
    useShortcutsStore.getState().setMiniplayerShortcut("likeTrack", "Y");

    useShortcutsStore.getState().resetAll();
    expect(useShortcutsStore.getState().global.quickLikeSong).toBe(
      "Alt+Shift+L",
    );
    expect(useShortcutsStore.getState().mainApp.toggleMute).toBe("M");
    expect(useShortcutsStore.getState().miniplayer.likeTrack).toBe("L");
  });

  it("toggles isRecording and notifies Electron to pause global shortcuts", () => {
    const pauseOverlayShortcuts = vi.fn();
    (window as any).linerElectron = { pauseOverlayShortcuts };

    useShortcutsStore.getState().setIsRecording(true);
    expect(useShortcutsStore.getState().isRecording).toBe(true);
    expect(pauseOverlayShortcuts).toHaveBeenCalledWith(true);

    useShortcutsStore.getState().setIsRecording(false);
    expect(useShortcutsStore.getState().isRecording).toBe(false);
    expect(pauseOverlayShortcuts).toHaveBeenCalledWith(false);
  });

  it("binds and clears optional global shortcuts and sends them to electron", () => {
    const updateOverlaySettings = vi.fn();
    (window as any).linerElectron = { updateOverlaySettings };

    expect(useShortcutsStore.getState().global.playPause).toBe("");

    useShortcutsStore.getState().setGlobalShortcut("playPause", "Ctrl+Alt+P");
    expect(useShortcutsStore.getState().global.playPause).toBe("Control+Alt+P");
    expect(updateOverlaySettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mediaShortcuts: expect.objectContaining({
          playPause: "Control+Alt+P",
          nextTrack: "",
        }),
      }),
    );

    useShortcutsStore.getState().setGlobalShortcut("playPause", "");
    expect(useShortcutsStore.getState().global.playPause).toBe("");
    expect(updateOverlaySettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mediaShortcuts: expect.objectContaining({ playPause: "" }),
      }),
    );
  });

  it("picks up shortcuts another window saved", async () => {
    const saved = JSON.parse(
      localStorage.getItem("liner_shortcuts_settings_v1") ?? "{}",
    );
    saved.state.miniplayer.nextTrack = "N";
    localStorage.setItem("liner_shortcuts_settings_v1", JSON.stringify(saved));

    window.dispatchEvent(
      new StorageEvent("storage", { key: "liner_shortcuts_settings_v1" }),
    );
    await vi.waitFor(() =>
      expect(useShortcutsStore.getState().miniplayer.nextTrack).toBe("N"),
    );
  });

  describe("global shortcut registration verdicts", () => {
    beforeEach(() => {
      (window as any).linerElectron = { updateOverlaySettings: vi.fn() };
      useShortcutsStore.setState({ globalStatus: {}, rejectedGlobal: null });
    });

    it("reverts a freshly recorded bind the os refused and says why", () => {
      const store = useShortcutsStore.getState();
      store.commitGlobalShortcut("volumeUp", "Control+Shift+Up");
      expect(useShortcutsStore.getState().global.volumeUp).toBe(
        "Control+Shift+UP",
      );

      useShortcutsStore.getState().setGlobalStatus({ volumeUp: "taken" });

      const state = useShortcutsStore.getState();
      expect(state.global.volumeUp).toBe("");
      expect(state.rejectedGlobal).toEqual({
        action: "volumeUp",
        shortcut: "Control+Shift+UP",
        reason: "taken",
      });
    });

    it("keeps a freshly recorded bind the os accepted", () => {
      useShortcutsStore
        .getState()
        .commitGlobalShortcut("volumeUp", "Control+Shift+Up");
      useShortcutsStore.getState().setGlobalStatus({ volumeUp: "ok" });
      useShortcutsStore.getState().setGlobalStatus({ volumeUp: "taken" });

      expect(useShortcutsStore.getState().global.volumeUp).toBe(
        "Control+Shift+UP",
      );
      expect(useShortcutsStore.getState().rejectedGlobal).toBeNull();
    });

    it("ignores the stale verdict of the previous combo", () => {
      useShortcutsStore.setState({ globalStatus: { volumeUp: "taken" } });
      useShortcutsStore
        .getState()
        .setGlobalShortcut("volumeUp", "Control+Shift+Up");
      useShortcutsStore
        .getState()
        .commitGlobalShortcut("volumeUp", "Control+Alt+Up");

      useShortcutsStore.getState().setGlobalStatus({ volumeUp: "taken" });
      expect(useShortcutsStore.getState().global.volumeUp).toBe(
        "Control+Alt+UP",
      );

      useShortcutsStore.getState().setGlobalStatus({});
      useShortcutsStore.getState().setGlobalStatus({ volumeUp: "ok" });
      expect(useShortcutsStore.getState().global.volumeUp).toBe(
        "Control+Alt+UP",
      );
      expect(useShortcutsStore.getState().rejectedGlobal).toBeNull();
    });

    it("does not revert binds that were taken at startup", () => {
      useShortcutsStore
        .getState()
        .setGlobalShortcut("volumeDown", "Control+Shift+Down");
      useShortcutsStore.getState().setGlobalStatus({ volumeDown: "taken" });
      expect(useShortcutsStore.getState().global.volumeDown).toBe(
        "Control+Shift+DOWN",
      );
      expect(useShortcutsStore.getState().globalStatus.volumeDown).toBe(
        "taken",
      );
    });
  });

  describe("volume hotkey settings", () => {
    it("accepts only the offered steps", () => {
      useShortcutsStore.getState().setVolumeStep(0.1);
      expect(useShortcutsStore.getState().volumeStep).toBe(0.1);
      useShortcutsStore.getState().setVolumeStep(0.3 as never);
      expect(useShortcutsStore.getState().volumeStep).toBe(0.1);
      useShortcutsStore.getState().setVolumeStep(0.05);
    });

    it("sends the hold behaviour to the main process", () => {
      const updateOverlaySettings = vi.fn();
      (window as any).linerElectron = { updateOverlaySettings };
      useShortcutsStore.getState().setVolumeHoldRepeats(false);
      expect(updateOverlaySettings).toHaveBeenCalledWith(
        expect.objectContaining({ volumeHoldRepeats: false }),
      );
      useShortcutsStore.getState().setVolumeHoldRepeats(true);
    });
  });
});
