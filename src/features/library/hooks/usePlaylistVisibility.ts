import { useCallback } from "react";
import { api, ApiError } from "@/shared/api";
import { showToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { buildShareUrl } from "@/shared/utils/share";
import { applyPlaylistVisibility, notifyLibraryChanged } from "./usePlaylists";

// visibility of the user's own playlists: a private one has no share link, the server answers
// it to nobody but the owner
export function usePlaylistVisibility() {
  const { t } = useTranslation();

  const changeVisibility = useCallback(
    async (
      id: string,
      isPublic: boolean,
      options: { quiet?: boolean } = {},
    ): Promise<boolean> => {
      applyPlaylistVisibility(id, isPublic);
      try {
        const playlist = await api.setPlaylistVisibility(id, isPublic);
        applyPlaylistVisibility(id, playlist.isPublic);
        // the revision moved: the details reload so reorders send the new one
        notifyLibraryChanged();
        if (!options.quiet) {
          showToast(
            t(
              playlist.isPublic
                ? "playlist.made_public"
                : "playlist.made_private",
            ),
            "checkmark",
          );
        }
        return true;
      } catch (err) {
        applyPlaylistVisibility(id, !isPublic);
        // network and server errors already have their toast from the http layer
        if (err instanceof ApiError && err.status < 500) {
          showToast(t("playlist.visibility_failed"), "error", {
            requestId: err.requestId,
            errorCode: err.code,
          });
        }
        return false;
      }
    },
    [t],
  );

  const sharePlaylist = useCallback(
    (id: string, isPublic: boolean | undefined, title?: string) => {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      const copy = () => {
        void navigator.clipboard.writeText(buildShareUrl("playlist", id));
        showToast(t("common.link_copied"), "checkmark", {
          description: title || undefined,
        });
      };
      if (isPublic) {
        copy();
        return;
      }
      showToast(t("playlist.share_private"), "info", {
        id: `playlist-share-private-${id}`,
        description: title || undefined,
        action: {
          label: t("playlist.make_public"),
          onClick: () =>
            void changeVisibility(id, true, { quiet: true }).then(
              (done) => done && copy(),
            ),
        },
      });
    },
    [changeVisibility, t],
  );

  return { changeVisibility, sharePlaylist };
}
