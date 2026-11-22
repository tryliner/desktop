// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = {
  method: "like" | "unlike";
  id: string;
  resolve: () => void;
  reject: (error: unknown) => void;
};

const server = new Set<string>();
const calls: Call[] = [];
let listGate: Promise<void> | null = null;

vi.mock("@/shared/api", () => ({
  api: {
    likeTrack: vi.fn(
      (id: string) =>
        new Promise<void>((resolve, reject) => {
          calls.push({
            method: "like",
            id,
            resolve: () => {
              server.add(id);
              resolve();
            },
            reject,
          });
        }),
    ),
    unlikeTrack: vi.fn(
      (id: string) =>
        new Promise<void>((resolve, reject) => {
          calls.push({
            method: "unlike",
            id,
            resolve: () => {
              server.delete(id);
              resolve();
            },
            reject,
          });
        }),
    ),
    listLikedTracks: vi.fn(async () => {
      const ids = [...server];
      if (listGate) await listGate;
      return {
        items: ids.map((id) => ({ track: { id }, likedAt: "2026-11-08" })),
        nextCursor: null,
      };
    }),
  },
  getAuthSession: () => ({ accessToken: "token", user: { id: "u1" } }),
  toClientTrack: (track: {
    id: string;
    title?: string;
    artists?: string | { id?: string; name: string }[];
    durationMs?: number;
  }) => ({
    id: track.id,
    title: track.title ?? "",
    artists: Array.isArray(track.artists)
      ? track.artists.map((artist) => artist.name).join(", ")
      : (track.artists ?? ""),
    artistList: Array.isArray(track.artists) ? track.artists : undefined,
    coverUrl: "",
    durationMs: track.durationMs ?? 0,
    playCount: 0,
  }),
}));

import {
  isTrackLikedNow,
  loadLikedTracks,
  reloadLikedTracks,
  setTrackLiked,
  toggleTrackLike,
} from "./useLikedTracks";
import { api } from "@/shared/api";

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

const settleAll = async () => {
  while (calls.length > 0) {
    calls.shift()!.resolve();
    await flush();
  }
  await reloadLikedTracks();
  await flush();
};

describe("like sync", () => {
  beforeEach(async () => {
    calls.length = 0;
    listGate = null;
    await loadLikedTracks();
  });

  it("flips on every rapid click and sends a single request when the last click matches it", async () => {
    const seen: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      void toggleTrackLike("rapid").settled.catch(() => {});
      seen.push(isTrackLikedNow("rapid"));
    }

    expect(seen).toEqual([true, false, true, false, true, false, true]);
    expect(calls.map((c) => c.method)).toEqual(["like"]);

    calls.shift()!.resolve();
    await flush();
    expect(calls).toHaveLength(0);

    await settleAll();
    expect(server.has("rapid")).toBe(true);
    expect(isTrackLikedNow("rapid")).toBe(true);
  });

  it("queues the final state after the in-flight request instead of racing it", async () => {
    toggleTrackLike("queued");
    toggleTrackLike("queued");
    expect(isTrackLikedNow("queued")).toBe(false);
    expect(calls.map((c) => c.method)).toEqual(["like"]);

    calls.shift()!.resolve();
    await flush();
    expect(calls.map((c) => c.method)).toEqual(["unlike"]);

    await settleAll();
    expect(server.has("queued")).toBe(false);
    expect(isTrackLikedNow("queued")).toBe(false);
  });

  it("skips the request when the wanted state is already confirmed", async () => {
    server.add("already");
    await reloadLikedTracks();

    await setTrackLiked("already", true);
    expect(calls).toHaveLength(0);
    expect(isTrackLikedNow("already")).toBe(true);
  });

  it("keeps the clicked state when an older refetch lands after the request", async () => {
    let openGate!: () => void;
    listGate = new Promise((resolve) => {
      openGate = resolve;
    });
    const staleReload = reloadLikedTracks();
    listGate = null;

    toggleTrackLike("stale");
    expect(isTrackLikedNow("stale")).toBe(true);

    calls.shift()!.resolve();
    await flush();
    openGate();
    await staleReload;
    await flush();
    expect(isTrackLikedNow("stale")).toBe(true);

    await settleAll();
    expect(isTrackLikedNow("stale")).toBe(true);
  });

  it("falls back to the last confirmed state when the request fails", async () => {
    const { settled } = toggleTrackLike("broken");
    expect(isTrackLikedNow("broken")).toBe(true);

    calls.shift()!.reject(new Error("offline"));
    await expect(settled).rejects.toThrow("offline");
    expect(isTrackLikedNow("broken")).toBe(false);
  });

  it("treats equivalent album and liked-list versions as one like", async () => {
    vi.mocked(api.listLikedTracks).mockResolvedValueOnce({
      items: [
        {
          track: {
            id: "liked-version",
            title: "Song",
            artists: [{ id: "artist", name: "Artist" }],
            durationMs: 180_000,
          },
          likedAt: "2026-11-08",
        },
      ],
      nextCursor: null,
    });
    await reloadLikedTracks();

    const albumVersion = {
      id: "album-version",
      title: "Song",
      artists: "Artist",
      durationMs: 180_500,
      coverUrl: "",
      playCount: 0,
    };

    expect(isTrackLikedNow(albumVersion)).toBe(true);
    const { liked, settled } = toggleTrackLike(albumVersion);
    expect(liked).toBe(false);
    expect(calls.map((call) => [call.method, call.id])).toEqual([
      ["unlike", "liked-version"],
    ]);

    calls.shift()!.resolve();
    await settled;
    expect(isTrackLikedNow(albumVersion)).toBe(false);
  });
});
