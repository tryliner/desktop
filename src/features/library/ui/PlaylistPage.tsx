import { useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import PlaylistPageSkeleton from "./PlaylistPageSkeleton";
import { useToast, ReorderDropPlaceholder, FloatingDragCard, EntitySidebar, StickyHeader, SIDEBAR_TITLE_CLASS, SIDEBAR_SUBTITLE_CLASS } from "@/shared/ui";
import {
  AddLine,
  PlayFill,
  More2Line,
  HeartFill,
  PlaylistFill,
  CheckLine,
} from "@mingcute/react";
import { AnimatePresence, motion } from "framer-motion";
import { LuPencil, LuTrash2, LuText, LuShuffle } from "react-icons/lu";
import Button from "@/shared/ui/Button";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useModalStore } from "../store/modalStore";
import {
  usePlaylist,
  useLikedTracks,
  useReorderPlaylistTracks,
} from "../hooks";
import { useListReorder } from "@/shared/hooks";
import { playerEngine } from "@/features/player";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { api } from "@/shared/api";

interface TrackItemProps {
  track: Track;
  playlistId?: string;
  playlistTitle: string;
  playlistCoverUrl: string;
  allTracks: Track[];
  style?: React.CSSProperties;
  showReorderHandle?: boolean;
  onGrabStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

function TrackItem({
  track,
  playlistId,
  playlistTitle,
  playlistCoverUrl,
  allTracks,
  style,
  showReorderHandle,
  onGrabStart,
}: TrackItemProps) {
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
        duration={
          track.durationMs
            ? `${Math.floor(track.durationMs / 60000)}:${String(
                Math.floor((track.durationMs % 60000) / 1000),
              ).padStart(2, "0")}`
            : undefined
        }
        durationMs={track.durationMs}
        explicit={track.explicit}
        onPlay={() => {
          if (typeof window !== "undefined" && window.__linerWasDragging) return;
          const context = playlistId ? `playlist:${playlistId}` : playlistTitle;
          playerEngine.playTrack(
            track,
            allTracks,
            context,
            playlistCoverUrl,
          );
        }}
      />
    </div>
  );
}

function LibraryPlaylistContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const isLikesMode = id === "likes";
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

  const { data: likesData, isLoading: likesLoading } = useLikedTracks(
    isLikesMode ? { limit: 1000, offset: 0 } : undefined,
  );

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
      revision: playlistDetail.revision,
    };
  })();

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

  const handlePlayAll = useCallback(() => {
    if (!viewData || viewData.tracks.length === 0) return;
    const context = decodedId ? `playlist:${decodedId}` : viewData.title;
    playerEngine.clearQueue();
    playerEngine.playTrack(
      viewData.tracks[0],
      viewData.tracks,
      context,
      viewData.coverUrl,
    );
  }, [viewData, decodedId]);

  const handleShufflePlay = useCallback(() => {
    if (!currentTracks.length || !viewData) return;
    const context = decodedId ? `playlist:${decodedId}` : viewData.title;
    const shuffled = [...currentTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    playerEngine.clearQueue();
    playerEngine.setShuffle(true);
    playerEngine.playTrack(
      shuffled[0],
      shuffled,
      context,
      viewData.coverUrl,
      0,
    );
  }, [currentTracks, viewData, decodedId]);

  const { toast } = useToast();
  const [addedToQueue, setAddedToQueue] = useState(false);

  const handleAddToQueue = useCallback(() => {
    if (!viewData || viewData.tracks.length === 0) return;
    for (const track of viewData.tracks) {
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
  }, [viewData, toast, t]);

  const trackListContainerRef = useRef<HTMLDivElement>(null);
  const [optimisticTracks, setOptimisticTracks] = useState<Track[] | null>(null);

  useEffect(() => {
    setOptimisticTracks(null);
  }, [viewData?.revision, decodedId]);

  const currentTracks = useMemo(() => {
    return optimisticTracks ?? viewData?.tracks ?? [];
  }, [optimisticTracks, viewData?.tracks]);

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

  const rowVirtualizer = useVirtualizer({
    count: currentTracks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 10,
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
    for (const track of viewData.tracks.slice(0, 8)) {
      if (track.coverUrl) urls.add(track.coverUrl);
    }
    return Array.from(urls);
  }, [viewData]);

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [skeletonExited, setSkeletonExited] = useState(false);

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
    }, 1000);

    const promises = urlsToPreload.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.src = url;
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    );

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

  useEffect(() => {
    if (isReady && !skeletonExited) {
      const timer = setTimeout(() => {
        setSkeletonExited(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isReady, skeletonExited]);

  const [isScrolled, setIsScrolled] = useState(false);

  if (!isLoading && !viewData) {
    return (
      <div className="page-transition h-full w-full bg-bg-primary flex items-center justify-center">
        <span className="text-text-secondary">
          {isLikesMode
            ? t("playlist.likes_empty")
            : t("playlist.not_found")}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const nextScrolled = e.currentTarget.scrollTop > 180;
        setIsScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
      }}
      className="page-transition relative h-full w-full overflow-y-auto bg-bg-primary pb-[24px]"
    >
      <StickyHeader isScrolled={isScrolled} showBack={isReady} />
      <div className="relative z-1 grid grid-cols-1 items-start w-full">
        {isReady && viewData && (
          <div className="col-start-1 row-start-1 w-full">
            <div className="relative z-10 flex items-start gap-[32px] px-[32px] pt-[56px] pb-[24px]" data-window-drag>
              <EntitySidebar
                cover={(() => {
                    const urls =
                      viewData.coverUrls ??
                      (viewData.coverUrl ? [viewData.coverUrl] : []);
                    if (urls.length === 0) {
                      return isLikesMode ? (
                        <HeartFill size={48} className="text-border-alpha-33" />
                      ) : (
                        <PlaylistFill size={48} className="text-border-alpha-33" />
                      );
                    }
                    if (urls.length === 1) {
                      return (
                        <CoverImage
                          src={urls[0]}
                          alt={viewData.title}
                          fill
                          sizes="280px"
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
                                alt={`${viewData.title} cover ${i + 1}`}
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
                  })()}
                title={
                  <h1
                    ref={titleRef}
                    className={`${SIDEBAR_TITLE_CLASS} ${
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
                              window.dispatchEvent(new Event("library:changed")),
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
                      undefined
                    ) : viewData.bio || isEditingDescription ? (
                      <p
                        ref={descriptionRef}
                        className={`${SIDEBAR_SUBTITLE_CLASS} cursor-text outline-none transition-colors empty:min-h-[21px] ${
                          isEditingDescription ? "bg-border-alpha-14 rounded-[4px] -ml-[4px] px-[4px]" : ""
                        }`}
                        contentEditable={isEditingDescription}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          if (!isEditingDescription) return;
                          const next = e.currentTarget.textContent?.trim() ?? "";
                          if (decodedId && next !== viewData.bio) {
                            void api
                              .updatePlaylist(decodedId, { description: next })
                              .then(() =>
                                window.dispatchEvent(new Event("library:changed")),
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
                        className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-[400] text-text-tertiary transition-colors hover:text-text-primary"
                        style={{ fontFamily: "var(--font-inter), sans-serif" }}
                      >
                        {t("common.add_description")}
                      </button>
                    )
                  }
                  meta={
                    <>
                      {`${viewData.countLabel} • `}
                      {(() => {
                        const totalMs = viewData.tracks.reduce(
                          (acc, t) => acc + (t.durationMs || 0),
                          0,
                        );
                        const totalMins = Math.floor(totalMs / 60000);
                        if (totalMins > 60) {
                          return `${Math.floor(totalMins / 60)} ${t("playlist.hr")} ${totalMins % 60} ${t("playlist.min")}`;
                        }
                        const totalSecs = Math.floor((totalMs % 60000) / 1000);
                        return `${totalMins} ${t("playlist.min")} ${totalSecs} ${t("playlist.sec")}`;
                      })()}
                    </>
                  }
                  primaryAction={
                    <div className="flex flex-col gap-[8px] w-full">
                      <Button
                        variant="primary"
                        onClick={handlePlayAll}
                        disabled={currentTracks.length === 0}
                        className="!h-[36px] w-full !text-[13.5px] !font-[500] px-[16px] flex items-center justify-center gap-[6px]"
                      >
                        <PlayFill size={16} />
                        <span>{t("common.play_all")}</span>
                      </Button>

                      <div className="flex items-center gap-[8px] w-full">
                        <Button
                          variant="outline"
                          onClick={handleAddToQueue}
                          disabled={currentTracks.length === 0}
                          className="!h-[36px] flex-1 min-w-0 !text-[13px] !font-[500] px-[12px] flex items-center justify-center gap-[6px]"
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
                          <span className="truncate">{t("common.add_to_queue")}</span>
                        </Button>

                        <Button
                          variant="outline"
                          onClick={handleShufflePlay}
                          disabled={currentTracks.length === 0}
                          className="!h-[36px] !w-[36px] shrink-0 !p-0 flex items-center justify-center text-text-primary"
                          title={t("common.shuffle")}
                        >
                          <LuShuffle size={16} />
                        </Button>

                        {!isLikesMode && (
                          <DropdownMenu
                            trigger={
                              <Button
                                variant="outline"
                                className="!h-[36px] !w-[36px] shrink-0 !p-0 flex items-center justify-center text-text-primary"
                                title={t("common.more")}
                              >
                                <More2Line size={18} />
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
                                  });
                                },
                              },
                            ]}
                          />
                        )}
                      </div>
                    </div>
                  }
                />
                <div className="min-w-0 flex-1">
              {currentTracks.length === 0 ? (
                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-[12px] text-center">
                  <PlaylistFill size={40} className="text-border-alpha-33" />
                  <div className="flex flex-col gap-[4px]">
                    <p
                      className="m-0 text-[15px] font-[500] text-text-primary"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {t("playlist.empty_title")}
                    </p>
                    <p
                      className="m-0 text-[13px] text-text-tertiary"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {t("playlist.empty_subtitle")}
                    </p>
                  </div>
                </div>
              ) : (
              <div
                ref={trackListContainerRef}
                className="relative -mx-[8px]"
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
                      transition: "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
                      pointerEvents: "none",
                      zIndex: 0,
                    }}
                    className="px-0 py-[2px]"
                  >
                    <ReorderDropPlaceholder />
                  </div>
                )}

                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index;
                  const track = currentTracks[index];
                  if (!track) return null;

                  const isThisDragged = isDragging && index === dragIndex;

                  let shiftY = 0;
                  if (isDragging && dragIndex !== null && dropIndex !== null && index !== dragIndex) {
                    if (dragIndex < dropIndex) {
                      if (index > dragIndex && index <= dropIndex) shiftY = -64;
                    } else if (dragIndex > dropIndex) {
                      if (index >= dropIndex && index < dragIndex) shiftY = 64;
                    }
                  }

                  const canReorder = Boolean(
                    !isLikesMode && decodedId && track.playlistItemId,
                  );

                  return (
                    <TrackItem
                      key={
                        track.playlistItemId ?? `${track.id}-${index}`
                      }
                      track={track}
                      playlistId={isLikesMode ? undefined : (decodedId ?? undefined)}
                      playlistTitle={viewData.title}
                      playlistCoverUrl={viewData.coverUrl}
                      allTracks={currentTracks}
                      showReorderHandle={canReorder}
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
                        transform: `translateY(${virtualRow.start + shiftY}px)`,
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
                    playlistId={isLikesMode ? undefined : (decodedId ?? undefined)}
                    playlistItemId={draggedItem.playlistItemId}
                    playlistTitle={viewData.title}
                    duration={
                      draggedItem.durationMs
                        ? `${Math.floor(draggedItem.durationMs / 60000)}:${String(
                            Math.floor((draggedItem.durationMs % 60000) / 1000),
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
            className={`col-start-1 row-start-1 w-full z-10 transition-opacity duration-300 ease-out ${
              isReady ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
            }`}
            onTransitionEnd={() => setSkeletonExited(true)}
          >
            <PlaylistPageSkeleton />
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
