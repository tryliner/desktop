import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  globalShortcut: { register: vi.fn(() => true), unregister: vi.fn() },
}));

const { globalShortcut } = await import("electron");
const { MediaShortcuts, mediaActionFromCompositor, sanitizeMediaBindings } =
  await import("./mediaShortcuts");

describe("media shortcuts", () => {
  it("keeps only known, non-empty bindings", () => {
    expect(
      sanitizeMediaBindings(
        {
          playPause: " ctrl+alt+p ",
          nextTrack: "",
          bogus: "Alt+B",
          volumeUp: 3,
        },
        (raw) => raw.toUpperCase(),
      ),
    ).toEqual({ playPause: "CTRL+ALT+P" });
    expect(sanitizeMediaBindings(null, (raw) => raw)).toEqual({});
  });

  it("maps compositor ids back to actions", () => {
    expect(mediaActionFromCompositor("media-nextTrack")).toBe("nextTrack");
    expect(mediaActionFromCompositor("media-bogus")).toBeNull();
    expect(mediaActionFromCompositor("toggle-overlay")).toBeNull();
  });

  it("registers bound actions and swaps them on rebind", () => {
    const onAction = vi.fn();
    const shortcuts = new MediaShortcuts(() => null, onAction);
    shortcuts.setBindings({ playPause: "Control+Alt+P" });
    shortcuts.register();
    expect(globalShortcut.register).toHaveBeenCalledWith(
      "Control+Alt+P",
      expect.any(Function),
    );

    const trigger = vi.mocked(globalShortcut.register).mock.calls[0][1];
    trigger();
    expect(onAction).toHaveBeenCalledWith("playPause");

    shortcuts.setBindings({ playPause: "Control+Alt+K" });
    shortcuts.register();
    expect(globalShortcut.unregister).toHaveBeenCalledWith("Control+Alt+P");
    expect(globalShortcut.register).toHaveBeenLastCalledWith(
      "Control+Alt+K",
      expect.any(Function),
    );
    expect(shortcuts.matches({ playPause: "Control+Alt+K" })).toBe(true);
    expect(shortcuts.matches({})).toBe(false);
  });
});
