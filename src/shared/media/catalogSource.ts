import type { CatalogSource } from "@/shared/contracts";

export function catalogSourceForTrack(
  id?: string,
  source?: CatalogSource,
): CatalogSource | undefined {
  if (source) return source;
  const trimmed = id?.trim();
  if (!trimmed) return undefined;
  if (/^(?:sc:|soundcloud:(?:tracks?:)?)?\d+$/.test(trimmed)) return "soundcloud";
  if (/^(?:yt:)?[a-zA-Z0-9_-]{11}$/.test(trimmed)) return "youtube";
  return undefined;
}
