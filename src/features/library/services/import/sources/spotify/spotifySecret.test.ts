import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryFetchText } from "@/shared/api/tryFetch";
import { extractSpotifySecret, fetchSpotifySecret } from "./spotifySecret";

vi.mock("@/shared/api/tryFetch", () => ({
  tryFetchText: vi.fn(),
  tryFetchJson: vi.fn(),
}));

const SCRIPT = `let a=[{secret:'old',version:60},{secret:",7/*F(\\"x",version:61}]`;

function serve(html: string): void {
  vi.mocked(tryFetchText).mockImplementation(async (url) =>
    String(url) === "https://open.spotify.com/" ? html : SCRIPT,
  );
}

describe("spotifySecret", () => {
  beforeEach(() => vi.mocked(tryFetchText).mockReset());

  it("picks the newest secret", () => {
    expect(extractSpotifySecret(SCRIPT)).toEqual({
      secret: ',7/*F("x',
      version: 61,
    });
  });

  it("reads the desktop web player script", async () => {
    serve(
      `<script src="https://open.spotifycdn.com/cdn/build/web-player/web-player.0079e2e5.js"></script>`,
    );
    await expect(fetchSpotifySecret()).resolves.toEqual({
      secret: ',7/*F("x',
      version: 61,
    });
  });

  it("reads the mobile web player script", async () => {
    serve(
      `<script src="https://open.spotifycdn.com/cdn/build/mobile-web-player/mobile-web-player.de4c0766.js"></script>`,
    );
    await expect(fetchSpotifySecret()).resolves.toEqual({
      secret: ',7/*F("x',
      version: 61,
    });
  });

  it("fails clearly without a player script", async () => {
    serve("<html></html>");
    await expect(fetchSpotifySecret()).rejects.toThrow(
      "Spotify is unavailable",
    );
  });
});
