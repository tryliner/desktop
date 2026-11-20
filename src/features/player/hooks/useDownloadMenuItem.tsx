import { useMemo } from "react";
import { LuDownload, LuCircleMinus } from "react-icons/lu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import {
  canDownloadHere,
  downloadTracks,
  removeTrackDownloads,
  useTrackDownloadState,
} from "@/features/library";
import { useTranslation } from "@/languages";

interface DownloadableTrack {
  id: string;
  title: string;
  artists: string;
  coverUrl: string;
  durationMs?: number;
}

export function useDownloadMenuItem(
  track: DownloadableTrack | null,
): DropdownMenuItem | null {
  const { t } = useTranslation();
  const download = useTrackDownloadState(track?.id);
  const { state, pinned, pinnedDirectly } = download;
  return useMemo(() => {
    if (!track || !canDownloadHere()) return null;
    if (pinned) {
      return pinnedDirectly
        ? {
            id: "remove-download",
            label: t("downloads.remove"),
            icon: <LuCircleMinus size={15} />,
            onClick: () => removeTrackDownloads([track.id], t),
          }
        : null;
    }
    if (state === "downloaded") return null;
    return {
      id: "download-track",
      label: t("downloads.download"),
      icon: <LuDownload size={15} />,
      onClick: () =>
        downloadTracks([{ ...track, durationMs: track.durationMs ?? 0 }], t),
    };
  }, [track, pinned, pinnedDirectly, state, t]);
}
