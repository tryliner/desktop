import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  rememberSoundCloudClientId,
  resetSoundCloudClientIdCache,
} from "@/shared/media/soundcloud";
import { importSoundCloud } from "./soundcloudSource";

const STALE_ID = "stale000000000000000000000000000";
const FRESH_ID = "fresh000000000000000000000000000";
const HOME_HTML =
  '<script src="https://a-v2.sndcdn.com/assets/app.js"></script>';

function likesPage(trackId: number, nextHref?: string) {
  const track = {
    id: trackId,
    title: `Song ${trackId}`,
    user: { username: "u" },
  };
  return { collection: [{ track }], next_href: nextHref };
}

function respond(url: URL): unknown {
  const clientId = url.searchParams.get("client_id");
  if (url.origin === "https://soundcloud.com") return HOME_HTML;
  if (url.hostname === "a-v2.sndcdn.com") return `client_id:"${FRESH_ID}"`;
  if (clientId !== FRESH_ID) return 401;
  if (url.pathname === "/resolve")
    return { kind: "user", id: 7, username: "listener" };
  if (url.pathname === "/users/7/likes" && !url.searchParams.has("offset")) {
    return likesPage(
      1,
      "https://api-v2.soundcloud.com/users/7/likes?offset=abc&limit=50",
    );
  }
  if (url.pathname === "/users/7/likes") return likesPage(2);
  return 404;
}

beforeEach(() => {
  resetSoundCloudClientIdCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const body = respond(new URL(input.toString()));
      if (typeof body === "number") return new Response("", { status: body });
      return new Response(
        typeof body === "string" ? body : JSON.stringify(body),
        { status: 200 },
      );
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("importSoundCloud", () => {
  it("resolves likes through the shared api client and refreshes a rejected client id", async () => {
    rememberSoundCloudClientId(STALE_ID);
    const playlist = await importSoundCloud(
      "https://soundcloud.com/listener/likes",
    );
    expect(playlist.title).toBe("listener — Likes");
    expect(playlist.tracks.map((track) => track.title)).toEqual([
      "Song 1",
      "Song 2",
    ]);
  });
});
