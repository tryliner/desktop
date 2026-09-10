// liner:// deeplink parsing, shared by main process (no electron imports here
// so vitest can cover it). same strict allowlist as the link server: fixed
// entity types, opaque catalog tokens only.
export const DEEP_LINK_SCHEME = "liner";

const DEEP_LINK_IDS: Record<string, RegExp> = {
  // youtube channel ids, always UC + 22 base64url chars
  artist: /^UC[A-Za-z0-9_-]{22}$/,
  // innertube album browse ids, e.g. MPREb_xCxkOKReFZv
  album: /^MPRE[A-Za-z0-9_-]{4,64}$/,
  // catalog playlists (VLPL…/PL…) and user playlists (uuid / pl-…),
  // all just opaque tokens from the same safe charset
  playlist: /^[A-Za-z0-9_-]{8,64}$/,
  // youtube video ids are always 11 base64url chars
  track: /^[A-Za-z0-9_-]{11}$/,
};

export interface DeeplinkTarget {
  type: "artist" | "album" | "playlist" | "track";
  id: string;
}

export function parseDeeplink(raw: string): DeeplinkTarget | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== `${DEEP_LINK_SCHEME}:`) return null;
  const type = url.hostname.toLowerCase();
  const pattern = DEEP_LINK_IDS[type];
  if (!pattern) return null;
  // exactly one id param, extras rejected so ?id=a&id=b can't pick a winner
  const ids = url.searchParams.getAll("id");
  if (ids.length !== 1) return null;
  const id = ids[0]!;
  if (!pattern.test(id)) return null;
  return { type: type as DeeplinkTarget["type"], id };
}

export function findDeeplinkArg(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`));
}
