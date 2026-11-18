import { showToast } from "@/shared/ui";
import {
  addTracksToPlaylists,
  rememberRecentPlaylists,
  undoAddToPlaylists,
  type AddableTrack,
  type AddToPlaylistsResult,
} from "../services/addToPlaylists";

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

/**
 * One toast for every add flow (picker, submenu, selection bar, shortcuts),
 * with an Undo that deletes exactly the items this add created.
 */
export function reportAddResult(
  result: AddToPlaylistsResult,
  playlistTitles: Map<string, string>,
  trackCount: number,
  t: Translate,
): void {
  const notes: string[] = [];
  if (trackCount > 1 && result.added > 0) {
    notes.push(t("playlist_picker.songs_added", { count: result.added }));
  }
  if (result.alreadyIn > 0 && result.added > 0) {
    notes.push(t("playlist_picker.some_already", { count: result.alreadyIn }));
  }
  if (result.skippedLocal > 0) {
    notes.push(
      t("playlist_picker.local_skipped", { count: result.skippedLocal }),
    );
  }
  const description = notes.join(" · ") || undefined;

  if (result.added > 0) {
    const touched = result.playlistsTouched;
    const message =
      touched.length === 1
        ? t("playlist_picker.added_to", {
            count: 1,
            name: playlistTitles.get(touched[0]) ?? "",
          })
        : t("playlist_picker.added_to", { count: touched.length });
    const items = result.items;
    showToast(message, "checkmark", {
      description,
      action: {
        label: t("playlist_picker.undo"),
        onClick: () => {
          void undoAddToPlaylists(items).then(() =>
            showToast(t("playlist_picker.undone"), "checkmark"),
          );
        },
      },
    });
    return;
  }
  if (result.failed > 0) {
    showToast(t("common.failed_add_playlist"), "error", { description });
    return;
  }
  if (result.alreadyIn > 0) {
    showToast(
      trackCount === 1
        ? t("common.track_already_in_playlist")
        : t("playlist_picker.already_everywhere"),
      "info",
      { description },
    );
    return;
  }
  if (result.skippedLocal > 0) {
    showToast(t("common.failed_add_playlist"), "info", { description });
  }
}

/** add + remember as recent + toast, for one-click entry points */
export async function addAndReport(
  tracks: AddableTrack[],
  playlists: { id: string; title: string }[],
  t: Translate,
): Promise<AddToPlaylistsResult> {
  const ids = playlists.map((p) => p.id);
  const result = await addTracksToPlaylists(tracks, ids);
  if (result.added > 0 || result.alreadyIn > 0) rememberRecentPlaylists(ids);
  reportAddResult(
    result,
    new Map(playlists.map((p) => [p.id, p.title])),
    tracks.length,
    t,
  );
  return result;
}
