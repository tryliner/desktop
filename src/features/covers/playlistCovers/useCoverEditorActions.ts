import { useState } from "react";
import { showToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { renderCroppedCover } from "./coverCrop";
import { coverErrorMessage } from "./coverErrors";
import { usePlaylistCoversStore } from "./playlistCoverStore";
import type { LoadedImage } from "./useCoverImage";
import { VIEWPORT, type CropState } from "./useCropState";

interface EditorTarget {
  playlistId: string | null;
  playlistTitle: string;
  close: () => void;
}

export function useCoverEditorActions(
  { playlistId, playlistTitle, close }: EditorTarget,
  image: LoadedImage | null,
  crop: CropState,
) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!playlistId || !image || saving) return;
    setSaving(true);
    try {
      const blob =
        image.animated || !image.bitmap
          ? image.blob
          : await renderCroppedCover(
              image.bitmap,
              image.size,
              VIEWPORT,
              crop.zoom,
              crop.offset,
            );
      await usePlaylistCoversStore.getState().setCover(playlistId, blob);
      showToast(t("playlist_cover.saved"), "checkmark", {
        description: playlistTitle,
      });
      close();
    } catch (error) {
      showToast(
        coverErrorMessage(error, t, "playlist_cover.error_save"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!playlistId || saving) return;
    setSaving(true);
    try {
      await usePlaylistCoversStore.getState().removeCover(playlistId);
      showToast(t("playlist_cover.removed"), "checkmark", {
        description: playlistTitle,
      });
      close();
    } catch (error) {
      showToast(
        coverErrorMessage(error, t, "playlist_cover.error_remove"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return { save, remove, saving };
}
