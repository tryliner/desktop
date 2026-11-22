import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = {
  method: "like" | "unlike";
  resolve: () => void;
  reject: (error: unknown) => void;
};
const server = new Set<string>();
const calls: Call[] = [];
let listGate: Promise<void> | null = null;

vi.mock("@/shared/api", () => ({
  api: {
    likeTrack: vi.fn((id: string) => new Promise<void>((resolve, reject) => {
      calls.push({ method: "like", resolve: () => {
        server.add(id);
        resolve();
      }, reject });
    })),
    unlikeTrack: vi.fn((id: string) => new Promise<void>((resolve, reject) => {
      calls.push({ method: "unlike", resolve: () => {
        server.delete(id);
        resolve();
      }, reject });
    })),
    listLikedTracks: vi.fn(async () => {
      const ids = [...server];
      if (listGate) await listGate;
      return {
        items: ids.map((id) => ({ track: { id }, likedAt: "2026" })),
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
  reloadLikedTracks,
  toggleTrackLike,
} from "./useLikedTracks";

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("like sync recovery", () => {
  beforeEach(async () => {
    server.clear();
    calls.length = 0;
    listGate = null;
    await reloadLikedTracks();
  });

  it("keeps clicked state when an older refetch lands", async () => {
    let openGate!: () => void;
    listGate = new Promise((resolve) => { openGate = resolve; });
    const staleReload = reloadLikedTracks();
    listGate = null;
    toggleTrackLike("stale");
    calls.shift()!.resolve();
    await flush();
    openGate();
    await staleReload;
    expect(isTrackLikedNow("stale")).toBe(true);
  });

  it("falls back after a request fails", async () => {
    const { settled } = toggleTrackLike("broken");
    calls.shift()!.reject(new Error("offline"));
    await expect(settled).rejects.toThrow("offline");
    expect(isTrackLikedNow("broken")).toBe(false);
  });
});
