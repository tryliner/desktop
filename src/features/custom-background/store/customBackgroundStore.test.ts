import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCustomBackgroundStore,
  validateBackgroundFile,
  sanitizeBackgroundSettings,
  resolveBackgroundType,
  DEFAULT_CUSTOM_BACKGROUND,
  MAX_BACKGROUND_BYTES,
} from "./customBackgroundStore";
import {
  loadBackgroundMedia,
  deleteBackgroundMedia,
} from "./backgroundMediaDb";

vi.mock("./backgroundMediaDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./backgroundMediaDb")>();
  return {
    ...actual,
    deleteBackgroundMedia: vi.fn(actual.deleteBackgroundMedia),
  };
});

let urlCounter = 0;
const createObjectURL = vi.fn(() => `blob:test/${++urlCounter}`);
const revokeObjectURL = vi.fn();

function makeFile(name: string, type: string, size?: number): File {
  const file = new File(["wallpaper"], name, { type });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("customBackgroundStore", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    await useCustomBackgroundStore.getState().removeMedia();
    useCustomBackgroundStore.setState({
      ...DEFAULT_CUSTOM_BACKGROUND,
      legacyChecked: true,
      mediaUrl: null,
    });
    vi.runAllTimers();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with the wallpaper off and covers disabled on pages", () => {
    expect(DEFAULT_CUSTOM_BACKGROUND).toMatchObject({
      blur: 0,
      media: null,
      useCoversOnPages: false,
    });
    const state = useCustomBackgroundStore.getState();
    expect(state.media).toBeNull();
    expect(state.mediaUrl).toBeNull();
  });

  it("clamps slider values", () => {
    const s = useCustomBackgroundStore.getState();
    s.setBlur(99);
    s.setDim(-5);
    s.setPanelTransparency(140.6);
    expect(useCustomBackgroundStore.getState()).toMatchObject({
      blur: 40,
      dim: 0,
      panelTransparency: 100,
    });
    s.setBlur(12.4);
    s.setDim(95);
    s.setPanelTransparency(Number.NaN);
    expect(useCustomBackgroundStore.getState()).toMatchObject({
      blur: 12,
      dim: 80,
      panelTransparency: DEFAULT_CUSTOM_BACKGROUND.panelTransparency,
    });
  });

  it("sanitizes persisted settings", () => {
    expect(
      sanitizeBackgroundSettings({
        blur: "12",
        dim: 200,
        panelTransparency: -1,
        useCoversOnPages: "yes",
        media: { type: "application/pdf", name: "x.pdf" },
      }),
    ).toEqual({
      ...DEFAULT_CUSTOM_BACKGROUND,
      dim: 80,
      panelTransparency: 0,
    });
    expect(
      sanitizeBackgroundSettings({
        media: { type: "video/webm", name: "loop.webm", size: 10, savedAt: 1 },
        legacyChecked: true,
      }),
    ).toMatchObject({
      media: { kind: "video", type: "video/webm", name: "loop.webm" },
      legacyChecked: true,
    });
    expect(sanitizeBackgroundSettings(null)).toEqual(DEFAULT_CUSTOM_BACKGROUND);
  });

  it("validates file type and size", () => {
    expect(validateBackgroundFile(makeFile("a.png", "image/png"))).toEqual({
      kind: "image",
      type: "image/png",
    });
    expect(validateBackgroundFile(makeFile("a.gif", "image/gif"))).toEqual({
      kind: "image",
      type: "image/gif",
    });
    expect(validateBackgroundFile(makeFile("a.mp4", "video/mp4"))).toEqual({
      kind: "video",
      type: "video/mp4",
    });
    expect(validateBackgroundFile(makeFile("a.svg", "image/svg+xml"))).toEqual({
      error: "type",
    });
    expect(
      validateBackgroundFile(makeFile("a.mov", "video/quicktime")),
    ).toEqual({
      error: "type",
    });
    expect(
      validateBackgroundFile(
        makeFile("big.jpg", "image/jpeg", MAX_BACKGROUND_BYTES + 1),
      ),
    ).toEqual({ error: "size" });
    expect(
      validateBackgroundFile(
        makeFile("edge.jpg", "image/jpeg", MAX_BACKGROUND_BYTES),
      ),
    ).toMatchObject({ kind: "image" });
  });

  it("falls back to the extension when the file has no type", () => {
    expect(resolveBackgroundType({ type: "", name: "Photo.JPG" })).toBe(
      "image/jpeg",
    );
    expect(resolveBackgroundType({ type: "", name: "clip.webm" })).toBe(
      "video/webm",
    );
    expect(resolveBackgroundType({ type: "", name: "notes" })).toBe("");
  });

  it("saves a picked file and exposes it as a blob url", async () => {
    const error = await useCustomBackgroundStore
      .getState()
      .setMediaFile(makeFile("sky.webp", "image/webp"));
    expect(error).toBeNull();
    const state = useCustomBackgroundStore.getState();
    expect(state.media).toMatchObject({
      kind: "image",
      type: "image/webp",
      name: "sky.webp",
    });
    expect(state.mediaUrl).toBe(`blob:test/${urlCounter}`);
    expect((await loadBackgroundMedia())?.name).toBe("sky.webp");
  });

  it("rejects bad files without touching the current wallpaper", async () => {
    await useCustomBackgroundStore
      .getState()
      .setMediaFile(makeFile("sky.png", "image/png"));
    const before = useCustomBackgroundStore.getState().mediaUrl;
    expect(
      await useCustomBackgroundStore
        .getState()
        .setMediaFile(makeFile("doc.pdf", "application/pdf")),
    ).toBe("type");
    expect(
      await useCustomBackgroundStore
        .getState()
        .setMediaFile(
          makeFile("huge.gif", "image/gif", MAX_BACKGROUND_BYTES + 1),
        ),
    ).toBe("size");
    expect(useCustomBackgroundStore.getState().mediaUrl).toBe(before);
    expect((await loadBackgroundMedia())?.name).toBe("sky.png");
  });

  it("revokes the previous url once a new file replaces it", async () => {
    const s = useCustomBackgroundStore.getState();
    await s.setMediaFile(makeFile("one.png", "image/png"));
    const first = useCustomBackgroundStore.getState().mediaUrl;
    await s.setMediaFile(makeFile("two.png", "image/png"));
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith(first);
  });

  it("remove deletes the stored file and revokes its url", async () => {
    const s = useCustomBackgroundStore.getState();
    await s.setMediaFile(makeFile("one.mp4", "video/mp4"));
    const url = useCustomBackgroundStore.getState().mediaUrl;
    expect(await s.removeMedia()).toBe(true);
    vi.runAllTimers();
    expect(useCustomBackgroundStore.getState().media).toBeNull();
    expect(useCustomBackgroundStore.getState().mediaUrl).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith(url);
    expect(await loadBackgroundMedia()).toBeNull();
  });

  it("keeps the wallpaper when the stored file can't be deleted", async () => {
    const s = useCustomBackgroundStore.getState();
    await s.setMediaFile(makeFile("keep.png", "image/png"));
    const url = useCustomBackgroundStore.getState().mediaUrl;
    vi.mocked(deleteBackgroundMedia).mockRejectedValueOnce(
      new Error("tx aborted"),
    );
    expect(await s.removeMedia()).toBe(false);
    vi.runAllTimers();
    expect(useCustomBackgroundStore.getState().media?.name).toBe("keep.png");
    expect(useCustomBackgroundStore.getState().mediaUrl).toBe(url);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect((await loadBackgroundMedia())?.name).toBe("keep.png");
  });

  it("loads the stored file on startup", async () => {
    await useCustomBackgroundStore
      .getState()
      .setMediaFile(makeFile("loop.webm", "video/webm"));
    // simulate a fresh window: settings rehydrated, no blob url yet
    useCustomBackgroundStore.setState({ mediaUrl: null });
    await useCustomBackgroundStore.getState().loadMedia();
    const state = useCustomBackgroundStore.getState();
    expect(state.media?.kind).toBe("video");
    expect(state.mediaUrl).toMatch(/^blob:test\//);
  });

  it("drops stale settings when the stored file is gone", async () => {
    useCustomBackgroundStore.setState({
      media: {
        kind: "image",
        type: "image/png",
        name: "gone.png",
        size: 1,
        savedAt: 1,
      },
    });
    await useCustomBackgroundStore.getState().loadMedia();
    expect(useCustomBackgroundStore.getState().media).toBeNull();
  });

  it("a slow startup load never overrides a newer pick", async () => {
    await useCustomBackgroundStore
      .getState()
      .setMediaFile(makeFile("old.png", "image/png"));
    useCustomBackgroundStore.setState({ mediaUrl: null });
    const loading = useCustomBackgroundStore.getState().loadMedia();
    await useCustomBackgroundStore
      .getState()
      .setMediaFile(makeFile("new.png", "image/png"));
    await loading;
    expect(useCustomBackgroundStore.getState().media?.name).toBe("new.png");
  });
});
