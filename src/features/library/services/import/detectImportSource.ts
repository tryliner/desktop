import type { ImportSource } from "@/shared/contracts";
import { isYoutubeHost } from "@/shared/youtube";
import { normalizeImportUrl } from "./shared/url";

export class ImportUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportUrlError";
  }
}

const SPOTIFY_HOSTS = ["open.spotify.com", "spotify.com", "spotify.link"];
const APPLE_MUSIC_HOSTS = [
  "music.apple.com",
  "geo.music.apple.com",
  "itunes.apple.com",
];

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function detectImportSource(rawUrl: string): ImportSource {
  let url: URL;
  try {
    url = new URL(normalizeImportUrl(rawUrl));
  } catch {
    throw new ImportUrlError("Import URL must be a valid absolute URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportUrlError("Import URL must use HTTP or HTTPS.");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (isYoutubeHost(host)) return "youtube";
  if (hostMatches(host, "soundcloud.com")) return "soundcloud";
  if (SPOTIFY_HOSTS.includes(host) || host.endsWith(".spotify.com"))
    return "spotify";
  if (hostMatches(host, "deezer.com")) return "deezer";
  if (APPLE_MUSIC_HOSTS.includes(host) || host.endsWith(".music.apple.com"))
    return "apple_music";
  throw new ImportUrlError(`Unsupported import host: ${host}.`);
}
