import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  globalShortcut: { register: vi.fn(() => true), unregister: vi.fn() },
}));

const { globalShortcut } = await import("electron");
const {
  MediaShortcuts,
  createRepeatGate,
  mediaActionFromCompositor,
  sanitizeMediaBindings,
} = await import("./mediaShortcuts");

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

  it("reports which binds the os accepted, refused or rejected", () => {
    const onStatus = vi.fn();
    const shortcuts = new MediaShortcuts(() => null, vi.fn(), onStatus);
    vi.mocked(globalShortcut.register)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        throw new Error("bad accelerator");
      });
    shortcuts.setBindings({
      playPause: "Control+Alt+P",
      nextTrack: "Control+Shift+Up",
      prevTrack: "Control+Shift+???",
    });
    shortcuts.register();

    expect(onStatus).toHaveBeenCalledWith("playPause", "ok");
    expect(onStatus).toHaveBeenCalledWith("nextTrack", "taken");
    expect(onStatus).toHaveBeenCalledWith("prevTrack", "invalid");
    expect(onStatus).toHaveBeenCalledWith("volumeUp", null);
  });

  it("falls back to globalShortcut and reports it when the compositor refuses", async () => {
    const onStatus = vi.fn();
    const bindShortcut = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const compositor = {
      bindShortcut,
      unbindShortcut: vi.fn().mockResolvedValue(undefined),
    } as never;
    vi.mocked(globalShortcut.register).mockReturnValueOnce(false);
    const shortcuts = new MediaShortcuts(() => compositor, vi.fn(), onStatus);
    shortcuts.setBindings({
      playPause: "Control+Alt+P",
      nextTrack: "Control+Shift+Up",
    });
    shortcuts.register();
    await vi.waitFor(() => expect(onStatus).toHaveBeenCalledTimes(9));

    expect(onStatus).toHaveBeenCalledWith("playPause", "ok");
    expect(onStatus).toHaveBeenCalledWith("nextTrack", "taken");
  });
});

describe("held key repeat gate", () => {
  it("lets taps through and drops os auto-repeat while a key is held", () => {
    const allow = createRepeatGate(600);
    expect(allow("volumeUp", 0)).toBe(true);
    expect(allow("volumeUp", 500)).toBe(false);
    expect(allow("volumeUp", 533)).toBe(false);
    expect(allow("volumeUp", 566)).toBe(false);
    expect(allow("volumeDown", 570)).toBe(true);
    expect(allow("volumeUp", 1300)).toBe(true);
  });
});
