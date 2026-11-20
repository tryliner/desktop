import { useCallback, useState, type RefObject } from "react";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useCreatePlaylist } from "../../../hooks";
import { addTracksToPlaylists } from "../../../services/addToPlaylists";
import { rememberRecentPlaylists } from "../../../services/recentPlaylists";
import { reportAddResult } from "../../../lib/addToPlaylistsFeedback";
import type { TrackDetail } from "../../../store/modalStore";
import type { PickerPlaylist } from "./usePickerRows";

const TITLE_MAX = 20;

export function usePickerActions(
  tracks: TrackDetail[],
  playlists: PickerPlaylist[],
  close: () => void,
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const createPlaylist = useCreatePlaylist();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const resetSelection = useCallback(() => setSelected(new Set()), []);

  const toggle = (playlistId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  };

  const submit = async (ids: string[]) => {
    if (submitting || ids.length === 0 || tracks.length === 0) return;
    setSubmitting(true);
    try {
      const result = await addTracksToPlaylists(tracks, ids);
      if (result.added > 0 || result.alreadyIn > 0) {
        rememberRecentPlaylists(ids);
      }
      reportAddResult(
        result,
        new Map(playlists.map((p) => [p.id, p.title])),
        tracks.length,
        t,
      );
      if (result.failed === 0 || result.added > 0) close();
    } finally {
      setSubmitting(false);
    }
  };

  const create = async (rawTitle: string): Promise<boolean> => {
    const title = rawTitle.trim();
    if (!title || createPlaylist.isPending) return false;
    try {
      const playlist = await createPlaylist.mutateAsync({
        title: title.slice(0, TITLE_MAX),
      });
      setSelected((prev) => new Set(prev).add(playlist.id));
      rememberRecentPlaylists([playlist.id]);
      scrollRef.current?.scrollTo({ top: 0 });
      return true;
    } catch {
      toast(t("common.failed_create_playlist"), "error");
      return false;
    }
  };

  return {
    selected,
    resetSelection,
    toggle,
    submit,
    submitting,
    create,
    creatingPending: createPlaylist.isPending,
    titleMax: TITLE_MAX,
  };
}
