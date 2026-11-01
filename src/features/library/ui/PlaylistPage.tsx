import { useSearchParams } from "react-router-dom";
import { preloadCoverArt } from "@/features/covers/lib/coverArt";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
  Suspense,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import PlaylistPageSkeleton from "./PlaylistPageSkeleton";
import {
  useToast,
  ReorderDropPlaceholder,
  FloatingDragCard,
  EntityHero,
  HERO_TITLE_CLASS,
  HERO_SUBTITLE_CLASS,
  HERO_CHIP_CLASS,
  HERO_BUTTON_CLASS,
  HERO_GLASS_BUTTON_CLASS,
  HERO_GLASS_CLASS,
} from "@/shared/ui";
import { usePageBackdrop } from "@/shared/lib";
import { useClassicSurfaces } from "@/features/settings/store/customizationStore";
import { useLikesCover } from "../hooks/useLikesCover";
import { useSavedTracksStore } from "../saved";
import { isSavedTrack } from "@/shared/media/saved";
import { useAuthStore } from "@/features/auth";
import { userDisplayName } from "@/entities/user";
import {
  AddLine,
  PlayFill,
  More1Fill,
  PlaylistFill,
  MusicLine,
  CheckLine,
  ShareForwardLine,
  DownloadLine,
} from "@mingcute/react";
import { AnimatePresence, motion } from "framer-motion";
import { LuPencil, LuTrash2, LuText, LuShuffle } from "react-icons/lu";
import { buildShareUrl } from "@/shared/utils/share";
import Button from "@/shared/ui/Button";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useModalStore } from "../store/modalStore";
import {
  usePlaylist,
  usePlaylistsList,
  useLikedTracks,
  useReorderPlaylistTracks,
  reloadLikedTracks,
} from "../hooks";
import { statusOf } from "@/features/connectivity";
import { useListReorder } from "@/shared/hooks";
import { playerEngine } from "@/features/player";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { api } from "@/shared/api";
import {
  useTrackSearch,
  TrackSearchField,
  TrackSearchEmpty,
} from "./TrackSearch";
import { useTrackSort, TrackSortMenu } from "./TrackSort";

interface TrackItemProps {
  track: Track;
  playlistId?: string;
  playlistTitle: string;
  playlistCoverUrl: string;
  allTracks: Track[];
  style?: React.CSSProperties;
  showReorderHandle?: boolean;
  onGrabStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
  highlight?: string;
}

const TrackItem = memo(function TrackItem({
  track,
  playlistId,
  playlistTitle,
  playlistCoverUrl,
  allTracks,
  style,
  showReorderHandle,
  onGrabStart,
  highlight,
}: TrackItemProps) {
  const handlePlay = useCallback(() => {
    if (typeof window !== "undefined" && window.__linerWasDragging) return;
    const context = playlistId ? `playlist:${playlistId}` : playlistTitle;
    playerEngine.playTrack(track, allTracks, context, playlistCoverUrl);
  }, [track, allTracks, playlistId, playlistTitle, playlistCoverUrl]);

  return (
    <div style={style} data-reorder-item>
      <SongCardWithMenu
        id={track.id}
        title={track.title}
        artists={track.artists}
        artistId={track.artistId}
        artistList={track.artistList}
        coverUrl={track.coverUrl || playlistCoverUrl}
        playlistId={playlistId}
        playlistItemId={track.playlistItemId}
        playlistTitle={playlistTitle}
        showReorderHandle={showReorderHandle}
        onGrabStart={onGrabStart}
        highlight={highlight}
        duration={
          track.durationMs
            ? `${Math.floor(track.durationMs / 60000)}:${String(
                Math.floor((track.durationMs % 60000) / 1000),
              ).padStart(2, "0")}`
            : undefined
        }
        durationMs={track.durationMs}
        explicit={track.explicit}
        onPlay={handlePlay}
      />
    </div>
  );
});

