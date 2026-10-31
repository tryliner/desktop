import type { StoreApi, UseBoundStore } from "zustand";
import { api, planLimitMessage } from "@/shared/api";
import { showToast } from "@/shared/ui";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import { notifyLibraryChanged } from "../hooks/usePlaylists";
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
        const { added } = await api.addPlaylistTrack(
          playlistId,
          pendingTrack.id,
        );
        if (added === 0) throw new Error("track was rejected");
        notifyLibraryChanged();
        showToast(translate("common.added_to_playlist"), "checkmark", {
          description: pendingTrack.title || undefined,
        });
      } catch (err) {
        showToast(
          planLimitMessage(err, translate) ??
            translate("common.failed_add_playlist"),
          "error",
        );
      }
    })();
  });
}
