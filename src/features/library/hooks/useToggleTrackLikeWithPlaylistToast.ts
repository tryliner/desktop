import { useCallback } from "react";
import { useTranslation } from "@/languages";
import { isLocalTrackId } from "@/shared/media/local";
import { showToast } from "@/shared/ui";
import { useModalStore, type TrackDetail } from "../store/modalStore";
import { useToggleTrackLike } from "./useLibraryMutations";

export function useToggleTrackLikeWithPlaylistToast() {
  const toggleLike = useToggleTrackLike();
  const { t } = useTranslation();

  return useCallback(
    (track: TrackDetail) => {
      if (isLocalTrackId(track.id)) return;
      toggleLike(track.id, {
        onSuccess: (liked) => {
          if (!liked) return;
          showToast(t("library.added_to_likes"), {
            action: {
              label: t("common.add_to_playlist"),
              onClick: () => useModalStore.getState().openAddToPlaylist(track),
            },
          });
        },
      });
    },
    [t, toggleLike],
  );
}
