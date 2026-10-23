export function safeSoundCloudExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return undefined;
    if (hostname !== "soundcloud.com" && !hostname.endsWith(".soundcloud.com")) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}
