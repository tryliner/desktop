import { showToast } from "@/shared/ui";
import {
  addTracksToPlaylists,
  undoAddToPlaylists,
  type AddableTrack,
  type AddedItem,
  type AddToPlaylistsResult,
} from "../services/addToPlaylists";
import { rememberRecentPlaylists } from "../services/recentPlaylists";

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

function describe(
  result: AddToPlaylistsResult,
  trackCount: number,
  t: Translate,
): string | undefined {
  const notes: string[] = [];
  if (trackCount > 1 && result.added > 0) {
    notes.push(t("playlist_picker.songs_added", { count: result.added }));
  }
  if (result.alreadyIn > 0 && result.added > 0) {
    notes.push(t("playlist_picker.some_already", { count: result.alreadyIn }));
  }
  if (result.failed > 0 && result.added > 0) {
    notes.push(t("playlist_picker.some_failed", { count: result.failed }));
  }
  if (result.skippedLocal > 0) {
    notes.push(
      t("playlist_picker.local_skipped", { count: result.skippedLocal }),
    );
  }
  return notes.join(" · ") || undefined;
}

function undo(items: AddedItem[], t: Translate): void {
  void undoAddToPlaylists(items).then(({ failed }) => {
    if (failed.length === 0) {
      showToast(t("playlist_picker.undone"), "checkmark");
      return;
    }
    showToast(
      t("playlist_picker.undo_failed", { count: failed.length }),
      "error",
      {
        action: {
          label: t("playlist_picker.retry"),
          onClick: () => undo(failed, t),
        },
      },
    );
  });
}

export function reportAddResult(
  result: AddToPlaylistsResult,
  playlistTitles: Map<string, string>,
  trackCount: number,
  t: Translate,
): void {
  const description = describe(result, trackCount, t);
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
    showToast(message, result.failed > 0 ? "info" : "checkmark", {
      description,
      action: {
        label: t("playlist_picker.undo"),
        onClick: () => undo(items, t),
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
