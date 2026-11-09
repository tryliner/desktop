// base url of the share-link redirector (local testing: http://localhost:1193)
export const SHARE_BASE_URL =
  (import.meta.env.VITE_SHARE_BASE_URL as string | undefined)?.replace(
    /\/+$/,
    "",
  ) || "https://link.tryliner.fun";

export type ShareEntityType = "artist" | "album" | "playlist" | "track";

// builds a public share link, the redirector bounces it to the liner:// deeplink
export function buildShareUrl(type: ShareEntityType, id: string): string {
  return `${SHARE_BASE_URL}/${type}?id=${encodeURIComponent(id)}`;
}
