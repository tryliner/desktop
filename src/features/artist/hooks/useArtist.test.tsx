// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useArtist } from "./useArtist";
import { api } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/api", () => ({
  api: { getArtist: vi.fn() },
  mediaUrl: (url: string) => url,
  toMaxQualityAvatarUrl: (url: string) => url,
  toClientTrack: (track: { id: string }) => ({ ...track }),
}));

const artist = {
  name: "Boards of Canada",
  verified: true,
  bio: "",
  cover: { url: "boc.jpg" },
  tracks: [],
  albums: [],
  singles: [],
};

let firstRender: ReturnType<typeof useArtist> | null = null;
let latest: ReturnType<typeof useArtist> | null = null;

function Probe({ id }: { id: string }) {
  const state = useArtist(id);
  firstRender ??= state;
  latest = state;
  return null;
}

describe("useArtist", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    queryCache.clear();
    firstRender = null;
    latest = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(api.getArtist).mockReset();
    vi.mocked(api.getArtist).mockResolvedValue(artist as any);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("opens an artist seen before from memory on the first render", async () => {
    await act(async () => {
      root.render(<Probe id="boc" />);
    });
    expect(latest?.data?.title).toBe("Boards of Canada");
    expect(api.getArtist).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    root = createRoot(container);
    firstRender = null;
    vi.mocked(api.getArtist).mockReturnValue(new Promise(() => undefined));

    act(() => {
      root.render(<Probe id="boc" />);
    });
    expect(firstRender).toMatchObject({
      loading: false,
      data: { title: "Boards of Canada" },
    });
    expect(api.getArtist).toHaveBeenCalledTimes(1);
  });
});
