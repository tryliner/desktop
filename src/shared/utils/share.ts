import { getApiBaseUrl } from "@/shared/api/baseUrl";
// base url of the share-link redirector (local testing: http://localhost:1193)
const PRODUCTION_SHARE_BASE_URL = "https://link.tryliner.fun";
const STAGING_API_HOST = "staging.tryliner.fun";

export function resolveShareBaseUrl(
  configured: string | undefined,
  apiBaseUrl: string,
): string {
  const clean = configured?.trim().replace(/\/+$/, "");
  if (clean) return clean;
  try {
    const api = new URL(apiBaseUrl);
    if (api.hostname === STAGING_API_HOST) return `${api.origin}/link`;
  } catch {
    return PRODUCTION_SHARE_BASE_URL;
  }
  return PRODUCTION_SHARE_BASE_URL;
}

export const SHARE_BASE_URL = resolveShareBaseUrl(
  import.meta.env.VITE_SHARE_BASE_URL as string | undefined,
  getApiBaseUrl(),
);

export type ShareEntityType = "artist" | "album" | "playlist" | "track";

// builds a public share link, the redirector bounces it to the liner:// deeplink
export function buildShareUrl(type: ShareEntityType, id: string): string {
  return `${SHARE_BASE_URL}/${type}?id=${encodeURIComponent(id)}`;
}
