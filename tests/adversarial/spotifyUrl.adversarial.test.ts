import { describe, expect, it } from "vitest";
import {
  parseSpotifyUrl,
  isSpotifyId,
  isSpotifyUri,
  toSpotifyUrl,
  toSpotifyPlaylistUrl,
  resolveSpotifyUrl,
  SPOTIFY_ID_REGEX,
  SPOTIFY_URI_REGEX,
} from "@/features/library/services/import/sources/spotify/spotifyUrl";
import {
  detectImportSource,
  ImportUrlError,
} from "@/features/library/services/import/detectImportSource";
import { normalizeImportUrl } from "@/features/library/services/import/shared/url";

describe("Adversarial M1.2: Spotify Raw ID and Base62 Robustness", () => {
  it("accepts valid 22-character Base62 identifiers across boundary characters", () => {
    // Standard real-world playlist IDs
    expect(isSpotifyId("37i9dQZF1DXcBWIGoYBM5M")).toBe(true);
    expect(parseSpotifyUrl("37i9dQZF1DXcBWIGoYBM5M")).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });

    // Boundaries of Base62: all '0', all '9', all 'a', all 'z', all 'A', all 'Z'
    const boundaryIds = [
      "0000000000000000000000",
      "9999999999999999999999",
      "aaaaaaaaaaaaaaaaaaaaaa",
      "zzzzzzzzzzzzzzzzzzzzzz",
      "AAAAAAAAAAAAAAAAAAAAAA",
      "ZZZZZZZZZZZZZZZZZZZZZZ",
      "0123456789abcdefABCDEF", // mixed
    ];

    for (const id of boundaryIds) {
      expect(isSpotifyId(id)).toBe(true);
      expect(parseSpotifyUrl(id)).toEqual({
        type: "playlist",
        id,
      });
    }
  });

  it("handles whitespace padding on raw 22-character Base62 IDs", () => {
    const rawId = "37i9dQZF1DXcBWIGoYBM5M";
    const padded = [
      `  ${rawId}`,
      `${rawId}  `,
      `   ${rawId}   `,
      `\t${rawId}\t`,
      `\n${rawId}\n`,
      `\r\n  ${rawId}  \r\n`,
    ];

    for (const input of padded) {
      expect(isSpotifyId(input)).toBe(true);
      expect(parseSpotifyUrl(input)).toEqual({
        type: "playlist",
        id: rawId,
      });
      expect(detectImportSource(input)).toBe("spotify");
      expect(normalizeImportUrl(input)).toBe(`https://open.spotify.com/playlist/${rawId}`);
    }
  });

  it("rejects raw IDs with invalid characters (non-Base62)", () => {
    // 22-char strings containing Base64 or URL special characters
    const invalidCharIds = [
      "37i9dQZF1DXcBWIGoYBM5+", // '+' is not Base62
      "37i9dQZF1DXcBWIGoYBM5/", // '/' is not Base62
      "37i9dQZF1DXcBWIGoYBM5=", // '=' is not Base62
      "37i9dQZF1DXcBWIGoYBM5-", // '-' is not Base62
      "37i9dQZF1DXcBWIGoYBM5_", // '_' is not Base62
      "37i9dQZF1DXcBWIGoYBM5!", // '!' is not Base62
      "37i9dQZF1DXcBWIGoYBM5$", // '$' is not Base62
      "37i9dQZF1DXcBWIGoYBM5@", // '@' is not Base62
      "37i9dQZF1DXcBWIGoYBM5?", // '?' is not Base62
      "37i9dQZF1 DXcBWIGoYBM5M", // internal space (23 chars)
      "37i9dQZF1DXc BWIGoYBM5", // internal space (22 chars)
    ];

    for (const id of invalidCharIds) {
      expect(isSpotifyId(id)).toBe(false);
      expect(() => parseSpotifyUrl(id)).toThrow();
    }
  });

  it("rejects length off-by-one errors for raw IDs", () => {
    // 21 chars (1 short)
    const id21 = "37i9dQZF1DXcBWIGoYBM5";
    expect(id21.length).toBe(21);
    expect(isSpotifyId(id21)).toBe(false);
    expect(() => parseSpotifyUrl(id21)).toThrow();

    // 23 chars (1 long)
    const id23 = "37i9dQZF1DXcBWIGoYBM5MM";
    expect(id23.length).toBe(23);
    expect(isSpotifyId(id23)).toBe(false);
    expect(() => parseSpotifyUrl(id23)).toThrow();

    // Arbitrary length invalid strings
    expect(isSpotifyId("")).toBe(false);
    expect(isSpotifyId("a")).toBe(false);
    expect(isSpotifyId("1234567890")).toBe(false);
    expect(isSpotifyId("123456789012345678901234567890")).toBe(false);
  });
});

