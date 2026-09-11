import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import PlaylistPageSkeleton from "./PlaylistPageSkeleton";
import { useToast, ReorderDropPlaceholder, FloatingDragCard } from "@/shared/ui";
import {
  AddLine,
  ArrowLeftLine,
  PlayFill,
  ShareForwardLine,
  More2Line,
  HeartFill,
  PlaylistFill,
  Upload2Line,
  CheckLine,
  Search2Line,
} from "@mingcute/react";
import { AnimatePresence, motion } from "framer-motion";
import { LuPencil, LuGlobe, LuTrash2, LuText } from "react-icons/lu";
import Button from "@/shared/ui/Button";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import Dialog from "@/shared/ui/Dialog";
import TextInput from "@/shared/ui/TextInput";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import SearchResultsList from "@/features/search/ui/SearchResultsList";
import { useSearchAll } from "@/features/search";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useCoverSrc } from "@/features/covers";
import { useModalStore } from "../store/modalStore";
import {
  usePlaylist,
  useLikedTracks,
  useReorderPlaylistTracks,
  useAddPlaylistTracks,
} from "../hooks";
import { useListReorder } from "@/shared/hooks";
import { playerEngine } from "@/features/player";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { api, ApiError, mediaUrl, toClientTrack, toMaxQualityAvatarUrl } from "@/shared/api";
import { buildShareUrl } from "@/shared/utils/share";

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

interface AddSongsModalProps {
  open: boolean;
  onClose: () => void;
  onAddTrack: (track: any) => void;
}

