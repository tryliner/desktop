import type { StoreApi, UseBoundStore } from "zustand";
import { api } from "@/shared/api";
import { isLocalTrackId } from "@/shared/media/local";
import { showToast } from "@/shared/ui";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import { notifyLibraryChanged } from "../hooks/usePlaylists";
import { addLocalTrackToPlaylist } from "../local/lib/addLocalTrackToPlaylist";
import type { ActiveImportState } from "./importStore";

export function watchPendingTrackAfterImport(
  store: UseBoundStore<StoreApi<ActiveImportState>>,
): void {
  let lastHandledJobId: string | null = null;

  store.subscribe((state) => {
    const { job, pendingTrack } = state;
    if (!job || job.status !== "completed" || !job.playlistId || !pendingTrack)
      return;
    if (job.id === lastHandledJobId) return;
    lastHandledJobId = job.id;
    const playlistId = job.playlistId;

    store.setState({ pendingTrack: null });

    void (async () => {
      const translate = createTranslatorSync(getStoredLocale());
      try {
        if (isLocalTrackId(pendingTrack.id)) {
          const result = await addLocalTrackToPlaylist(
            playlistId,
            pendingTrack.id,
          );
          if (result === "missing") throw new Error("local file is gone");
          showToast(translate("common.added_to_playlist"), "checkmark", {
            description: pendingTrack.title || undefined,
          });
          return;
        }
        await api.addPlaylistTrack(playlistId, pendingTrack.id);
        notifyLibraryChanged();
        showToast(translate("common.added_to_playlist"), "checkmark", {
          description: pendingTrack.title || undefined,
        });
      } catch {
        showToast(translate("common.failed_add_playlist"), "error");
      }
    })();
  });
}
