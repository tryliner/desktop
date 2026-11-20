import { PlaylistCoverError } from "./playlistCoverStore";

export function coverErrorMessage(
  error: unknown,
  t: (key: string) => string,
  fallbackKey: string,
): string {
  const reason = error instanceof PlaylistCoverError ? error.reason : "";
  if (reason === "unsupported-type") return t("playlist_cover.error_type");
  if (reason === "too-large") return t("playlist_cover.error_size");
  if (reason === "unavailable") return t("playlist_cover.error_unavailable");
  return t(fallbackKey);
}
