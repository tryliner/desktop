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
  toClientTrack: (track: { id: string }) => ({
    id: track.id,
    title: "",
    artists: "",
    coverUrl: "",
    durationMs: 0,
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
});
