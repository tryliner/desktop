import { useState } from "react";
import { PicLine } from "@mingcute/react";
import { useCoverEditorStore } from "@/features/covers";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";

interface PlaylistCoverOverlayProps {
  playlistId: string;
  playlistTitle: string;
  currentCover: string | null;
  trackCovers: string[];
}

export function openPlaylistCoverEditor(
  props: PlaylistCoverOverlayProps,
  file?: File,
) {
  useCoverEditorStore.getState().openEditor({ ...props, file });
}

export function PlaylistCoverOverlay(props: PlaylistCoverOverlayProps) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  return (
    <button
      type="button"
      aria-label={t("playlist_cover.choose_photo")}
      data-own-drop
      onClick={() => openPlaylistCoverEditor(props)}
      onDragOver={(e) => {
        if ([...e.dataTransfer.items].some((item) => item.kind === "file")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) openPlaylistCoverEditor(props, file);
      }}
      className={cn(
        "absolute inset-0 z-[1] flex cursor-pointer flex-col items-center justify-center gap-[6px] border-none bg-black/0 p-0 text-white opacity-0 transition-[opacity,background-color] duration-150 hover:bg-black/45 hover:opacity-100 focus-visible:bg-black/45 focus-visible:opacity-100",
        dragOver && "!bg-black/55 !opacity-100",
      )}
    >
      <PicLine size={28} />
      <span className="text-label font-[600]">
        {t("playlist_cover.choose_photo")}
      </span>
    </button>
  );
}
