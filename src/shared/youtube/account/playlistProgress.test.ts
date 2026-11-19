import { describe, expect, it, vi } from "vitest";
import {
  publishPlaylistProgress,
  subscribePlaylistProgress,
} from "./playlistProgress";

const playlist = {
  type: "playlist" as const,
  id: "LM",
  title: "Liked Music",
  tracks: [],
};

describe("playlist progress", () => {
  it("delivers to subscribers of the same playlist, ignoring the VL prefix", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlaylistProgress("LM", listener);

    publishPlaylistProgress("VLLM", playlist);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    publishPlaylistProgress("LM", playlist);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not leak to other playlists", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlaylistProgress("PL123", listener);

    publishPlaylistProgress("LM", playlist);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