describe("Adversarial M1.2: Spotify URI Robustness", () => {
  it("parses valid Spotify URIs with all supported entity types", () => {
    expect(parseSpotifyUrl("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });
    expect(parseSpotifyUrl("spotify:album:4m2880jivSbbyEGAKfITCa")).toEqual({
      type: "album",
      id: "4m2880jivSbbyEGAKfITCa",
    });
    expect(parseSpotifyUrl("spotify:track:4cOdK2wGLETKBW3PvgPWqT")).toEqual({
      type: "track",
      id: "4cOdK2wGLETKBW3PvgPWqT",
    });
  });

  it("handles case insensitivity and whitespace in Spotify URIs", () => {
    const variations = [
      "SPOTIFY:PLAYLIST:37i9dQZF1DXcBWIGoYBM5M",
      "Spotify:Playlist:37i9dQZF1DXcBWIGoYBM5M",
      "spotify:ALBUM:4m2880jivSbbyEGAKfITCa",
      "spotify:Track:4cOdK2wGLETKBW3PvgPWqT",
      "   spotify:playlist:37i9dQZF1DXcBWIGoYBM5M   ",
      "\tspotify:track:4cOdK2wGLETKBW3PvgPWqT\n",
    ];

    for (const v of variations) {
      expect(isSpotifyUri(v)).toBe(true);
      const parsed = parseSpotifyUrl(v);
      expect(["playlist", "album", "track"]).toContain(parsed.type);
      expect(parsed.id).toBeTruthy();
      expect(detectImportSource(v)).toBe("spotify");
    }
  });

  it("rejects malformed or incomplete Spotify URIs", () => {
    const malformed = [
      "spotify:",
      "spotify:playlist",
      "spotify:playlist:",
      "spotify::37i9dQZF1DXcBWIGoYBM5M",
      ":spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
      "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M:extra",
      "spotify:unknown:37i9dQZF1DXcBWIGoYBM5M",
      "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M?si=12345",
      "spotify/playlist/37i9dQZF1DXcBWIGoYBM5M",
    ];

    for (const input of malformed) {
      expect(isSpotifyUri(input)).toBe(false);
      // Malformed URIs should either fail detection or fail parseSpotifyUrl
      if (input.startsWith("spotify:")) {
        expect(() => parseSpotifyUrl(input)).toThrow();
      }
    }
  });
});

describe("Adversarial M1.2: Localized, Embed, and Parameterized URLs", () => {
  it("parses internationalized paths (intl-xx)", () => {
    const localized = [
      { url: "https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" },
      { url: "https://open.spotify.com/intl-es/playlist/37i9dQZF1DXcBWIGoYBM5M", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" },
      { url: "https://open.spotify.com/intl-pt-BR/playlist/37i9dQZF1DXcBWIGoYBM5M", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" },
      { url: "https://open.spotify.com/intl-ja/album/4m2880jivSbbyEGAKfITCa", type: "album", id: "4m2880jivSbbyEGAKfITCa" },
      { url: "https://open.spotify.com/intl-fr/track/4cOdK2wGLETKBW3PvgPWqT", type: "track", id: "4cOdK2wGLETKBW3PvgPWqT" },
      { url: "https://open.spotify.com/intl-en_US/playlist/37i9dQZF1DXcBWIGoYBM5M", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" },
    ];

    for (const item of localized) {
      expect(parseSpotifyUrl(item.url)).toEqual({
        type: item.type,
        id: item.id,
      });
      expect(detectImportSource(item.url)).toBe("spotify");
    }
  });

  it("parses embed URLs and combinations with intl prefix", () => {
    const embedUrls = [
      { url: "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" },
      { url: "https://open.spotify.com/embed/album/4m2880jivSbbyEGAKfITCa", type: "album", id: "4m2880jivSbbyEGAKfITCa" },
      { url: "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT", type: "track", id: "4cOdK2wGLETKBW3PvgPWqT" },
      { url: "https://open.spotify.com/intl-de/embed/playlist/37i9dQZF1DXcBWIGoYBM5M", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" },
      { url: "https://open.spotify.com/embed/intl-es/playlist/37i9dQZF1DXcBWIGoYBM5M", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" },
    ];

    for (const item of embedUrls) {
      expect(parseSpotifyUrl(item.url)).toEqual({
        type: item.type,
        id: item.id,
      });
      expect(detectImportSource(item.url)).toBe("spotify");
    }
  });

  it("robustly ignores query parameters, tracking tags, fragments, and trailing slashes", () => {
    const complexUrls = [
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=bfd2c0b875144b6c",
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=bfd2c0b875144b6c&pi=u-83921739&utm_source=copy-link&utm_medium=app",
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?nd=1",
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M/",
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M/#header",
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M/?si=abc12345#track-1",
      "http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=test",
      "open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=test",
      "  https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=test  ",
    ];

    for (const url of complexUrls) {
      expect(parseSpotifyUrl(url)).toEqual({
        type: "playlist",
        id: "37i9dQZF1DXcBWIGoYBM5M",
      });
      expect(detectImportSource(url)).toBe("spotify");
    }
  });

  it("handles legacy user playlist URL format", () => {
    const legacyUrl = "https://open.spotify.com/user/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M";
    expect(parseSpotifyUrl(legacyUrl)).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });
  });
});

describe("Adversarial M1.2: False Positives & Non-Spotify Rejection", () => {
  it("rejects YouTube URLs and does not misclassify them as Spotify", () => {
    const youtubeUrls = [
      "https://www.youtube.com/playlist?list=PL12345678901234567890123456789012",
      "https://music.youtube.com/playlist?list=PL12345",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/playlist?list=PL123",
    ];

    for (const url of youtubeUrls) {
      expect(detectImportSource(url)).toBe("youtube");
      expect(() => parseSpotifyUrl(url)).toThrow("Spotify playlist URL or ID is invalid.");
    }
  });

  it("rejects SoundCloud URLs and does not misclassify them as Spotify", () => {
    const soundcloudUrls = [
      "https://soundcloud.com/octobersveryown/sets/care-package",
      "https://m.soundcloud.com/user/sets/playlist",
      "soundcloud.com/angels007kapter/likes",
    ];

    for (const url of soundcloudUrls) {
      expect(detectImportSource(url)).toBe("soundcloud");
      expect(() => parseSpotifyUrl(url)).toThrow("Spotify playlist URL or ID is invalid.");
    }
  });

  it("rejects Apple Music URLs and does not misclassify them as Spotify", () => {
    const appleMusicUrls = [
      "https://music.apple.com/us/playlist/top-100-global/pl.d25f5d1181894928af76c85c967f8f31",
      "https://music.apple.com/ru/album/1708303764",
      "https://itunes.apple.com/us/album/id123456",
      "https://geo.music.apple.com/playlist/pl.123",
    ];

    for (const url of appleMusicUrls) {
      expect(detectImportSource(url)).toBe("apple_music");
      expect(() => parseSpotifyUrl(url)).toThrow("Spotify playlist URL or ID is invalid.");
    }
  });

  it("rejects Deezer URLs and does not misclassify them as Spotify", () => {
    const deezerUrls = [
      "https://www.deezer.com/playlist/3001844422",
      "https://deezer.com/album/12345",
    ];

    for (const url of deezerUrls) {
      expect(detectImportSource(url)).toBe("deezer");
      expect(() => parseSpotifyUrl(url)).toThrow("Spotify playlist URL or ID is invalid.");
    }
  });

  it("blocks domain spoofing, phishing, and attacker subdomains", () => {
    const spoofedUrls = [
      "https://open.spotify.com.attacker.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "https://evil-spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "https://notspotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "https://spotify.link.evil.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "https://evilspotify.link/37i9dQZF1DXcBWIGoYBM5M",
      "https://open.spotify.com@attacker.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    ];

    for (const url of spoofedUrls) {
      expect(() => detectImportSource(url)).toThrow(ImportUrlError);
      expect(() => parseSpotifyUrl(url)).toThrow("Spotify playlist URL or ID is invalid.");
    }
  });

  it("rejects arbitrary garbage strings, injection payloads, and invalid protocols", () => {
    const invalidInputs = [
      "",
      "   ",
      "not-a-url",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///C:/Windows/System32/calc.exe",
      "ftp://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "http://",
      "https://",
      "https://unknown-streaming-service.org/playlist/123",
    ];

    for (const input of invalidInputs) {
      expect(() => parseSpotifyUrl(input)).toThrow();
    }
  });
});

describe("Adversarial M1.2: End-to-End URL Normalization and Resolution", () => {
  it("normalizes raw IDs into canonical playlist URLs", () => {
    const id = "37i9dQZF1DXcBWIGoYBM5M";
    expect(toSpotifyPlaylistUrl(id)).toBe("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
    expect(toSpotifyUrl("playlist", id)).toBe("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
    expect(toSpotifyUrl("album", id)).toBe("https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M");
    expect(toSpotifyUrl("track", id)).toBe("https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M");
  });

  it("resolves raw ID and URIs through resolveSpotifyUrl synchronously without network", async () => {
    const id = "37i9dQZF1DXcBWIGoYBM5M";
    expect(await resolveSpotifyUrl(id)).toBe("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
    expect(await resolveSpotifyUrl(`spotify:playlist:${id}`)).toBe("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
    expect(await resolveSpotifyUrl(`spotify:album:${id}`)).toBe("https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M");
    expect(await resolveSpotifyUrl(`spotify:track:${id}`)).toBe("https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M");
  });

  it("preserves canonical URLs in normalizeImportUrl", () => {
    const rawId = "37i9dQZF1DXcBWIGoYBM5M";
    expect(normalizeImportUrl(rawId)).toBe(`https://open.spotify.com/playlist/${rawId}`);
    expect(normalizeImportUrl(`spotify:playlist:${rawId}`)).toBe(`https://open.spotify.com/playlist/${rawId}`);
    expect(normalizeImportUrl(`spotify:album:${rawId}`)).toBe(`https://open.spotify.com/album/${rawId}`);
    expect(normalizeImportUrl(`spotify:track:${rawId}`)).toBe(`https://open.spotify.com/track/${rawId}`);

    const existingUrl = `https://open.spotify.com/playlist/${rawId}?si=123`;
    expect(normalizeImportUrl(existingUrl)).toBe(existingUrl);
  });
});

describe("Adversarial M1.2: Stress & Fuzzing Harness", () => {
  it("fuzzes 200 random valid Base62 22-char IDs across all alphanumeric permutations", () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let i = 0; i < 200; i++) {
      let id = "";
      for (let j = 0; j < 22; j++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }

      expect(isSpotifyId(id)).toBe(true);
      expect(parseSpotifyUrl(id)).toEqual({ type: "playlist", id });
      expect(detectImportSource(id)).toBe("spotify");
      expect(normalizeImportUrl(id)).toBe(`https://open.spotify.com/playlist/${id}`);
    }
  });

  it("fuzzes 200 invalid length or mutated IDs ensuring zero false acceptances", () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let i = 0; i < 200; i++) {
      // lengths strictly not 22 (from 0 to 40, excluding 22)
      const len = i % 2 === 0 ? Math.floor(Math.random() * 22) : 23 + Math.floor(Math.random() * 20);
      let id = "";
      for (let j = 0; j < len; j++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }

      expect(isSpotifyId(id)).toBe(false);
      // Non-22 length bare strings should fail parseSpotifyUrl
      expect(() => parseSpotifyUrl(id)).toThrow();
    }
  });

  it("fuzzes non-alphanumeric character injections at every position of a 22-char string", () => {
    const base = "37i9dQZF1DXcBWIGoYBM5M";
    const badChars = ["-", "_", ".", "~", "+", "/", "=", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", " "];

    for (let pos = 0; pos < 22; pos++) {
      for (const badChar of badChars) {
        const mutated = base.substring(0, pos) + badChar + base.substring(pos + 1);
        expect(isSpotifyId(mutated)).toBe(false);
        expect(() => parseSpotifyUrl(mutated)).toThrow();
      }
    }
  });

  it("rejects Unicode homoglyph and punycode domain spoofing attacks", () => {
    // Cyrillic 'о' (U+043E) in place of Latin 'o' in open.spotify.com
    const homoglyphUrl = "https://open.sp\u043Etify.com/playlist/37i9dQZF1DXcBWIGoYBM5M";
    expect(() => detectImportSource(homoglyphUrl)).toThrow(ImportUrlError);
    expect(() => parseSpotifyUrl(homoglyphUrl)).toThrow();

    // Cyrillic 'а' (U+0430) in place of Latin 'a' in soundcloud or apple
    const homoglyphApple = "https://music.\u0430pple.com/playlist/123";
    expect(() => parseSpotifyUrl(homoglyphApple)).toThrow();
  });

  it("safely handles URLs with explicit port numbers and credentials", () => {
    // Standard HTTPS port
    const withPort = "https://open.spotify.com:443/playlist/37i9dQZF1DXcBWIGoYBM5M";
    expect(parseSpotifyUrl(withPort)).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });

    // Credential stuffing in URL: should not be tricked into targeting attacker host
    const withCreds = "https://open.spotify.com:secret@attacker.com/playlist/37i9dQZF1DXcBWIGoYBM5M";
    expect(() => parseSpotifyUrl(withCreds)).toThrow();
    expect(() => detectImportSource(withCreds)).toThrow();
  });

  it("handles double slashes and complex nested paths gracefully", () => {
    const doubleSlash = "https://open.spotify.com//playlist//37i9dQZF1DXcBWIGoYBM5M";
    expect(parseSpotifyUrl(doubleSlash)).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });

    const nested = "https://open.spotify.com/intl-en/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?si=123";
    expect(parseSpotifyUrl(nested)).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });
  });

  it("resolves and parses short links (spotify.link)", () => {
    const shortLink = "https://spotify.link/AbCdEfGh";
    expect(detectImportSource(shortLink)).toBe("spotify");
    const parsed = parseSpotifyUrl(shortLink);
    expect(parsed.type).toBe("playlist");
    expect(parsed.id).toBe("AbCdEfGh");
  });
});

