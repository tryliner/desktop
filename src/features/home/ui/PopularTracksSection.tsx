import { memo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ScrollableRow from "@/shared/ui/ScrollableRow";
import useHorizontalScroll from "@/shared/hooks/useHorizontalScroll";
import { LeftLine, RightLine } from "@mingcute/react";
import { playerEngine } from "@/features/player";
import { useSongMenuItems } from "@/features/player/hooks/useSongMenuItems";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { useToast } from "@/shared/ui";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import type { PopularItem } from "../hooks/usePopularTracks";
import type { Track } from "@/shared/types";
import ArtistLink from "@/features/artist/ui/ArtistLink";
import CoverImage from "@/features/covers/ui/CoverImage";
import ExplicitBadge from "@/shared/ui/ExplicitBadge";
import { useTranslation } from "@/languages";

export interface PopularTracksSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  items: PopularItem[];
  showRanks?: boolean;
  headingMarginTop?: string;
  rowClassName?: string;
}

function TrackCard({
  item,
  index,
  showRanks,
}: {
  item: PopularItem & { type: "track" };
  index: number;
  showRanks?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();
  const { toast } = useToast();
  const trackDoubleClickBehavior = usePlayerStore(
    (state) => state.trackDoubleClickBehavior,
  );

  const menuItems = useSongMenuItems({
    id: item.item.id,
    title: item.item.title,
    artists: item.item.artists,
    coverUrl: item.item.coverUrl,
    durationMs: item.item.durationMs,
    searchType: "track",
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

  const handlePlay = useCallback(() => {
    void playerEngine.playTrack(
      item.item,
      [item.item],
      `${item.item.title} Radio`,
      item.item.coverUrl,
    );
  }, [item.item]);

  const handleDoubleClick = useCallback(() => {
    if (trackDoubleClickBehavior === "queue") {
      playerEngine.addToQueue({
        id: item.item.id,
        title: item.item.title,
        artists: item.item.artists,
        coverUrl: item.item.coverUrl,
        durationMs: item.item.durationMs,
        playCount: item.item.playCount ?? 0,
      });
      toast(t("common.added_to_queue"), "checkmark", {
        description: item.item.artists
          ? `${item.item.title} — ${item.item.artists}`
          : item.item.title,
      });
    } else {
      handlePlay();
    }
  }, [trackDoubleClickBehavior, item.item, handlePlay, toast, t]);

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
      handlePlay();
    }, 200);
  };

  return (
    <div
      className="group flex-shrink-0 w-[175px] cursor-pointer select-none"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
        {showRanks && (
          <div
            className={`absolute top-2 left-2 z-10 flex items-center justify-center min-w-[22px] h-[20px] px-1 rounded-[3px] text-[10px] font-bold tracking-tight ${
              index === 0
                ? "bg-amber-400 text-black"
                : index === 1
                  ? "bg-slate-200 text-black"
                  : index === 2
                    ? "bg-amber-700 text-white"
                    : "bg-bg-panel text-text-secondary"
            }`}
          >
            #{index + 1}
          </div>
        )}

        {item.item.coverUrl && (
          <CoverImage
            src={item.item.coverUrl}
            alt={item.item.title}
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
          {item.item.title}
        </span>
        <div className="flex min-w-0 items-center overflow-hidden text-[13px] text-text-tertiary">
          {item.item.explicit && <ExplicitBadge size="md" className="mr-[6px] shrink-0" />}
          <ArtistLink
            name={item.item.artists}
            artistId={item.item.artistId}
            artistList={item.item.artistList}
            className="text-[13px] text-text-tertiary"
          />
        </div>
      </div>

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={handleMenuOpenChange}
          position={menuPosition}
        />
      )}
    </div>
  );
}

