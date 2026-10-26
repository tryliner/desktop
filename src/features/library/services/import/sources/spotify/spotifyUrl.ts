import { rethrowIfAborted } from "@/shared/utils/abort";

export type SpotifyEntityType = "playlist" | "album" | "track";

const ENTITY_TYPES: readonly SpotifyEntityType[] = [
  "playlist",
  "album",
  "track",
];

function asEntityType(
  value: string | undefined,
): SpotifyEntityType | undefined {
  return ENTITY_TYPES.find((type) => type === value);
}

export function parseSpotifyUrl(rawUrl: string): {
  type: SpotifyEntityType;
  id: string;
} {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Spotify playlist URL is invalid.");
  }
  const match = url.pathname.match(
    /(?:embed\/)?(playlist|album|track)\/([a-zA-Z0-9]+)/,
  );
  const matchedType = asEntityType(match?.[1]);
  if (matchedType && match?.[2]) return { type: matchedType, id: match[2] };

  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments.at(-1);
  if (id && /^[a-zA-Z0-9]+$/.test(id)) {
    const typeSegment = segments
      .map(asEntityType)
      .find((type) => type !== undefined);
    return { type: typeSegment ?? "playlist", id };
  }
  throw new Error("Spotify playlist URL is invalid.");
}

export async function resolveSpotifyUrl(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("spotify.link")) {
      const response = await fetch(trimmed, {
        redirect: "follow",
        method: "GET",
        signal,
      });
      if (response.url && !response.url.includes("spotify.link"))
        return response.url;
    }
  } catch {
    rethrowIfAborted(signal);
  }
  return trimmed;
}
