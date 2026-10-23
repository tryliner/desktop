export type ProfileShareMode = "canonical" | "public" | "deeplink";

export function buildProfileShareUrl(
  handle: string,
  mode: ProfileShareMode = "canonical"
): string {
  const clean = (handle || "").replace(/^@/, "").trim();
  if (mode === "deeplink") {
    return `liner://user/${encodeURIComponent(clean)}`;
  }
  if (mode === "public") {
    return `https://tryliner.fun/user/${encodeURIComponent(clean)}`;
  }
  // Canonical tested format (R2-T6, Tier 4)
  return `https://liner.fun/profile/${encodeURIComponent(clean)}`;
}

export async function copyProfileShareLink(
  handle: string,
  mode: ProfileShareMode = "canonical"
): Promise<string> {
  const url = buildProfileShareUrl(handle, mode);
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(url);
  }
  return url;
}
