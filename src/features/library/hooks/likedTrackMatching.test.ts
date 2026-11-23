import { beforeEach, describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import { equivalentTrack } from "./likedTrackMatching";
import { likedTrackFor } from "./likedTrackResolver";
import {
  optimisticOverrides,
  setLikedCache,
  optimisticTracks,
  syncingLikes,
  bumpOptimisticOverrideVersion,
} from "./likedTrackStore";
import {
  applyOptimisticLike,
  applyOptimisticUnlike,
} from "./likedTrackOptimistic";
import { isTrackLikedNow } from "./likedTrackResolver";

function track(overrides: Partial<Track>): Track {
  return {
    id: "track",
    title: "Song",
    artists: "Artist",
    artistList: [],
    coverUrl: "",
    durationMs: 180_000,
    playCount: 0,
    ...overrides,
  };
}

describe("liked track matching", () => {
  beforeEach(() => {
    optimisticOverrides.clear();
    optimisticTracks.clear();
    syncingLikes.clear();
  });

  it("matches an empty artistList from the artist string", () => {
    expect(
      equivalentTrack(
        track({ id: "album", artistList: [] }),
        track({
          id: "liked",
          artistList: [{ id: "artist", name: "Artist" }],
        }),
      ),
    ).toBe(true);
  });

  it("does not match the same title and duration for another artist", () => {
    expect(
      equivalentTrack(
        track({ id: "album", artists: "Artist A", artistList: [] }),
        track({
          id: "liked",
          artists: "Artist B",
          artistList: [{ id: "artist-b", name: "Artist B" }],
        }),
      ),
    ).toBe(false);
  });

  it("prefers a liked equivalent when duplicate cached entries exist", () => {
    setLikedCache(
      [
        track({ id: "album-a", artists: "Artist", artistList: [] }),
        track({ id: "album-b", artists: "Artist", artistList: [] }),
      ],
      true,
    );
    optimisticOverrides.set("album-a", false);

    expect(
      likedTrackFor(track({ id: "search", artists: "Artist", artistList: [] }))
        ?.id,
    ).toBe("album-b");
  });

  it("honors an exact-ID override instead of an equivalent cache match", () => {
    setLikedCache(
      [track({ id: "album-a", artists: "Artist", artistList: [] })],
      true,
    );
    optimisticOverrides.set("album-b", true);

    const albumB = track({
      id: "album-b",
      artists: "Artist",
      artistList: [],
    });
    expect(likedTrackFor(albumB)?.id).toBe("album-b");
  });

  it("does not let an older optimistic rollback remove a newer override", () => {
    setLikedCache([], true);
    const rollbackFirst = applyOptimisticLike("track");
    const rollbackSecond = applyOptimisticLike("track");

    rollbackFirst();
    expect(isTrackLikedNow("track")).toBe(true);

    rollbackSecond();
    expect(isTrackLikedNow("track")).toBe(false);
  });

  it("does not let an older optimistic unlike rollback remove a newer override", () => {
    setLikedCache([track({ id: "track" })], true);
    const rollbackFirst = applyOptimisticUnlike("track");
    const rollbackSecond = applyOptimisticUnlike("track");

    rollbackFirst();
    expect(isTrackLikedNow("track")).toBe(false);

    rollbackSecond();
    expect(isTrackLikedNow("track")).toBe(true);
  });

  it("does not let an old rollback undo a shared override write", () => {
    setLikedCache([], true);
    const rollback = applyOptimisticUnlike("track");
    optimisticOverrides.set("track", true);
    bumpOptimisticOverrideVersion("track");

    rollback();
    expect(isTrackLikedNow("track")).toBe(true);
  });
});
