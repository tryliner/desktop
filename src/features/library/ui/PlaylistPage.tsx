import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import PlaylistPageSkeleton from "./PlaylistPageSkeleton";
import { useToast } from "@/shared/ui";
import {
  AddLine,
  ArrowLeftLine,
  PlayFill,
  ShareForwardLine,
  More2Line,
  HeartFill,
  PlaylistFill,
  Upload2Line,
} from "@mingcute/react";
import { LuPencil, LuGlobe, LuTrash2 } from "react-icons/lu";
import Button from "@/shared/ui/Button";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useCoverSrc } from "@/features/covers";
import { useModalStore } from "../store/modalStore";
import {
  usePlaylist,
  useLikedTracks,
  useReorderPlaylistTracks,
} from "../hooks";
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
  onMove?: (itemId: string, beforeItemId: string) => void;
}

function TrackItem({
  track,
  playlistId,
  playlistTitle,
  playlistCoverUrl,
  allTracks,
  style,
  onMove,
}: TrackItemProps) {
  const wasDraggedRef = useRef(false);

  return (
    <div
      style={style}
      draggable={Boolean(playlistId && track.playlistItemId)}
      onDragStart={(event) => {
        if (!track.playlistItemId) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/x-liner-playlist-item",
          track.playlistItemId,
        );
      }}
      onDragOver={(event) => {
        if (playlistId && track.playlistItemId) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const itemId = event.dataTransfer.getData(
          "application/x-liner-playlist-item",
        );
        if (itemId && itemId !== track.playlistItemId && track.playlistItemId)
          onMove?.(itemId, track.playlistItemId);
      }}
    >
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
          if (wasDraggedRef.current) return;
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
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const isLikesMode = id === "likes";
  const decodedId = id ? decodeURIComponent(id) : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const reorderTracks = useReorderPlaylistTracks();
  const titleRef = useRef<HTMLHeadingElement>(null);

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
        description: t("common.tracks", { count: tracks.length }),
        coverUrl: "",
        tracks,
        revision: 0,
      };
    }
    if (!playlistDetail) return null;
    return {
      title: playlistDetail.title || t("playlist.untitled_playlist"),
      description: t("common.tracks", { count: playlistDetail.trackCount }),
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

  const handleAddToQueue = useCallback(() => {
    if (!viewData || viewData.tracks.length === 0) return;
    for (const track of viewData.tracks) {
      playerEngine.addToQueue(track);
    }
  }, [viewData]);

  const handleMoveTrack = useCallback(
    (itemId: string, beforeItemId: string) => {
      if (!decodedId || !viewData || isLikesMode) return;
      reorderTracks.mutate({
        playlistId: decodedId,
        itemId,
        beforeItemId,
        revision: viewData.revision,
      });
    },
    [decodedId, isLikesMode, reorderTracks, viewData],
  );

  const rowVirtualizer = useVirtualizer({
    count: viewData?.tracks.length || 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const { toast } = useToast();

  const handleShare = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast(t("common.link_copied"), "info");
    }
  }, [t, toast]);

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
                className="inline-flex items-center gap-[10px] text-text-primary no-underline transition-opacity duration-200 hover:opacity-80 cursor-pointer"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                <ArrowLeftLine size={24} />
                <span className="text-[28px] font-[350]">{viewData.title}</span>
              </Link>

              <section className="mt-[20px] flex items-start gap-[28px]">
                <div className="relative h-[170px] w-[170px] shrink-0 overflow-hidden rounded-xl bg-border-alpha-14 flex items-center justify-center">
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

                <div className="flex min-h-[170px] flex-1 justify-between">
                  <div className="flex flex-col justify-center">
                    <h1
                      ref={titleRef}
                      className={`m-0 text-[34px] leading-[1.02] text-text-primary ${
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
                        fontWeight: 400,
                      }}
                    >
                      {viewData.title}
                    </h1>
                    <p
                      className="m-0 mt-[6px] max-w-[340px] text-[18px] leading-[1.2] text-text-tertiary"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: 350,
                      }}
                    >
                      {viewData.description}
                    </p>
                    <p
                      className="m-0 mt-[8px] text-[14px] text-text-secondary"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: 400,
                      }}
                    >
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
                        className="!h-[42px] !text-[16px] !font-[500] px-[24px]"
                      >
                        <PlayFill size={16} />
                        {t("playlist.play_all")}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleAddToQueue}
                        className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                        title={t("common.add_to_queue")}
                      >
                        <AddLine size={20} />
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

              {/* Track list */}
              <div
                className="relative mt-[16px]"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const track = viewData!.tracks[virtualRow.index];
                  return (
                    <TrackItem
                      key={
                        track.playlistItemId ?? `${track.id}-${virtualRow.index}`
                      }
                      track={track}
                      playlistId={isLikesMode ? undefined : (decodedId ?? undefined)}
                      playlistTitle={viewData!.title}
                      playlistCoverUrl={viewData!.coverUrl}
                      allTracks={viewData!.tracks}
                      onMove={handleMoveTrack}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Direct Crossfade Skeleton Layer */}
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
