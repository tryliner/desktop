import { useCallback } from "react";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import {
  usePlaylistsList,
  useToggleTrackLike,
  useIsTrackLiked,
} from "@/features/library";
import { useTranslation } from "@/languages";
import { showToast } from "@/shared/ui";
import { buildShareUrl } from "@/shared/utils/share";
import { isLocalTrackId } from "@/shared/media/local";
import { useIsTrackCached } from "@/features/library/cached/hooks/useIsTrackCached";
import { removeTrackFromCache } from "@/shared/utils/cacheManager";
import { buildCloudMenu } from "./songMenu/cloudMenu";
import { buildDeviceMenu, withCacheItem } from "./songMenu/deviceMenu";
import type { SongMenuContext } from "./songMenu/types";

export type { SongMenuContext } from "./songMenu/types";

export function useSongMenuItems(ctx: SongMenuContext): DropdownMenuItem[] {
  const { t } = useTranslation();
  const { id, title, artists, searchType } = ctx;

  const { data: playlistsData } = usePlaylistsList();
  const toggleLike = useToggleTrackLike();
  const liked = useIsTrackLiked(id);
  const isTrack = searchType === "track" || !searchType;
  const cached = useIsTrackCached(isTrack ? id : undefined);

  const handleRemoveFromCache = useCallback(() => {
    if (!id) return;
    void removeTrackFromCache(id).then(() => {
      showToast(t("common.removed_from_cache"), "checkmark", {
        description: artists ? `${title} — ${artists}` : title,
      });
    });
  }, [id, title, artists, t]);

  const handleLike = useCallback(() => {
    if (!id) return;
    toggleLike(id);
  }, [id, toggleLike]);

  const handleShare = useCallback(() => {
    if (!id) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      const type =
        (searchType as "track" | "album" | "artist" | "playlist") || "track";
      void navigator.clipboard.writeText(buildShareUrl(type, id));
      showToast(t("common.link_copied"), "checkmark", {
        description: artists ? `${title} — ${artists}` : title,
      });
    }
  }, [id, searchType, title, artists, t]);

  const items = buildCloudMenu(
    ctx,
    { liked, handleLike, handleShare, playlistsData },
    t,
  );
  if (isLocalTrackId(id)) return buildDeviceMenu(items, ctx, t);
  return cached ? withCacheItem(items, t, handleRemoveFromCache) : items;
}
