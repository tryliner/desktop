import { describe, expect, it } from "vitest";
import { extractAppleMusicToken } from "./appleMusic/appleMusicToken";
import { mapAppleMusicTrack } from "./appleMusic/appleMusicTracks";
import { createSoundCloudCollection } from "./soundcloud/soundcloudCollection";
import { applySoundCloudHydration } from "./soundcloud/soundcloudHydration";
import {
  mapSoundCloudTrack,
  soundCloudCanonicalId,
} from "./soundcloud/soundcloudTracks";
import { parseSpotifyEmbedHtml } from "./spotify/spotifyEmbed";
import { extractSpotifySecret } from "./spotify/spotifySecret";
import { generateTotp } from "./spotify/spotifyTotp";

describe("spotify parsers", () => {
  it("generates RFC 6238 SHA-1 TOTP codes via WebCrypto", async () => {
    const secret = new Uint8Array(new ArrayBuffer(20));
    secret.set(new TextEncoder().encode("12345678901234567890"));
    expect(await generateTotp(secret, 59_000)).toBe("287082");
    expect(await generateTotp(secret, 1_111_111_109_000)).toBe("081804");
  });

  it("extracts the totp secret from the web player bundle", () => {
    expect(extractSpotifySecret('x=[{secret:"abc",version:12}]')).toEqual({
      secret: "abc",
      version: 12,
    });
    expect(extractSpotifySecret("nothing")).toBeUndefined();
    expect(
      extractSpotifySecret(
        `ej=[{secret:',7/*F("rLJ2oxaKL^f+E1xvP@N',version:61},{secret:'OmE{ZA.J^":0FG\\Uz?[@WW',version:60}]`,
      ),
    ).toEqual({ secret: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: 61 });
    expect(
      extractSpotifySecret(String.raw`[{secret:'a\'b',version:3}]`),
    ).toEqual({ secret: "a'b", version: 3 });
  });

  it("parses embed __NEXT_DATA__ track lists", () => {
    const entity = {
      title: "Люблю москву",
      subtitle: "borlinium",
      trackList: [
        {
          title: "Скажи мне кто ты",
          subtitle: "xxxmanera",
          uri: "spotify:track:2HX",
          duration: 132162,
        },
        {
          title: "Jealous",
          subtitle: "9mice, Egor Kreed",
          uri: "spotify:track:J",
        },
      ],
    };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
      {
        props: { pageProps: { state: { data: { entity } } } },
      },
    )}</script>`;
    const parsed = parseSpotifyEmbedHtml(
      html,
      "playlist",
      "pl",
      "Imported Spotify playlist",
    );
    expect(parsed.title).toBe("Люблю москву");
    expect(parsed.description).toBe("borlinium");
    expect(parsed.tracks[0]).toEqual({
      sourceId: "2HX",
      title: "Скажи мне кто ты",
      artists: ["xxxmanera"],
      durationMs: 132162,
    });
    expect(parsed.tracks[1].artists).toEqual(["9mice", "Egor Kreed"]);
  });
});

describe("apple music parsers", () => {
  it("extracts developer token from bundle", () => {
    expect(
      extractAppleMusicToken('const a="eyJhbGciOiJtoken";x={developerToken:a}'),
    ).toBe("eyJhbGciOiJtoken");
    expect(extractAppleMusicToken("foo eyJhbGciOiJabc.def bar")).toBe(
      "eyJhbGciOiJabc.def",
    );
  });

  it("maps catalog tracks", () => {
    const track = mapAppleMusicTrack({
      id: "1",
      attributes: {
        name: "Song",
        artistName: "A & B",
        durationInMillis: 1000,
        albumName: "Album",
        playParams: { id: "99" },
        artwork: { url: "https://x/{w}x{h}.jpg" },
      },
    });
    expect(track).toEqual({
      sourceId: "99",
      title: "Song",
      artists: ["A", "B"],
      durationMs: 1000,
      album: "Album",
      coverUrl: "https://x/400x400.jpg",
    });
  });
});

describe("soundcloud parsers", () => {
  it("reads playlist hydration", () => {
    const hydration = [
      {
        hydratable: "playlist",
        data: { title: " ніков ", tracks: [{ id: 1 }, { id: 2, title: "t" }] },
      },
    ];
    const collection = createSoundCloudCollection();
    applySoundCloudHydration(
      `<script>window.__sc_hydration = ${JSON.stringify(hydration)};</script>`,
      collection,
    );
    expect(collection.title).toBe("ніков");
    expect(collection.rawTracks).toHaveLength(2);
  });

  it("maps tracks with publisher metadata and artwork upscale", () => {
    const track = mapSoundCloudTrack({
      id: 5,
      title: "Artist - Song",
      duration: 1000,
      artwork_url: "https://i1.sndcdn.com/artworks-x-large.jpg",
      publisher_metadata: { artist: "Artist", release_title: "Rel" },
      user: { id: 7, username: "uploader" },
    });
    expect(track).toEqual({
      sourceId: "5",
      title: "Song",
      artists: ["Artist"],
      artistIds: ["sc_user_7"],
      album: "Rel",
      durationMs: 1000,
      coverUrl: "https://i1.sndcdn.com/artworks-x-t500x500.jpg",
    });
    expect(soundCloudCanonicalId("5")).toBe("sc:5");
    expect(soundCloudCanonicalId("sc:5")).toBe("sc:5");
  });

  it("falls back to set artwork, then uploader avatar, when a track has no artwork", () => {
    const base = { id: 6, title: "Rainy Day People", duration: 1000, artwork_url: null, user: { id: 7, username: "uploader", avatar_url: "https://i1.sndcdn.com/avatars-a-large.jpg" } };
    expect(mapSoundCloudTrack(base, "https://i1.sndcdn.com/artworks-set-large.jpg")?.coverUrl).toBe("https://i1.sndcdn.com/artworks-set-t500x500.jpg");
    expect(mapSoundCloudTrack(base)?.coverUrl).toBe("https://i1.sndcdn.com/avatars-a-t500x500.jpg");
    expect(mapSoundCloudTrack({ ...base, user: { id: 7, username: "uploader" } })).not.toHaveProperty("coverUrl");
  });

  it("captures set artwork from hydration", () => {
    const hydration = [{ hydratable: "playlist", data: { title: "Set", artwork_url: "https://i1.sndcdn.com/artworks-set-large.jpg", tracks: [] } }];
    const collection = createSoundCloudCollection();
    applySoundCloudHydration(`<script>window.__sc_hydration = ${JSON.stringify(hydration)};</script>`, collection);
    expect(collection.artworkUrl).toBe("https://i1.sndcdn.com/artworks-set-large.jpg");
  });
});
