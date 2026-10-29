import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  session: null as { accessToken: string; user: { id: string } } | null,
  listLikedTracks: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  getAuthSession: () => auth.session,
  api: { listLikedTracks: auth.listLikedTracks },
  toClientTrack: (track: object) => track,
}));

const signIn = (id: string) => {
  auth.session = { accessToken: "token", user: { id } };
};

async function setup() {
  vi.resetModules();
  const scope = await import("./accountScope");
  const { fetchLikedTracks } = await import("./fetchLikedTracks");
  const current = scope.captureScope();
  if (!current) throw new Error("expected a signed-in scope");
  return { scope, fetchLikedTracks, current };
}

beforeEach(() => {
  auth.session = null;
  auth.listLikedTracks.mockReset();
});

describe("liked tracks fetch across account changes", () => {
  it("returns every page while the account stays the same", async () => {
    signIn("a");
    auth.listLikedTracks
      .mockResolvedValueOnce({
        items: [{ track: { id: "1" }, likedAt: "x" }],
        nextCursor: "next",
      })
      .mockResolvedValueOnce({
        items: [{ track: { id: "2" }, likedAt: "y" }],
        nextCursor: null,
      });
    const { fetchLikedTracks, current } = await setup();

    const tracks = await fetchLikedTracks(current);

    expect(tracks?.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("drops the page and stops paging once the account changed", async () => {
    signIn("a");
    let release!: (page: unknown) => void;
    auth.listLikedTracks.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const { scope, fetchLikedTracks, current } = await setup();
    const result = fetchLikedTracks(current);

    signIn("b");
    scope.syncAccountScope();
    release({
      items: [{ track: { id: "private-to-a" }, likedAt: "x" }],
      nextCursor: "next",
    });

    await expect(result).resolves.toBeNull();
    expect(auth.listLikedTracks).toHaveBeenCalledTimes(1);
  });
});
