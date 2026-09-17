import { memo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ScrollableRow from "@/shared/ui/ScrollableRow";
import CoverImage from "@/features/covers/ui/CoverImage";
import { playerEngine } from "@/features/player";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { useToast, ScrollableText } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { api } from "@/shared/api";
import { notifyLibraryChanged } from "@/features/library/hooks/usePlaylists";
import DropdownMenu, { type DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import type { DailyMix } from "../hooks/useDailyMixes";
import { SparklesFill, PlayFill, AddFill, NewFolderLine } from "@mingcute/react";

interface DailyMixCardProps {
  mix: DailyMix;
}

function DailyMixCard({ mix }: DailyMixCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const trackDoubleClickBehavior = usePlayerStore(
    (state) => state.trackDoubleClickBehavior,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlay = useCallback(() => {
    if (mix.tracks.length === 0) return;
    const firstTrack = mix.tracks[0];
    if (!firstTrack) return;
    void playerEngine.playTrack(
      firstTrack,
      mix.tracks,
      mix.title,
      mix.coverUrl || firstTrack.coverUrl,
    );
  }, [mix]);

  const handleAddQueue = useCallback(() => {
    if (mix.tracks.length === 0) return;
    for (const track of mix.tracks) {
      playerEngine.addToQueue({
        id: track.id,
        title: track.title,
        artists: track.artists,
        coverUrl: track.coverUrl,
        durationMs: track.durationMs,
        playCount: track.playCount ?? 0,
      });
    }
    toast(t("common.added_to_queue"), "checkmark", {
      description: `${mix.title} (${mix.trackCount} ${t("library.tracks")})`,
    });
  }, [mix, toast, t]);

  const handleSaveToLibrary = useCallback(async () => {
    try {
      const playlist = await api.createPlaylist({
        title: mix.title,
        description: mix.description || mix.clusterArtists.join(", "),
      });
      notifyLibraryChanged();
      toast(t("common.added_to_library_success"), "checkmark", {
        description: mix.title,
      });

      // Populate playlist tracks in parallel
      void Promise.all(
        mix.tracks.map((track) =>
          api.addPlaylistTrack(playlist.id, track.id).catch(() => null),
        ),
      ).then(() => {
        notifyLibraryChanged();
      });
    } catch {
      toast(t("common.failed_to_add_library"), "error");
    }
  }, [mix, toast, t]);

  const menuItems: DropdownMenuItem[] = [
    {
      id: "play",
      label: t("artist.play"),
      icon: <PlayFill size={16} />,
      onClick: handlePlay,
    },
    {
      id: "add_to_queue",
      label: t("artist.add_to_queue"),
      icon: <AddFill size={16} />,
      onClick: handleAddQueue,
    },
    {
      id: "add_to_library",
      label: t("common.add_to_library"),
      icon: <NewFolderLine size={16} />,
      onClick: handleSaveToLibrary,
    },
  ];

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (trackDoubleClickBehavior === "queue") {
      handleAddQueue();
    } else {
      handlePlay();
    }
  }, [trackDoubleClickBehavior, handleAddQueue, handlePlay]);

  const handleClick = (e: React.MouseEvent) => {
    const detail = (e as React.MouseEvent<HTMLDivElement>).detail;
    if (detail >= 2) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      handleDoubleClick();
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      navigate(`/collection?type=playlist&id=${encodeURIComponent(mix.id)}`);
    }, 200);
  };

  const subtitleText =
    (mix.clusterArtists && mix.clusterArtists.length > 0
      ? mix.clusterArtists.join(", ")
      : mix.description) || "";

  return (
    <div
      className="group flex-shrink-0 w-[175px] cursor-pointer select-none"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
        {mix.coverUrl && (
          <CoverImage
            src={mix.coverUrl}
            alt={mix.title}
            fill
            sizes="175px"
            className={`object-cover transition-all duration-300 group-hover:brightness-[1.15] ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        )}
      </div>

      <div className="flex flex-col mt-[8px]">
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {mix.title}
        </span>
        <ScrollableText
          text={subtitleText}
          isParentHovered={isCardHovered}
          className="text-[13px] text-text-tertiary"
          fadeColorClass="from-bg-primary"
        />
      </div>

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={(isOpen) => {
            setMenuOpen(isOpen);
            if (!isOpen) setMenuPosition(null);
          }}
          position={menuPosition}
        />
      )}
    </div>
  );
}

export interface DailyMixesSectionProps {
  mixes: DailyMix[];
  headingMarginTop?: string;
}

function DailyMixesSection({ mixes, headingMarginTop = "mt-[22px]" }: DailyMixesSectionProps) {
  const { t } = useTranslation();
  if (mixes.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div className={`${headingMarginTop} px-8 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center shrink-0">
            <SparklesFill className="w-5 h-5 text-amber-400" />
          </div>
          <h2
            className="text-text-primary text-[21px] font-semibold m-0 leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("home.dailyMixes") || "Daily Mixes"}
          </h2>
        </div>
      </div>

      <ScrollableRow className="flex gap-[28px] pl-8 pr-8 mt-[12px] overflow-x-auto pb-[2px]">
        {mixes.map((mix, index) => (
          <DailyMixCard key={`daily-mix-${mix.id}-${index}`} mix={mix} />
        ))}
      </ScrollableRow>
    </div>
  );
}

export default memo(DailyMixesSection);

