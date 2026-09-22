import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState, useMemo, useRef, Suspense } from "react";
import CollectionPageSkeleton from "./CollectionPageSkeleton";
import {
  AddLine,
  PlayFill,
  NewFolderLine,
  FolderCheckFill,
  ShareForwardLine,
  PlaylistFill,
  PlaylistLine,
  DiscLine,
  MusicLine,
  CalendarLine,
  CheckLine,
  More2Line,
  ArrowLeftLine,
} from "@mingcute/react";
import { LuShuffle } from "react-icons/lu";
import Button from "@/shared/ui/Button";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import CoverImage from "@/features/covers/ui/CoverImage";
import { playerEngine } from "@/features/player";
import { AnimatePresence, motion } from "framer-motion";
import {
  useToast,
  EntitySidebar,
  DropdownMenu,
  SIDEBAR_TITLE_CLASS,
  SIDEBAR_SUBTITLE_CLASS,
} from "@/shared/ui";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { buildShareUrl } from "@/shared/utils/share";
import { useExternalItems } from "@/features/library/hooks";
import { useCollection } from "../hooks/useCollection";
import { useIsContentTransparent } from "@/features/settings/store/customizationStore";

function CollectionContent() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get("type");
  const type = typeParam === "playlist" ? "playlist" : "album";
  const id = searchParams.get("id");
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasCustomBg = useIsContentTransparent();

  const { data, loading } = useCollection(type, id);
  const entityType = type === "playlist" ? "playlist" : "album";
  const decodedId = id ? decodeURIComponent(id) : "";

  const { data: savedAlbums } = useExternalItems("album");
  const { data: savedPlaylists } = useExternalItems("playlist");
  const inLibrary =
    entityType === "album"
      ? savedAlbums.some((album) => album.id === decodedId)
      : savedPlaylists.some((playlist) => playlist.id === decodedId);

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [skeletonExited, setSkeletonExited] = useState(false);

  const urlsToPreload = useMemo(() => {
    if (!data) return [];
    const urls = new Set<string>();
    if (data.coverUrl) urls.add(data.coverUrl);
    for (const track of data.tracks.slice(0, 8)) {
      if (track.coverUrl) urls.add(track.coverUrl);
    }
    return Array.from(urls);
  }, [data]);

  useEffect(() => {
    if (loading || !data) {
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
  }, [loading, data, urlsToPreload]);

  const isReady = !loading && !!data && imagesLoaded;

  useEffect(() => {
    if (isReady && !skeletonExited) {
      const timer = setTimeout(() => {
        setSkeletonExited(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isReady, skeletonExited]);

  const playbackContext = id ? `${entityType}:${decodedId}` : (data?.title || null);

  const { toast } = useToast();
  const [addedToQueue, setAddedToQueue] = useState(false);

  const handlePlayAll = () => {
    if (!data || data.tracks.length === 0) return;
    const [first] = data.tracks;
    playerEngine.clearQueue();
    playerEngine.playTrack(first, data.tracks, playbackContext, data.coverUrl);
  };

  const handleShufflePlay = useCallback(() => {
    if (!data || data.tracks.length === 0) return;
    playerEngine.clearQueue();
    void playerEngine.playShuffled(
      data.tracks,
      playbackContext,
      data.coverUrl,
    );
  }, [data, playbackContext]);

  const handleAddToQueue = useCallback(() => {
    if (!data || data.tracks.length === 0) return;
    for (const track of data.tracks) {
      playerEngine.addToQueue(track);
    }
    toast(t("collection.added_to_queue"), "info", {
      description: data.title || undefined,
    });
    setAddedToQueue(true);
    const timer = setTimeout(() => {
      setAddedToQueue(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, toast, t]);

  const handleSaveToLibrary = () => {
    if (!data || !id) return;
    const decoded = decodeURIComponent(id);
    if (inLibrary) {
      useModalStore.getState().openRemoveFromLibrary({
        id: decoded,
        title: data.title,
        coverUrl: data.coverUrl,
        type: entityType,
        isOwned: false,
      });
    } else {
      useModalStore.getState().openAddToLibrary({
        id: decoded,
        title: data.title,
        coverUrl: data.coverUrl,
        type: entityType,
        totalTracks: entityType === "playlist" ? data.tracks.length : undefined,
      });
    }
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && decodedId) {
      navigator.clipboard.writeText(buildShareUrl(entityType, decodedId));
      toast(t("common.link_copied"), "checkmark", {
        description: data?.title || undefined,
      });
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const targetScrollTopRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const handleTopWheel = useCallback((e: React.WheelEvent) => {
    const container = scrollRef.current;
    if (!container) return;

    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;

    const current = targetScrollTopRef.current ?? container.scrollTop;
    const target = Math.max(0, Math.min(maxScroll, current + e.deltaY));
    targetScrollTopRef.current = target;

    if (rafIdRef.current === null) {
      const step = () => {
        if (!scrollRef.current || targetScrollTopRef.current === null) {
          rafIdRef.current = null;
          return;
        }
        const now = scrollRef.current.scrollTop;
        const diff = targetScrollTopRef.current - now;
        if (Math.abs(diff) < 0.5) {
          scrollRef.current.scrollTop = targetScrollTopRef.current;
          targetScrollTopRef.current = null;
          rafIdRef.current = null;
          return;
        }
        scrollRef.current.scrollTop = now + diff * 0.25;
        rafIdRef.current = requestAnimationFrame(step);
      };
      rafIdRef.current = requestAnimationFrame(step);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/library");
    }
  }, [navigate]);

  if (!loading && !data) {
    return (
      <div className="h-full w-full bg-transparent flex items-center justify-center">
        <span className="text-text-secondary">{t("collection.not_found")}</span>
      </div>
    );
  }

  const isAlbum = type !== "playlist";

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">

      <div className="absolute top-0 left-0 right-0 h-[56px] z-10 flex flex-row items-stretch select-none pointer-events-none">
        <div
          data-window-drag
          onContextMenu={(e) => e.preventDefault()}
          className="w-[328px] shrink-0 h-full pointer-events-auto"
        />
        <div
          data-window-drag
          onContextMenu={(e) => e.preventDefault()}
          onWheel={handleTopWheel}
          className="flex-1 min-w-0 h-full pointer-events-auto"
        />
      </div>
      {isReady && (
        <button
          type="button"
          onClick={handleBack}
          title={t("common.back")}
          aria-label={t("common.back")}
          data-no-window-drag
          className={`absolute top-[12px] left-[32px] z-20 group inline-flex h-[32px] shrink-0 items-center gap-[6px] rounded-md px-[10px] active:scale-[0.94] transition-all cursor-pointer select-none pointer-events-auto text-[13px] font-[500] border-0 !border-none ${
            hasCustomBg
              ? "apple-glass-pill !border-none"
              : "bg-bg-panel/85 backdrop-blur-xl text-text-primary hover:bg-bg-panel border-0 !border-none"
          }`}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          <ArrowLeftLine
            size={16}
            className="transition-transform duration-150 group-hover:-translate-x-0.5"
          />
          <span className="relative -left-[1.5px] top-[1px]">{t("common.back")}</span>
        </button>
      )}
      <div className="relative z-1 grid grid-cols-1 w-full h-full min-h-0 overflow-hidden">
        {isReady && data && (
          <div className="col-start-1 row-start-1 w-full h-full min-h-0 overflow-hidden">
            <div className="relative z-10 flex flex-row items-stretch gap-[16px] pl-[32px] pr-[16px] h-full w-full min-h-0 box-border">
              <div
                className="shrink-0 w-[280px] self-start pt-[56px] pb-[24px]"
                data-no-window-drag
              >
                <EntitySidebar
                cover={
                  data.coverUrl ? (
                    <CoverImage
                      src={data.coverUrl}
                      alt={data.title}
                      fill
                      sizes="280px"
                      className="object-cover"
                      draggable={false}
                    />
                  ) : (
                    <PlaylistFill size={48} className="text-border-alpha-33" />
                  )
                }

                title={
                  <h1 className={SIDEBAR_TITLE_CLASS}>{data.title}</h1>
                }
                subtitle={
                  data.artists && data.artists.length > 0 ? (
                    <p className={`${SIDEBAR_SUBTITLE_CLASS} flex items-center flex-wrap gap-x-[4px]`}>
                      {data.artists.map((artist, i) => (
                        <span key={artist.id || i} className="inline-flex items-center">
                          {artist.id ? (
                            <Link
                              to={`/artist?id=${encodeURIComponent(artist.id)}`}
                              className="text-text-secondary hover:text-text-primary transition-colors no-underline"
                            >
                              {artist.name}
                            </Link>
                          ) : (
                            <span>{artist.name}</span>
                          )}
                          {i < data.artists!.length - 1 && (
                            <span className="text-text-tertiary ml-[2px]">,</span>
                          )}
                        </span>
                      ))}
                    </p>
                  ) : data.author ? (
                    <p className={SIDEBAR_SUBTITLE_CLASS}>{data.author}</p>
                  ) : data.description ? (
                    <p className={SIDEBAR_SUBTITLE_CLASS}>{data.description}</p>
                  ) : undefined
                }
                meta={
                  <div className="flex items-center flex-wrap gap-[6px]">
                    {data.year && (
                      <div
                        className={`inline-flex h-[26px] items-center gap-[5px] rounded-md px-[8px] text-[12px] font-[500] select-none ${
                          hasCustomBg
                            ? "apple-glass-pill"
                            : "bg-bg-panel border border-border-primary/50 text-text-tertiary"
                        }`}
                      >
                        <CalendarLine size={12} className={hasCustomBg ? "text-white shrink-0" : "text-text-tertiary shrink-0"} />
                        <span>{data.year}</span>
                      </div>
                    )}

                    <div
                      className={`inline-flex h-[26px] items-center gap-[6px] rounded-md px-[8px] text-[12px] font-[400] select-none ${
                        hasCustomBg
                          ? "apple-glass-pill"
                          : "bg-bg-panel border border-border-primary/40 text-text-tertiary"
                      }`}
                    >
                      <MusicLine size={13} className={hasCustomBg ? "text-white shrink-0" : "text-text-tertiary shrink-0"} />
                      <span>
                        {data.tracks.length} {t("collection.tracks_count")}
                      </span>
                      <span
                        className={`w-[3px] h-[3px] rounded-full shrink-0 ${hasCustomBg ? "bg-white/50" : "bg-text-tertiary/40"}`}
                        aria-hidden
                      />
                      <span>
                        {(() => {
                          const totalMs = data.tracks.reduce(
                            (acc, t) => acc + (t.durationMs || 0),
                            0,
                          );
                          const totalMins = Math.floor(totalMs / 60000);
                          if (totalMins > 60) {
                            return `${Math.floor(totalMins / 60)} ${t("collection.hr")} ${totalMins % 60} ${t("collection.min")}`;
                          }
                          const totalSecs = Math.floor((totalMs % 60000) / 1000);
                          return `${totalMins} ${t("collection.min")} ${totalSecs} ${t("collection.sec")}`;
                        })()}
                      </span>
                    </div>
                  </div>
                }
                  primaryAction={
                    <div className="flex flex-col gap-[8px] w-full">
                      <Button
                        variant={hasCustomBg ? "glass-primary" : "primary"}
                        onClick={handlePlayAll}
                        disabled={!data || data.tracks.length === 0}
                        className="!h-[36px] w-full !text-[13.5px] !font-[500] px-[16px] flex items-center justify-center gap-[6px]"
                      >
                        <PlayFill size={16} />
                        <span>{t("common.play_all")}</span>
                      </Button>

                      <div className="flex items-center gap-[8px] w-full">
                        <Button
                          variant={hasCustomBg ? "glass-action" : "outline"}
                          onClick={handleAddToQueue}
                          disabled={!data || data.tracks.length === 0}
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
                          variant={hasCustomBg ? "glass-action" : "outline"}
                          onClick={handleShufflePlay}
                          disabled={!data || data.tracks.length === 0}
                          className="!h-[36px] !w-[36px] shrink-0 !p-0 flex items-center justify-center text-text-primary"
                          title={t("common.shuffle")}
                        >
                          <LuShuffle size={16} />
                        </Button>

                        <DropdownMenu
                          trigger={
                            <Button
                              variant={hasCustomBg ? "glass-action" : "outline"}
                              className="!h-[36px] !w-[36px] shrink-0 !p-0 flex items-center justify-center text-text-primary"
                              title={t("common.more")}
                            >
                              <More2Line size={18} />
                            </Button>
                          }
                          items={[
                            {
                              id: "library",
                              icon: inLibrary ? (
                                <FolderCheckFill size={16} />
                              ) : (
                                <NewFolderLine size={16} />
                              ),
                              label: inLibrary
                                ? t("common.remove_from_library")
                                : t("common.save_to_library"),
                              onClick: handleSaveToLibrary,
                            },
                            {
                              id: "share",
                              icon: <ShareForwardLine size={16} />,
                              label: t("common.share"),
                              onClick: handleShare,
                            },
                          ]}
                        />
                      </div>
                    </div>
                  }
                />
              </div>

              <div
                ref={scrollRef}
                data-no-window-drag
                onScroll={() => {
                  if (rafIdRef.current === null) {
                    targetScrollTopRef.current = null;
                  }
                }}
                className="min-w-0 flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden px-[8px] pt-[56px] pb-[24px] overscroll-contain"
                style={{ willChange: "scroll-position" }}
              >
              <section>
                <div className="flex flex-col">
                  {data.tracks.map((track, index) => (
                    <SongCardWithMenu
                      key={track.id}
                      id={track.id}
                      title={track.title}
                      artists={track.artists}
                      artistId={track.artistId}
                      artistList={track.artistList}
                      coverUrl={track.coverUrl || data.coverUrl}
                      trackNumber={isAlbum ? index + 1 : undefined}
                      duration={
                        track.durationMs
                          ? `${Math.floor(track.durationMs / 60000)}:${Math.floor(
                              (track.durationMs % 60000) / 1000,
                            )
                              .toString()
                              .padStart(2, "0")}`
                          : undefined
                      }
                      durationMs={track.durationMs}
                      explicit={track.explicit}
                      onPlay={() =>
                        playerEngine.playTrack(
                          track,
                          data.tracks,
                          playbackContext,
                          data.coverUrl,
                        )
                      }
                    />
                  ))}
                </div>
              </section>
              </div>
            </div>
          </div>
        )}

        {/* Direct Crossfade Skeleton Layer */}
        {!skeletonExited && (
          <div
            className={`col-start-1 row-start-1 w-full h-full z-10 transition-opacity duration-300 ease-out overflow-hidden ${
              isReady ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
            }`}
            onTransitionEnd={() => setSkeletonExited(true)}
          >
            <CollectionPageSkeleton isAlbum={isAlbum} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<CollectionPageSkeleton />}>
      <CollectionContent />
    </Suspense>
  );
}
