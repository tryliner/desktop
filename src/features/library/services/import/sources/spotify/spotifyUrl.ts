import { rethrowIfAborted } from "@/shared/utils/abort";

export type SpotifyEntityType = "playlist" | "album" | "track";

const ENTITY_TYPES: readonly SpotifyEntityType[] = ["playlist", "album", "track"];

export const SPOTIFY_ID_REGEX = /^[a-zA-Z0-9]{22}$/;
export const SPOTIFY_URI_REGEX = /^spotify:(playlist|album|track):([a-zA-Z0-9]+)$/i;

function asEntityType(value: string | undefined): SpotifyEntityType | undefined {
  if (!value) return undefined;
  return ENTITY_TYPES.find((type) => type === value.toLowerCase());
}

export function isSpotifyId(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return SPOTIFY_ID_REGEX.test(value.trim());
}

export function isSpotifyUri(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return SPOTIFY_URI_REGEX.test(value.trim());
}

export function toSpotifyUrl(type: SpotifyEntityType, id: string): string {
  return `https://open.spotify.com/${type}/${id}`;
}

export function toSpotifyPlaylistUrl(id: string): string {
  return toSpotifyUrl("playlist", id);
}

export function parseSpotifyUrl(rawUrl: string): { type: SpotifyEntityType; id: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Spotify playlist URL or ID is invalid.");
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Spotify playlist URL or ID is invalid.");
  }

  // Raw 22-character Base62 ID defaults to playlist
  if (SPOTIFY_ID_REGEX.test(trimmed)) {
    return { type: "playlist", id: trimmed };
  }

  // Spotify URI e.g. spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const uriMatch = trimmed.match(SPOTIFY_URI_REGEX);
  if (uriMatch) {
    const entityType = asEntityType(uriMatch[1]);
    if (entityType && uriMatch[2]) {
      return { type: entityType, id: uriMatch[2] };
    }
  }

  // Standard or internationalized web URL
  let url: URL;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    url = new URL(candidate);
  } catch {
    throw new Error("Spotify playlist URL or ID is invalid.");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const isSpotifyHost = host === "spotify.com" || host.endsWith(".spotify.com") || host === "spotify.link";
  if (!isSpotifyHost) {
    throw new Error("Spotify playlist URL or ID is invalid.");
  }

  // Match /playlist/:id, /intl-xx/playlist/:id, /embed/album/:id, etc.
  const match = url.pathname.match(/(?:(?:embed|intl-[a-zA-Z0-9_-]+)\/)*(playlist|album|track)\/([a-zA-Z0-9]+)/i);
  const matchedType = asEntityType(match?.[1]);
  if (matchedType && match?.[2]) {
    return { type: matchedType, id: match[2] };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments.at(-1);
  if (id && /^[a-zA-Z0-9]+$/.test(id)) {
    const typeSegment = segments.map(asEntityType).find((type) => type !== undefined);
    return { type: typeSegment ?? "playlist", id };
  }

  throw new Error("Spotify playlist URL or ID is invalid.");
}

export async function resolveSpotifyUrl(rawUrl: string, signal?: AbortSignal): Promise<string> {
  const trimmed = rawUrl.trim();
  if (isSpotifyId(trimmed)) {
    return toSpotifyPlaylistUrl(trimmed);
  }
  if (isSpotifyUri(trimmed)) {
    const parsed = parseSpotifyUrl(trimmed);
    return toSpotifyUrl(parsed.type, parsed.id);
  }

  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (url.hostname.includes("spotify.link")) {
      const response = await fetch(trimmed, { redirect: "follow", method: "GET", signal });
      if (response.url && !response.url.includes("spotify.link")) return response.url;
    }
    return candidate;
  } catch {
    rethrowIfAborted(signal);
  }
  return trimmed;
}
