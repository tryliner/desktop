export type AppleMusicEntityType = "playlist" | "album";

export interface AppleMusicTarget {
  storefront: string;
  type: AppleMusicEntityType;
  id: string;
}

export function parseAppleMusicUrl(rawUrl: string): AppleMusicTarget {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Apple Music playlist URL is invalid.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  let storefront = "us";
  if (segments[0] && /^[a-z]{2}$/i.test(segments[0])) {
    storefront = segments[0].toLowerCase();
    segments.shift();
  }

  const typeSegment = segments[0]?.toLowerCase();
  const type =
    typeSegment === "album"
      ? "album"
      : typeSegment === "playlist"
        ? "playlist"
        : undefined;
  const id = segments.at(-1);
  if (!type || !id) throw new Error("Apple Music playlist URL is invalid.");
  return {
    storefront,
    type,
    id: type === "album" ? id.replace(/^id(?=\d+$)/, "") : id,
  };
}