function PlaylistHeroCover({
  urls,
  title,
  likesCover,
}: {
  urls: string[];
  title: string;
  likesCover?: string;
}) {
  if (urls.length === 0) {
    return likesCover ? (
      <img
        src={likesCover}
        alt={title}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover select-none"
      />
    ) : (
      <PlaylistFill size={48} className="text-border-alpha-33" />
    );
  }
  if (urls.length === 1) {
    return (
      <CoverImage
        src={urls[0]}
        alt={title}
        fill
        sizes="180px"
        className="object-cover"
        draggable={false}
        unoptimized
      />
    );
  }
  const cells = urls.slice(0, 4);
  return (
    <div className="absolute inset-0 grid grid-cols-2 gap-[1.5px] bg-border-alpha-8">
      {cells.map((url, i) => {
        const spanFull = cells.length === 3 && i === 0;
        return (
          <div
            key={i}
            className={`relative overflow-hidden${spanFull ? " row-span-2" : ""}`}
          >
            <CoverImage
              src={url}
              alt={`${title} cover ${i + 1}`}
              fill
              sizes="140px"
              className="object-cover"
              draggable={false}
              unoptimized
            />
          </div>
        );
      })}
    </div>
  );
}

function LibraryPlaylistContent() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const isLikesMode = id === "likes";
  const saveLikedEnabled = useSavedTracksStore((state) => state.enabled);
  useSavedTracksStore((state) => state.records);
  const currentUser = useAuthStore((state) => state.user);
  const likesOwnerName = userDisplayName(currentUser);
  const decodedId = id ? decodeURIComponent(id) : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const reorderTracks = useReorderPlaylistTracks();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  const {
    data: playlistDetail,
    isLoading: playlistLoading,
    error: playlistError,
  } = usePlaylist(isLikesMode ? null : decodedId);

  const {
    data: likesData,
    isLoading: likesLoading,
    error: likesError,
  } = useLikedTracks(isLikesMode ? { limit: 1000, offset: 0 } : undefined);

  const loadFailed = isLikesMode
    ? likesError && likesData.tracks.length === 0
    : !playlistDetail &&
      playlistError !== undefined &&
      statusOf(playlistError) !== 404;

  const isLoading = isLikesMode ? likesLoading : playlistLoading;

  const viewData = (() => {
    if (isLikesMode) {
      if (!likesData) return null;
      const tracks: Track[] = (likesData.tracks ?? []).map((t) => ({
        ...t,
        playCount: 0,
      }));
      return {
        title: t("playlist.liked_songs"),
        bio: "",
        countLabel: t("common.tracks", { count: tracks.length }),
        coverUrl: "",
        coverUrls: [] as string[],
        tracks,
        revision: 0,
      };
    }
    if (!playlistDetail) return null;
    const bio = playlistDetail.description?.trim() ?? "";
    return {
      title: playlistDetail.title || t("playlist.untitled_playlist"),
      bio,
      countLabel: t("common.tracks", { count: playlistDetail.trackCount }),
      coverUrl: playlistDetail.coverUrl || "",
      coverUrls:
        playlistDetail.coverUrls ??
        (playlistDetail.coverUrl ? [playlistDetail.coverUrl] : []),
      tracks: playlistDetail.tracks,
      durationMs: playlistDetail.durationMs,
      revision: playlistDetail.revision,
    };
  })();
  const likesCover = useLikesCover();
  const classicSurfaces = useClassicSurfaces();
  const { data: playlistList } = usePlaylistsList();
  const summary = isLikesMode
    ? undefined
    : playlistList?.playlists?.find((playlist) => playlist.id === decodedId);
  const preview = isLikesMode
    ? {
        title: t("playlist.liked_songs"),
        subtitle: likesOwnerName || undefined,
        coverUrls: [] as string[],
      }
    : summary
      ? {
          title: summary.title || t("playlist.untitled_playlist"),
          subtitle: summary.description?.trim() || undefined,
          coverUrls:
            summary.coverUrls?.length > 0
              ? summary.coverUrls
              : summary.coverUrl
                ? [summary.coverUrl]
                : [],
        }
      : undefined;
  usePageBackdrop(
    isLikesMode
      ? likesCover
      : (viewData?.coverUrls?.[0] ??
          (viewData?.coverUrl || undefined) ??
          preview?.coverUrls[0]),
    { dim: 0.05 },
  );

  useEffect(() => {
    if (isEditingTitle && titleRef.current) {
      titleRef.current.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(titleRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDescription && descriptionRef.current) {
      descriptionRef.current.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(descriptionRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditingDescription]);

  const trackListContainerRef = useRef<HTMLDivElement>(null);
  const [optimisticTracks, setOptimisticTracks] = useState<Track[] | null>(
    null,
  );

  useEffect(() => {
    setOptimisticTracks(null);
  }, [viewData?.revision, decodedId]);

  const currentTracks = useMemo(() => {
    return optimisticTracks ?? viewData?.tracks ?? [];
  }, [optimisticTracks, viewData?.tracks]);

  const sort = useTrackSort(currentTracks, id);
  const sortedTracks = sort.sorted;
  const isSorted = sort.option !== "default";
  const search = useTrackSearch(sortedTracks, id);
  const isFiltering = search.matches !== null;
  const visibleTracks = useMemo(
    () =>
      search.matches ?? sortedTracks.map((track, index) => ({ track, index })),
    [search.matches, sortedTracks],
  );

  // results start at the top, not wherever the full list was scrolled to
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [search.activeQuery, sort.option]);

  const handleSearchSubmit = useCallback(() => {
    const first = search.matches?.[0];
    if (!first || !viewData) return;
    const context = decodedId ? `playlist:${decodedId}` : viewData.title;
    playerEngine.playTrack(
      first.track,
      sortedTracks,
      context,
      viewData.coverUrl,
    );
  }, [search.matches, viewData, decodedId, sortedTracks]);

  const handlePlayAll = useCallback(() => {
    if (!sortedTracks.length || !viewData) return;
    const context = decodedId ? `playlist:${decodedId}` : viewData.title;
    playerEngine.clearQueue();
    playerEngine.playTrack(
      sortedTracks[0],
      sortedTracks,
      context,
      viewData.coverUrl,
    );
  }, [sortedTracks, viewData, decodedId]);

  const handleShufflePlay = useCallback(() => {
    if (!sortedTracks.length || !viewData) return;
    const context = decodedId ? `playlist:${decodedId}` : viewData.title;
    playerEngine.clearQueue();
    void playerEngine.playShuffled(sortedTracks, context, viewData.coverUrl);
  }, [sortedTracks, viewData, decodedId]);

  const { toast } = useToast();
  const [addedToQueue, setAddedToQueue] = useState(false);

  const handleAddToQueue = useCallback(() => {
    if (!sortedTracks.length || !viewData) return;
    for (const track of sortedTracks) {
      playerEngine.addToQueue(track);
    }
    const playlistTitle = viewData.title || t("playlist.untitled_playlist");
    toast(t("playlist.added_to_queue"), "info", {
      description: playlistTitle,
    });
    setAddedToQueue(true);
    const timer = setTimeout(() => {
      setAddedToQueue(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [sortedTracks, viewData, toast, t]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard && decodedId) {
      navigator.clipboard.writeText(buildShareUrl("playlist", decodedId));
      void api.updatePlaylist(decodedId, { isPublic: true }).catch(() => {});
      toast(t("common.link_copied"), "checkmark", {
        description: viewData?.title || undefined,
      });
    }
  }, [decodedId, viewData?.title, toast, t]);

  const handleReorderCommit = useCallback(
    (fromIndex: number, toIndex: number, movingTrack: Track) => {
      if (!decodedId || !viewData || isLikesMode) return;
      if (fromIndex === toIndex || !movingTrack.playlistItemId) return;

      const nextList = [...currentTracks];
      const [item] = nextList.splice(fromIndex, 1);
      nextList.splice(toIndex, 0, item);

      const nextItem = nextList[toIndex + 1];
      const beforeItemId = nextItem ? (nextItem.playlistItemId ?? null) : null;

      setOptimisticTracks(nextList);

      reorderTracks.mutate({
        playlistId: decodedId,
        itemId: movingTrack.playlistItemId,
        beforeItemId,
        revision: viewData.revision,
      });
    },
    [currentTracks, decodedId, isLikesMode, reorderTracks, viewData],
  );

  const {
    isDragging,
    dragIndex,
    dropIndex,
    draggedItem,
    pointerPos,
    grabOffset,
    itemWidth,
    handleCardGrab,
  } = useListReorder<Track>({
    items: currentTracks,
    scrollContainerRef: scrollRef,
    listContainerRef: trackListContainerRef,
    itemHeight: 64,
    onReorder: handleReorderCommit,
    edgeThreshold: 80,
    maxScrollSpeed: 22,
  });

  const [listScrollMargin, setListScrollMargin] = useState(0);
  const listShown =
    currentTracks.length > 0 &&
    !(search.matches && search.matches.length === 0);
  useLayoutEffect(() => {
    const list = trackListContainerRef.current;
    const hero = scrollRef.current?.firstElementChild;
    if (!list) return;
    const measure = () => setListScrollMargin(list.offsetTop);
    measure();
    if (!hero || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(hero);
    return () => observer.disconnect();
  }, [listShown, viewData]);

  const rowVirtualizer = useVirtualizer({
    scrollMargin: listScrollMargin,
    count: visibleTracks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 25,
    getItemKey: (index) =>
      visibleTracks[index]?.track.playlistItemId ??
      visibleTracks[index]?.track.id ??
      index,
  });

  const urlsToPreload = useMemo(() => {
    if (!viewData) return [];
    const urls = new Set<string>();
    if (viewData.coverUrl) urls.add(viewData.coverUrl);
    if (viewData.coverUrls) {
      for (const u of viewData.coverUrls) {
        if (u) urls.add(u);
      }
    }
    return Array.from(urls);
  }, [viewData]);

  const [imagesLoaded, setImagesLoaded] = useState(
    () => !isLoading && !!viewData,
  );
  const [skeletonExited, setSkeletonExited] = useState(
    () => !isLoading && !!viewData,
  );

  useEffect(() => {
    if (isLoading || !viewData) {
      setImagesLoaded(false);
      setSkeletonExited(false);
      return;
    }
    if (urlsToPreload.length === 0) {
      setImagesLoaded(true);
      return;
    }
    let active = true;
    let settled = false;
    const timer = setTimeout(() => {
      if (active && !settled) {
        settled = true;
        setImagesLoaded(true);
      }
    }, 150);

    const promises = urlsToPreload.map((url) => preloadCoverArt(url));

    Promise.all(promises).then(() => {
      if (active && !settled) {
        settled = true;
        clearTimeout(timer);
        setImagesLoaded(true);
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isLoading, viewData, urlsToPreload]);

  const isReady = !isLoading && !!viewData && imagesLoaded;
  const contentLayerRef = useRef<HTMLDivElement>(null);
  const swapsInPlace = Boolean(preview);

  useEffect(() => {
    if (!isReady || skeletonExited) return;
    let timer: ReturnType<typeof setTimeout>;
    const settle = () => {
      const layer = contentLayerRef.current;
      const shown =
        !swapsInPlace ||
        !layer ||
        Number(getComputedStyle(layer).opacity) >= 0.99;
      if (shown) setSkeletonExited(true);
      else timer = setTimeout(settle, 120);
    };
    timer = setTimeout(settle, 250);
    return () => clearTimeout(timer);
  }, [isReady, skeletonExited, swapsInPlace]);

  if (!isLoading && loadFailed) {
    return (
      <div className="h-full w-full bg-transparent flex flex-col items-center justify-center gap-[6px] px-[24px] text-center">
        <span className="text-[15px] font-[600] text-text-primary">
          {t(
            isLikesMode ? "playlist.likes_load_failed" : "playlist.load_failed",
          )}
        </span>
        <span className="text-[13px] text-text-secondary">
          {t("playlist.load_failed_desc")}
        </span>
        {isLikesMode ? (
          <Button
            variant="secondary"
            onClick={() => void reloadLikedTracks()}
            className="mt-[10px] !h-[36px] !rounded-[10px] !border-0 px-[16px]"
          >
            {t("offline.try_again")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (!isLoading && !viewData) {
    return (
      <div className="h-full w-full bg-transparent flex items-center justify-center">
        <span className="text-text-secondary">
          {isLikesMode ? t("playlist.likes_empty") : t("playlist.not_found")}
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div className="relative z-1 grid grid-cols-1 w-full h-full min-h-0 overflow-hidden">
        {viewData && (
          <div
            className={`col-start-1 row-start-1 w-full h-full min-h-0 overflow-hidden ${
              swapsInPlace
                ? "relative z-20 transition-opacity duration-[180ms] ease-out"
                : "transition-opacity duration-200 ease-out"
            } ${isReady ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            ref={contentLayerRef}
            onTransitionEnd={(event) => {
              if (
                swapsInPlace &&
                isReady &&
                event.target === event.currentTarget
              )
                setSkeletonExited(true);
            }}
          >
            <div
              ref={scrollRef}
              data-no-window-drag
              className="relative z-10 flex flex-col h-full w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain box-border pt-(--page-inset-top) pb-(--page-inset-bottom)"
              style={{ willChange: "scroll-position" }}
            >
              <div
                className="shrink-0 pl-[16px] pr-[12px] pt-[8px]"
                data-no-window-drag
              >
                <EntityHero
                  cover={
                    <PlaylistHeroCover
                      urls={viewData.coverUrls}
                      title={viewData.title}
                      likesCover={isLikesMode ? likesCover : undefined}
                    />
                  }
                  title={
                    <h1
                      ref={titleRef}
                      className={`${HERO_TITLE_CLASS} ${
                        isLikesMode
                          ? ""
                          : "cursor-text outline-none transition-colors"
                      } ${isEditingTitle ? "bg-border-alpha-14 rounded-[4px] -ml-[4px] px-[4px]" : ""}`}
                      contentEditable={isLikesMode ? false : isEditingTitle}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        if (!isEditingTitle) return;
                        const title = e.currentTarget.textContent?.trim();
                        if (title && decodedId && title !== viewData.title) {
                          void api
                            .updatePlaylist(decodedId, { title })
                            .then(() =>
                              window.dispatchEvent(
                                new Event("library:changed"),
                              ),
                            );
                        }
                        setIsEditingTitle(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          e.currentTarget.textContent = viewData.title;
                          e.currentTarget.blur();
                          setIsEditingTitle(false);
                        }
                      }}
                      onClick={() => {
                        if (!isLikesMode) setIsEditingTitle(true);
                      }}
                    >
                      {viewData.title}
                    </h1>
                  }
                  subtitle={
                    isLikesMode ? (
                      likesOwnerName ? (
                        <p className={HERO_SUBTITLE_CLASS}>{likesOwnerName}</p>
                      ) : undefined
                    ) : viewData.bio || isEditingDescription ? (
                      <p
                        ref={descriptionRef}
                        className={`${HERO_SUBTITLE_CLASS} cursor-text outline-none transition-colors empty:min-h-[21px] ${
                          isEditingDescription
                            ? "bg-border-alpha-14 rounded-[4px] -ml-[4px] px-[4px]"
                            : ""
                        }`}
                        contentEditable={isEditingDescription}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          if (!isEditingDescription) return;
                          const next =
                            e.currentTarget.textContent?.trim() ?? "";
                          if (decodedId && next !== viewData.bio) {
                            void api
                              .updatePlaylist(decodedId, { description: next })
                              .then(() =>
                                window.dispatchEvent(
                                  new Event("library:changed"),
                                ),
                              );
                          }
                          setIsEditingDescription(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                          if (e.key === "Escape") {
                            e.currentTarget.textContent = viewData.bio;
                            e.currentTarget.blur();
                            setIsEditingDescription(false);
                          }
                        }}
                        onClick={() => setIsEditingDescription(true)}
                      >
                        {viewData.bio}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingDescription(true)}
                        className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] font-[400] text-text-tertiary transition-colors hover:text-text-primary"
                      >
                        {t("common.add_description")}
                      </button>
                    )
                  }
                  meta={
                    <div className="flex items-center flex-wrap gap-[6px]">
                      <div className={HERO_CHIP_CLASS}>
                        <MusicLine
                          size={13}
                          className="text-text-secondary shrink-0"
                        />
                        <span>{viewData.countLabel}</span>
                        <span
                          className="w-[3px] h-[3px] rounded-full shrink-0 bg-text-secondary/50"
                          aria-hidden
                        />
                        <span>
                          {(() => {
                            const totalMs =
                              viewData.durationMs ??
                              viewData.tracks.reduce(
                                (acc, t) => acc + (t.durationMs || 0),
                                0,
                              );
                            const totalMins = Math.floor(totalMs / 60000);
                            if (totalMins > 60) {
                              return `${Math.floor(totalMins / 60)} ${t("playlist.hr")} ${totalMins % 60} ${t("playlist.min")}`;
                            }
                            const totalSecs = Math.floor(
                              (totalMs % 60000) / 1000,
                            );
                            return `${totalMins} ${t("playlist.min")} ${totalSecs} ${t("playlist.sec")}`;
                          })()}
                        </span>
                      </div>
                      {isLikesMode &&
                      saveLikedEnabled &&
                      viewData.tracks.length > 0 ? (
                        <div className={HERO_CHIP_CLASS}>
                          <DownloadLine
                            size={13}
                            className="text-text-secondary shrink-0"
                          />
                          <span>
                            {t("library.saved_count", {
                              saved: viewData.tracks.filter((track) =>
                                isSavedTrack(track.id),
                              ).length,
                              total: viewData.tracks.length,
                            })}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  }
                  actions={
                    <>
                      <Button
                        variant="primary"
                        onClick={handlePlayAll}
                        disabled={currentTracks.length === 0}
                        className={`${HERO_BUTTON_CLASS} px-[22px]`}
                      >
                        <PlayFill size={16} />
                        <span>{t("common.play_all")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleShufflePlay}
                        disabled={currentTracks.length === 0}
                        className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`}
                        title={t("common.shuffle")}
                      >
                        <LuShuffle size={18} />
                      </Button>
                    </>
                  }
                  trailingActions={
                    <>
                      <TrackSearchField
                        search={search}
                        totalCount={currentTracks.length}
                        placeholder={t("track_search.placeholder_playlist")}
                        onSubmit={handleSearchSubmit}
                        className={HERO_GLASS_CLASS}
                      />
                      <Button
                        variant="secondary"
                        onClick={handleAddToQueue}
                        disabled={currentTracks.length === 0}
                        className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} px-[22px] ${
                          // optical centring: with three icon buttons beside it the label reads 1px right
                          !isLikesMode ? "[&>*]:-translate-x-px" : ""
                        }`}
                        title={t("common.add_to_queue")}
                      >
                        <AnimatePresence mode="wait">
                          {addedToQueue ? (
                            <motion.span
                              key="check"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.08 }}
                              className="flex items-center justify-center text-emerald-400 shrink-0"
                            >
                              <CheckLine size={16} />
                            </motion.span>
                          ) : (
                            <motion.span
                              key="add"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.08 }}
                              className="flex items-center justify-center shrink-0"
                            >
                              <AddLine size={16} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <span className="truncate">
                          {t("common.add_to_queue")}
                        </span>
                      </Button>
                      <TrackSortMenu
                        sort={sort}
                        disabled={currentTracks.length < 2}
                      />
                      {!isLikesMode && (
                        <DropdownMenu
                          trigger={
                            <Button
                              variant="secondary"
                              className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`}
                              title={t("common.more")}
                            >
                              <More1Fill size={20} />
                            </Button>
                          }
                          items={[
                            {
                              id: "rename",
                              icon: <LuPencil size={15} />,
                              label: t("common.rename"),
                              onClick: () => setIsEditingTitle(true),
                            },
                            {
                              id: "edit-description",
                              icon: <LuText size={15} />,
                              label: t("common.edit_description"),
                              onClick: () => setIsEditingDescription(true),
                            },
                            {
                              id: "share",
                              icon: <ShareForwardLine size={15} />,
                              label: t("common.share"),
                              onClick: handleShare,
                            },
                            {
                              id: "delete",
                              icon: <LuTrash2 size={15} />,
                              label: t("common.delete"),
                              danger: true,
                              onClick: () => {
                                if (!decodedId) return;
                                useModalStore.getState().openRemoveFromLibrary({
                                  id: decodedId,
                                  title: viewData.title,
                                  coverUrl: viewData.coverUrl,
                                  type: "playlist",
                                  isOwned: true,
                                });
                              },
                            },
                          ]}
                        />
                      )}
                    </>
                  }
                />
              </div>

              <div
                className={`grow shrink-0 mt-[20px] mx-[4px] rounded-t-[14px] bg-black/[0.03] dark:bg-white/[0.04] overflow-hidden px-[8px] pt-[8px] ${
                  classicSurfaces ? "" : "backdrop-blur-xl"
                }`}
                style={{
                  marginBottom: "calc(var(--page-inset-bottom) * -1)",
                  paddingBottom: "calc(var(--page-inset-bottom) + 16px)",
                }}
              >
                {currentTracks.length === 0 ? (
                  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-[12px] text-center">
                    <PlaylistFill size={40} className="text-border-alpha-33" />
                    <div className="flex flex-col gap-[4px]">
                      <p className="m-0 text-[15px] font-[500] text-text-primary">
                        {t("playlist.empty_title")}
                      </p>
                      <p className="m-0 text-[13px] text-text-tertiary">
                        {t("playlist.empty_subtitle")}
                      </p>
                    </div>
                  </div>
                ) : search.matches && search.matches.length === 0 ? (
                  <TrackSearchEmpty
                    query={search.activeQuery}
                    onClear={() => search.setQuery("")}
                  />
                ) : (
                  <div
                    ref={trackListContainerRef}
                    className="relative"
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                    }}
                  >
                    {isDragging && dropIndex !== null && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "64px",
                          transform: `translateY(${dropIndex * 64}px)`,
                          transition:
                            "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
                          pointerEvents: "none",
                          zIndex: 0,
                        }}
                        className="px-0 py-[2px]"
                      >
                        <ReorderDropPlaceholder />
                      </div>
                    )}

                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const entry = visibleTracks[virtualRow.index];
                      if (!entry) return null;
                      // original position; equals the row index whenever not filtering
                      const { track, index } = entry;

                      const isThisDragged = isDragging && index === dragIndex;

                      let shiftY = 0;
                      if (
                        isDragging &&
                        dragIndex !== null &&
                        dropIndex !== null &&
                        index !== dragIndex
                      ) {
                        if (dragIndex < dropIndex) {
                          if (index > dragIndex && index <= dropIndex)
                            shiftY = -64;
                        } else if (dragIndex > dropIndex) {
                          if (index >= dropIndex && index < dragIndex)
                            shiftY = 64;
                        }
                      }

                      // reordering a filtered view would be ambiguous, so it waits for the full list
                      const canReorder = Boolean(
                        !isLikesMode &&
                        decodedId &&
                        track.playlistItemId &&
                        !isFiltering &&
                        !isSorted,
                      );

                      return (
                        <TrackItem
                          key={track.playlistItemId ?? `${track.id}-${index}`}
                          track={track}
                          playlistId={
                            isLikesMode ? undefined : (decodedId ?? undefined)
                          }
                          playlistTitle={viewData.title}
                          playlistCoverUrl={viewData.coverUrl}
                          allTracks={sortedTracks}
                          showReorderHandle={canReorder}
                          highlight={search.activeQuery || undefined}
                          onGrabStart={
                            canReorder && !isDragging
                              ? (e) => handleCardGrab(index, track, e)
                              : undefined
                          }
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start - listScrollMargin + shiftY}px)`,
                            transition: isDragging
                              ? "transform 180ms cubic-bezier(0.2, 0, 0, 1)"
                              : undefined,
                            opacity: isThisDragged ? 0 : 1,
                            zIndex: 1,
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {isDragging && draggedItem && (
                  <FloatingDragCard
                    x={pointerPos.x}
                    y={pointerPos.y}
                    offsetX={grabOffset.x}
                    offsetY={grabOffset.y}
                    width={itemWidth}
                  >
                    <SongCardWithMenu
                      id={draggedItem.id}
                      title={draggedItem.title}
                      artists={draggedItem.artists}
                      artistId={draggedItem.artistId}
                      artistList={draggedItem.artistList}
                      coverUrl={draggedItem.coverUrl || viewData.coverUrl}
                      playlistId={
                        isLikesMode ? undefined : (decodedId ?? undefined)
                      }
                      playlistItemId={draggedItem.playlistItemId}
                      playlistTitle={viewData.title}
                      duration={
                        draggedItem.durationMs
                          ? `${Math.floor(draggedItem.durationMs / 60000)}:${String(
                              Math.floor(
                                (draggedItem.durationMs % 60000) / 1000,
                              ),
                            ).padStart(2, "0")}`
                          : undefined
                      }
                      durationMs={draggedItem.durationMs}
                      explicit={draggedItem.explicit}
                      className="bg-transparent"
                    />
                  </FloatingDragCard>
                )}
              </div>
            </div>
          </div>
        )}

        {!skeletonExited && (
          <div
            className={`col-start-1 row-start-1 w-full h-full overflow-hidden pointer-events-none ${
              swapsInPlace
                ? "z-0"
                : `z-10 transition-opacity duration-200 ease-out ${
                    isReady ? "opacity-0" : "opacity-100"
                  }`
            }`}
            onTransitionEnd={(event) => {
              if (event.target === event.currentTarget) setSkeletonExited(true);
            }}
          >
            <PlaylistPageSkeleton
              cover={
                preview ? (
                  <PlaylistHeroCover
                    urls={preview.coverUrls}
                    title={preview.title}
                    likesCover={isLikesMode ? likesCover : undefined}
                  />
                ) : undefined
              }
              title={preview?.title}
              subtitle={preview?.subtitle}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LibraryPlaylistPage() {
  return (
    <Suspense fallback={<PlaylistPageSkeleton />}>
      <LibraryPlaylistContent />
    </Suspense>
  );
}
