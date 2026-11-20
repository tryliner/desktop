import { mediaUrl, type ApiUserPlaylist } from "@/shared/api";

type CoverOverride = string | null | undefined;

export function customCoverOf(playlist: ApiUserPlaylist): string | undefined {
  return playlist.coverUrl
    ? mediaUrl(playlist.coverUrl) || undefined
    : undefined;
}

export function withCustomCover<
  T extends { coverUrl: string; coverUrls: string[]; customCoverUrl?: string },
>(item: T, override: CoverOverride): T {
  const custom = override === undefined ? item.customCoverUrl : override;
  if (!custom) {
    return item.customCoverUrl === undefined
      ? item
      : { ...item, customCoverUrl: undefined };
  }
  return {
    ...item,
    customCoverUrl: custom,
    coverUrl: custom,
    coverUrls: [custom],
  };
}
