import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { playerEngine } from "../engine/playerEngine";
import { usePlayerStore } from "../store/playerStore";
import { useSongMenuItems, type SongMenuContext } from "./useSongMenuItems";

export type SongCardMenuInput = SongMenuContext & { onPlay?: () => void };

function parseDurationMs(duration: string | undefined): number {
  if (!duration) return 0;
  const parts = duration.split(":").map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3)
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

export function useSongCardMenu(input: SongCardMenuInput) {
  const { id, title, artists, coverUrl, duration, durationMs, onPlay } = input;
  const { t } = useTranslation();
  const { toast } = useToast();
  const trackDoubleClickBehavior = usePlayerStore(
    (state) => state.trackDoubleClickBehavior,
  );

  const resolvedDurationMs = useMemo(
    () => durationMs ?? parseDurationMs(duration),
    [duration, durationMs],
  );

  const menuItems = useSongMenuItems({
    ...input,
    durationMs: resolvedDurationMs,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleDoubleClick = useCallback(() => {
    if (!id) return;
    if (trackDoubleClickBehavior === "queue") {
      playerEngine.addToQueue({
        id,
        title,
        artists,
        coverUrl,
        durationMs: resolvedDurationMs,
        playCount: 0,
      });
      toast(t("common.added_to_queue"), "checkmark", {
        description: artists ? `${title} — ${artists}` : title,
      });
    } else if (onPlay) {
      onPlay();
    }
  }, [
    trackDoubleClickBehavior,
    id,
    title,
    artists,
    coverUrl,
    resolvedDurationMs,
    onPlay,
    toast,
    t,
  ]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (menuItems.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
    },
    [menuItems],
  );

  const handleMenuOpenChange = useCallback((isOpen: boolean) => {
    setMenuOpen(isOpen);
    if (!isOpen) setMenuPosition(null);
  }, []);

  return {
    menuItems,
    menuOpen,
    menuPosition,
    handleDoubleClick,
    handleContextMenu,
    handleMenuOpenChange,
  };
}