function AlbumCard({
  item,
  index,
  showRanks,
}: {
  item: PopularItem & { type: "album" };
  index: number;
  showRanks?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const navigate = useNavigate();

  const menuItems = useSongMenuItems({
    id: item.item.id,
    title: item.item.title,
    artists: item.item.artist,
    coverUrl: item.item.coverUrl,
    searchType: "album",
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

  const handleClick = () => {
    navigate(
      `/collection?type=album&id=${encodeURIComponent(item.item.id)}`,
    );
  };

  return (
    <div
      className="group flex-shrink-0 w-[175px] cursor-pointer select-none"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
        {showRanks && (
          <div className="absolute top-2 left-2 z-10 flex items-center justify-center min-w-[22px] h-[20px] px-1 rounded-[3px] text-[10px] font-bold tracking-tight bg-bg-panel text-text-secondary">
            #{index + 1}
          </div>
        )}
        {item.item.coverUrl && (
          <CoverImage
            src={item.item.coverUrl}
            alt={item.item.title}
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
          {item.item.title}
        </span>
        <div className="flex min-w-0 items-center overflow-hidden text-[13px] text-text-tertiary">
          {item.item.explicit && <ExplicitBadge size="md" className="mr-[6px] shrink-0" />}
          <span className="truncate text-[13px] text-text-tertiary">
            {item.item.artist}
          </span>
        </div>
      </div>

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={handleMenuOpenChange}
          position={menuPosition}
        />
      )}
    </div>
  );
}

function PlaylistCard({
  item,
  index,
  showRanks,
}: {
  item: PopularItem & { type: "playlist" };
  index: number;
  showRanks?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const navigate = useNavigate();

  const menuItems = useSongMenuItems({
    id: item.item.id,
    title: item.item.title,
    artists: item.item.owner,
    coverUrl: item.item.coverUrl,
    searchType: "playlist",
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

  const handleClick = () => {
    navigate(
      `/collection?type=playlist&id=${encodeURIComponent(item.item.id)}`,
    );
  };

  return (
    <div
      className="group flex-shrink-0 w-[175px] cursor-pointer select-none"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
        {showRanks && (
          <div className="absolute top-2 left-2 z-10 flex items-center justify-center min-w-[22px] h-[20px] px-1 rounded-[3px] text-[10px] font-bold tracking-tight bg-bg-panel text-text-secondary">
            #{index + 1}
          </div>
        )}
        {item.item.coverUrl && (
          <CoverImage
            src={item.item.coverUrl}
            alt={item.item.title}
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
          {item.item.title}
        </span>
        <span className="truncate text-[13px] text-text-tertiary">
          {item.item.owner}
        </span>
      </div>

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={handleMenuOpenChange}
          position={menuPosition}
        />
      )}
    </div>
  );
}

function ArtistCard({ item }: { item: PopularItem & { type: "artist" } }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const menuItems = useSongMenuItems({
    id: item.item.id,
    title: item.item.name,
    artists: "",
    coverUrl: item.item.imageUrl || "",
    searchType: "artist",
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

  const handleClick = () => {
    navigate(`/artist?id=${encodeURIComponent(item.item.id)}`);
  };

  return (
    <div
      className="group flex-shrink-0 w-[175px] cursor-pointer select-none"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-full bg-border-alpha-14">
        {item.item.imageUrl && (
          <CoverImage
            src={item.item.imageUrl}
            alt={item.item.name}
            fill
            sizes="175px"
            className={`object-cover transition-all duration-300 group-hover:brightness-[1.15] ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        )}
      </div>
      <div className="flex flex-col mt-[8px] items-center text-center">
        <span className="truncate w-full text-[14px] font-[500] text-text-primary">
          {item.item.name}
        </span>
        <span className="truncate w-full text-[13px] text-text-tertiary">
          {t("artist.listeners", { count: item.item.followers })}
        </span>
      </div>

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={handleMenuOpenChange}
          position={menuPosition}
        />
      )}
    </div>
  );
}

function PopularItemCard({
  item,
  index,
  showRanks,
}: {
  item: PopularItem;
  index: number;
  showRanks?: boolean;
}) {
  switch (item.type) {
    case "track":
      return (
        <TrackCard
          item={item}
          index={index}
          showRanks={showRanks}
        />
      );
    case "album":
      return <AlbumCard item={item} index={index} showRanks={showRanks} />;
    case "playlist":
      return <PlaylistCard item={item} index={index} showRanks={showRanks} />;
    case "artist":
      return <ArtistCard item={item} />;
  }
}

function PopularTracksSection({
  title,
  subtitle,
  icon,
  badge,
  items,
  showRanks = false,
  headingMarginTop = "mt-[32px]",
  rowClassName = "",
}: PopularTracksSectionProps) {
  const scrollController = useHorizontalScroll();
  const { canScrollLeft, canScrollRight, scrollPrev, scrollNext } =
    scrollController;
  const showNav = canScrollLeft || canScrollRight;

  return (
    <div className="flex flex-col">
      <div className={`${headingMarginTop} px-8 flex items-center justify-between`}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            {icon && <div className="flex items-center shrink-0">{icon}</div>}
            <h2
              className="text-text-primary text-[21px] font-semibold m-0 leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <p className="text-[13px] text-text-tertiary m-0 mt-0.5 font-normal">
              {subtitle}
            </p>
          )}
        </div>

        {showNav && (
          <div className="flex items-center gap-1.5 shrink-0 select-none">
            <button
              type="button"
              onClick={scrollPrev}
              disabled={!canScrollLeft}
              aria-label="Previous"
              className="flex items-center justify-center w-[28px] h-[28px] rounded-full bg-border-alpha-14 text-text-secondary hover:text-text-primary hover:bg-border-alpha-33 active:scale-95 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer border-none"
            >
              <LeftLine size={16} />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              disabled={!canScrollRight}
              aria-label="Next"
              className="flex items-center justify-center w-[28px] h-[28px] rounded-full bg-border-alpha-14 text-text-secondary hover:text-text-primary hover:bg-border-alpha-33 active:scale-95 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer border-none"
            >
              <RightLine size={16} />
            </button>
          </div>
        )}
      </div>

      <ScrollableRow
        controller={scrollController}
        className={`flex gap-[28px] pl-8 pr-8 mt-[16px] overflow-x-auto pb-[20px] ${rowClassName}`}
      >
        {items.map((item, index) => (
          <PopularItemCard
            key={`${item.type}-${item.item.id}-${index}`}
            item={item}
            index={index}
            showRanks={showRanks}
          />
        ))}
      </ScrollableRow>
    </div>
  );
}

export default memo(PopularTracksSection);