function AddSongsModal({ open, onClose, onAddTrack }: AddSongsModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const { items, loading, hasLoaded, partialWarning } = useSearchAll(query, {
    enabled: open,
    limit: 20,
    debounceMs: 320,
  });

  const results = useMemo(() => {
    return items.map((item: any) => {
      const coverUrl = item.cover ? mediaUrl(item.cover.url) : (item.coverUrl ?? "");
      if (item.type === "track") {
        const clientTrack = toClientTrack(item);
        return {
          ...clientTrack,
          ...item,
          _type: "track",
          coverUrl: clientTrack.coverUrl || coverUrl,
          artists: clientTrack.artists,
          artistId: clientTrack.artistId,
          artistList: clientTrack.artistList,
        };
      }
      if (item.type === "artist") {
        return {
          ...item,
          _type: "artist",
          title: item.name,
          coverUrl: toMaxQualityAvatarUrl(coverUrl),
          artists: "",
        };
      }
      if (item.type === "album") {
        return {
          ...item,
          _type: "album",
          coverUrl,
          artists: Array.isArray(item.artists)
            ? item.artists.map((a: any) => a.name).join(", ")
            : (item.artists ?? ""),
          artistId: item.artists?.[0]?.id,
          artistList: Array.isArray(item.artists)
            ? item.artists.map((a: any) => ({ id: a.id, name: a.name }))
            : undefined,
        };
      }
      return {
        ...item,
        _type: item.type,
        coverUrl,
        artists: item.author ?? item.artists ?? "",
        artistId: item.artists?.[0]?.id,
        artistList: Array.isArray(item.artists)
          ? item.artists.map((a: any) => ({ id: a.id, name: a.name }))
          : undefined,
      };
    });
  }, [items]);

  const handleNavigateItem = useCallback(
    (it: any) => {
      onClose();
      if (it._type === "artist") {
        navigate(`/artist?id=${encodeURIComponent(it.id)}`);
      } else if (it._type === "playlist") {
        navigate(`/collection?type=playlist&id=${encodeURIComponent(it.id)}`);
      } else if (it._type === "album") {
        navigate(`/collection?type=album&id=${encodeURIComponent(it.id)}`);
      }
    },
    [navigate, onClose],
  );

  const isSearchEmpty =
    query.trim().length >= 2 && !loading && hasLoaded && results.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      maxWidth={480}
      maxHeight="70vh"
    >
      <div className="flex h-full min-h-0 flex-col gap-[12px] px-[12px] pb-[12px]">
        <div className="px-[8px] pt-[4px]">
          <h2
            className="m-0 text-[18px] font-[600] tracking-[-0.01em] text-text-primary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("playlist.add_songs")}
          </h2>
        </div>

        <div className="px-[8px]">
          <TextInput
            ref={inputRef}
            size="sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.search")}
            icon={<Search2Line size={16} />}
            className="!h-[36px] w-full rounded-md !border-transparent bg-bg-elevated text-[13px]"
          />
        </div>

        <div className="relative min-h-[240px] flex-1 overflow-hidden px-[8px]">
          {isSearchEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-[6px] text-center">
              <p className="m-0 text-[14px] font-medium text-text-primary">
                {t("common.no_results")}
              </p>
              <p className="m-0 text-[12px] text-text-tertiary">
                {t("common.try_another_search")}
              </p>
            </div>
          ) : results.length > 0 ? (
            <SearchResultsList
              items={results}
              isArtistSearchFilter={false}
              isPlaylistSearchFilter={false}
              onPlayFromSearch={onAddTrack}
              onNavigateItem={handleNavigateItem}
              partialWarning={partialWarning}
            />
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

function LibraryPlaylistContent() {
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
        description: t("common.tracks", { count: tracks.length }),
        showCountInMeta: false,
        countLabel: "",
        coverUrl: "",
        tracks,
        revision: 0,
      };
    }
    if (!playlistDetail) return null;
    const bio = playlistDetail.description?.trim();
    const countLabel = t("common.tracks", { count: playlistDetail.trackCount });
    return {
      title: playlistDetail.title || t("playlist.untitled_playlist"),
      bio: bio || "",
      description: bio || countLabel,
      showCountInMeta: Boolean(bio),
      countLabel,
      coverUrl: playlistDetail.coverUrl || "",
      coverUrls:
        playlistDetail.coverUrls ??
        (playlistDetail.coverUrl ? [playlistDetail.coverUrl] : []),
      tracks: playlistDetail.tracks,
      revision: playlistDetail.revision,
    };
  })();

  const heroCoverSrc = useCoverSrc(viewData?.coverUrl);

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

  const { toast } = useToast();
  const [addedToQueue, setAddedToQueue] = useState(false);
  const [addSongsOpen, setAddSongsOpen] = useState(false);
  const addTrackMutation = useAddPlaylistTracks();

  const handleAddTrackFromSearch = useCallback(
    (track: any) => {
      if (!decodedId) return;
      addTrackMutation.mutate(
        { playlistId: decodedId, trackId: track.id },
        {
          onSuccess: () => toast(t("common.added_to_playlist"), "success"),
          onError: (error: unknown) => {
            if (error instanceof ApiError && error.status === 409) {
              toast(t("common.track_already_in_playlist"), "error");
            } else {
              toast(t("common.failed_add_track"), "error");
            }
          },
        },
      );
    },
    [decodedId, addTrackMutation, toast, t],
  );

  const handleAddToQueue = useCallback(() => {
    if (!viewData || viewData.tracks.length === 0) return;
    for (const track of viewData.tracks) {
      playerEngine.addToQueue(track);
    }
    toast(t("playlist.added_to_queue"), "info");
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

  const handleShare = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard && decodedId && decodedId !== "likes") {
      navigator.clipboard.writeText(buildShareUrl("playlist", decodedId));
      toast(t("common.link_copied"), "info");
    }
  }, [t, toast, decodedId]);

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

  if (!isLoading && !viewData) {
    return (
      <div className="page-transition h-full w-full bg-bg-primary flex items-center justify-center">
        <span className="text-text-secondary">
          {playlistError
            ? t("playlist.error_loading")
            : t("playlist.not_found")}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="page-transition relative h-full w-full overflow-y-auto bg-bg-primary pb-[24px]"
    >
      <div className="relative z-1 grid grid-cols-1 items-start w-full">
        {/* Real Content Layer */}
        {isReady && viewData && (
          <div className="col-start-1 row-start-1 w-full">
            {viewData.coverUrl && (
              <div
                className="pointer-events-none absolute left-0 top-0 z-0 w-full h-[450px]"
                style={{
                  backgroundImage: `url(${heroCoverSrc})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(90px) saturate(150%)",
                  opacity: 0.15,
                  maskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
                }}
              />
            )}
            <div className="relative z-10 px-[32px] pt-[24px]">
              <Link
                to="/library"
                className="inline-flex items-center gap-[8px] text-text-secondary no-underline transition-colors duration-200 hover:text-text-primary cursor-pointer"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                <ArrowLeftLine size={18} />
                <span className="text-[14px] font-[500]">{t("common.back")}</span>
              </Link>

              <section className="mt-[24px] flex items-start gap-[24px]">
                <div className="relative h-[180px] w-[180px] shrink-0 overflow-hidden rounded-xl bg-border-alpha-14 flex items-center justify-center">
                  {(() => {
                    const urls =
                      viewData.coverUrls ??
                      (viewData.coverUrl ? [viewData.coverUrl] : []);
                    if (urls.length === 0) {
                      return isLikesMode ? (
                        <HeartFill size={64} className="text-border-alpha-33" />
                      ) : (
                        <PlaylistFill size={64} className="text-border-alpha-33" />
                      );
                    }
                    if (urls.length === 1) {
                      return (
                        <CoverImage
                          src={urls[0]}
                          alt={viewData.title}
                          fill
                          sizes="170px"
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
                                sizes="85px"
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
                </div>

                <div className="flex min-h-[180px] flex-1 justify-between">
                  <div className="flex flex-col justify-center">
                    <h1
                      ref={titleRef}
                      className={`m-0 text-[40px] leading-[1.0] text-text-primary ${
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
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {viewData.title}
                    </h1>
                    {isLikesMode ? (
                      <p
                        className="m-0 mt-[8px] max-w-[480px] text-[14px] leading-[1.5] text-text-secondary line-clamp-2"
                        style={{
                          fontFamily: "var(--font-inter), sans-serif",
                          fontWeight: 400,
                        }}
                      >
                        {viewData.description}
                      </p>
                    ) : viewData.bio || isEditingDescription ? (
                      <p
                        ref={descriptionRef}
                        className={`m-0 mt-[8px] max-w-[480px] text-[14px] leading-[1.5] text-text-secondary line-clamp-2 cursor-text outline-none transition-colors empty:min-h-[21px] ${
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
                        style={{
                          fontFamily: "var(--font-inter), sans-serif",
                          fontWeight: 400,
                        }}
                      >
                        {viewData.bio}
                      </p>
                    ) : (
                      <p
                        className="m-0 mt-[8px] max-w-[480px] text-[14px] leading-[1.5] text-text-secondary line-clamp-2"
                        style={{
                          fontFamily: "var(--font-inter), sans-serif",
                          fontWeight: 400,
                        }}
                      >
                        {viewData.description}
                      </p>
                    )}
                    <p
                      className="m-0 mt-[6px] text-[13px] text-text-tertiary"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: 400,
                      }}
                    >
                      {viewData.showCountInMeta ? `${viewData.countLabel} • ` : ""}
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
                    </p>

                    <div className="mt-[16px] flex items-center gap-[10px]">
                      <Button
                        variant="primary"
                        onClick={handlePlayAll}
                        disabled={currentTracks.length === 0}
                        className="!h-[42px] !text-[16px] !font-[500] px-[24px]"
                      >
                        <PlayFill size={16} />
                        {t("playlist.play_all")}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleAddToQueue}
                        disabled={currentTracks.length === 0}
                        className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                        title={t("playlist.add_to_queue")}
                      >
                        <AnimatePresence mode="wait">
                          {addedToQueue ? (
                            <motion.span
                              key="check"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.08 }}
                              className="flex items-center justify-center text-emerald-400"
                            >
                              <CheckLine size={20} />
                            </motion.span>
                          ) : (
                            <motion.span
                              key="add"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.08 }}
                              className="flex items-center justify-center"
                            >
                              <AddLine size={20} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-end gap-[10px] pb-[6px] pr-[16px]">
                    {isLikesMode && (
                      <Button
                        variant="outline"
                        onClick={() => useModalStore.getState().openImportLikes()}
                        className="!h-[42px] px-[16px]"
                      >
                        <Upload2Line size={16} />
                        {t("playlist.import")}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      onClick={handleShare}
                      className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                      title={t("common.share")}
                    >
                      <ShareForwardLine size={20} />
                    </Button>

                    {!isLikesMode && (
                      <DropdownMenu
                        trigger={
                          <Button
                            variant="outline"
                            className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                            title={t("common.more")}
                          >
                            <More2Line size={20} />
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
                            id: "make-public",
                            icon: <LuGlobe size={15} />,
                            label: t("common.make_public"),
                            onClick: () => {},
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
              </section>

              {currentTracks.length === 0 ? (
                <div className="mt-[16px] flex flex-col items-center justify-center gap-[12px] rounded-xl bg-bg-elevated/60 px-[24px] py-[56px] text-center">
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
                  {!isLikesMode && decodedId && (
                    <Button
                      variant="outline"
                      onClick={() => setAddSongsOpen(true)}
                      className="!h-[36px] mt-[4px] px-[16px]"
                    >
                      <Search2Line size={15} />
                      {t("playlist.add_songs")}
                    </Button>
                  )}
                </div>
              ) : (
              <div
                ref={trackListContainerRef}
                className="relative mt-[16px]"
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

      <AddSongsModal
        open={addSongsOpen}
        onClose={() => setAddSongsOpen(false)}
        onAddTrack={handleAddTrackFromSearch}
      />
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
