import { describe, expect, it } from "vitest";
import { detectImportSource, ImportUrlError } from "../detectImportSource";
import { parseAppleMusicUrl } from "./appleMusic/appleMusicUrl";
import { parseSpotifyUrl } from "./spotify/spotifyUrl";

describe("detectImportSource", () => {
  it("detects every supported provider", () => {
    expect(
      detectImportSource("https://www.youtube.com/playlist?list=PL123"),
    ).toBe("youtube");
    expect(
      detectImportSource("https://music.youtube.com/playlist?list=PL123"),
    ).toBe("youtube");
    expect(detectImportSource("https://youtu.be/watch?v=123")).toBe("youtube");
    expect(
      detectImportSource("https://m.soundcloud.com/user/sets/playlist"),
    ).toBe("soundcloud");
    expect(detectImportSource("soundcloud.com/angels007kapter/likes")).toBe(
      "soundcloud",
    );
    expect(
      detectImportSource(
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      ),
    ).toBe("spotify");
    expect(detectImportSource("https://spotify.link/abc")).toBe("spotify");
    expect(detectImportSource("https://www.deezer.com/playlist/123456")).toBe(
      "deezer",
    );
    expect(
      detectImportSource("https://music.apple.com/ru/playlist/хиты/pl.123"),
    ).toBe("apple_music");
    expect(
      detectImportSource("https://itunes.apple.com/us/album/id123456"),
    ).toBe("apple_music");
  });

  it("throws for invalid or unsupported URLs", () => {
    expect(() => detectImportSource("not-a-url")).toThrow(ImportUrlError);
    expect(() => detectImportSource("ftp://music.apple.com/playlist")).toThrow(
      ImportUrlError,
    );
    expect(() =>
      detectImportSource("https://unknown-music-site.com/playlist"),
    ).toThrow(ImportUrlError);
  });
});

describe("parseAppleMusicUrl", () => {
  it("normalizes legacy iTunes album IDs for catalog requests", () => {
    expect(
      parseAppleMusicUrl("https://itunes.apple.com/us/album/example/id123456"),
    ).toEqual({ storefront: "us", type: "album", id: "123456" });
  });

  it("parses apple music URLs correctly", () => {
    expect(
      parseAppleMusicUrl(
        "https://music.apple.com/us/playlist/top-100-global/pl.d25f5d1181894928af76c85c967f8f31",
      ),
    ).toEqual({
      storefront: "us",
      type: "playlist",
      id: "pl.d25f5d1181894928af76c85c967f8f31",
    });
    expect(
      parseAppleMusicUrl(
        "https://music.apple.com/playlist/pl.u-76oNkDvsW02Z4l",
      ),
    ).toEqual({
      storefront: "us",
      type: "playlist",
      id: "pl.u-76oNkDvsW02Z4l",
    });
    expect(
      parseAppleMusicUrl("https://music.apple.com/ru/album/1708303764"),
    ).toEqual({
      storefront: "ru",
      type: "album",
      id: "1708303764",
    });
  });

  it("rejects unsupported apple music paths", () => {
    expect(() =>
      parseAppleMusicUrl("https://music.apple.com/us/artist/123"),
    ).toThrow();
  });
});

describe("parseSpotifyUrl", () => {
  it("parses playlist, album, track and embed URLs", () => {
    expect(
      parseSpotifyUrl(
        "https://open.spotify.com/playlist/2Vx56uBwm84LPxHPRHWYCT?si=abc",
      ),
    ).toEqual({
      type: "playlist",
      id: "2Vx56uBwm84LPxHPRHWYCT",
    });
    expect(
      parseSpotifyUrl(
        "https://open.spotify.com/embed/album/4m2880jivSbbyEGAKfITCa",
      ),
    ).toEqual({
      type: "album",
      id: "4m2880jivSbbyEGAKfITCa",
    });
    expect(
      parseSpotifyUrl(
        "https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT",
      ),
    ).toEqual({
      type: "track",
      id: "4cOdK2wGLETKBW3PvgPWqT",
    });
  });
});
