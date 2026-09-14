import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import CollectionPageSkeleton from "./CollectionPageSkeleton";
import {
  AddLine,
  PlayFill,
  NewFolderLine,
  FolderCheckFill,
  ShareForwardLine,
  PlaylistFill,
} from "@mingcute/react";
import Button from "@/shared/ui/Button";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import CoverImage from "@/features/covers/ui/CoverImage";
import { playerEngine } from "@/features/player";
import { AnimatePresence, motion } from "framer-motion";
import { useToast, EntitySidebar, StickyHeader, SIDEBAR_TITLE_CLASS, SIDEBAR_SUBTITLE_CLASS } from "@/shared/ui";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { buildShareUrl } from "@/shared/utils/share";
import { useExternalItems } from "@/features/library/hooks";
import { useCollection } from "../hooks/useCollection";

function CollectionContent() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, loading } = useCollection(type, id);
  const entityType = type === "playlist" ? "playlist" : "album";
  const decodedId = id ? decodeURIComponent(id) : "";

  const { data: savedAlbums } = useExternalItems("album");
  const inLibrary =
    entityType === "album" &&
    savedAlbums.some((album) => album.id === decodedId);

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

  const handlePlayAll = () => {
    if (!data || data.tracks.length === 0) return;
    const [first] = data.tracks;
    playerEngine.clearQueue();
    playerEngine.playTrack(first, data.tracks, playbackContext, data.coverUrl);
  };

  const { toast } = useToast();

  const handleAddToQueue = () => {
    if (!data || data.tracks.length === 0) return;
    for (const track of data.tracks) {
      playerEngine.addToQueue(track);
    }
    toast(t("collection.added_to_queue"), "info", {
      description: data.title || undefined,
    });
  };

  const handleSaveToLibrary = () => {
    if (!data || !id) return;
    const decoded = decodeURIComponent(id);
    if (inLibrary) {
      useModalStore.getState().openRemoveFromLibrary({
        id: decoded,
        title: data.title,
        coverUrl: data.coverUrl,
        type: entityType,
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
  const [isScrolled, setIsScrolled] = useState(false);

  if (!loading && !data) {
    return (
      <div className="page-transition h-full w-full bg-bg-primary flex items-center justify-center">
        <span className="text-text-secondary">{t("collection.not_found")}</span>
      </div>
    );
  }

  const isAlbum = type !== "playlist";

  return (
    <div className="page-transition relative h-full w-full overflow-hidden bg-bg-primary">
      <StickyHeader
        isScrolled={isScrolled}
        showBack={isReady}
        title={data?.title}
        thumbnail={
          data?.coverUrl ? (
            <div className="relative h-[24px] w-[24px] shrink-0 overflow-hidden rounded-[4px] bg-border-alpha-14">
              <CoverImage
                src={data.coverUrl}
                alt={data.title}
                fill
                sizes="24px"
                className="object-cover"
                draggable={false}
              />
            </div>
          ) : (
            <div className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[4px] bg-border-alpha-14 text-text-secondary">
              <PlaylistFill size={13} />
            </div>
          )
        }
      />
      <div className="relative z-1 grid grid-cols-1 w-full h-full min-h-0 overflow-hidden">
        {isReady && data && (
          <div className="col-start-1 row-start-1 w-full h-full min-h-0 overflow-hidden">
            <div className="relative z-10 flex flex-row items-stretch gap-[32px] px-[32px] pt-[56px] pb-[24px] h-full w-full min-h-0 box-border">
              <div
                className="shrink-0 w-[280px] self-start"
                data-window-drag
                onWheel={(e) => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop += e.deltaY;
                  }
                }}
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
                  data.description ? (
                    <p className={SIDEBAR_SUBTITLE_CLASS}>{data.description}</p>
                  ) : undefined
                }
                meta={
                  <>
                    {data.tracks.length} {t("collection.tracks_count")} •{" "}
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
                    </>
                  }
                  primaryAction={
                    <>
                      <Button
                        variant="primary"
                        onClick={handlePlayAll}
                        className="!h-[36px] w-full !text-[14px] !font-[500] px-[16px]"
                      >
                        <PlayFill size={16} />
                        {t("common.play_all")}
                      </Button>
                    </>
                  }
                  actions={
                    <>
                      <Button
                        variant="outline"
                        onClick={handleAddToQueue}
                        className="!h-[36px] !w-[36px] !p-0 flex items-center justify-center text-text-primary"
                        title={t("common.add_to_queue")}
                      >
                        <AddLine size={18} />
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleSaveToLibrary}
                        className="!h-[36px] !w-[36px] !p-0 flex items-center justify-center text-text-primary"
                        title={
                          inLibrary
                            ? t("common.remove_from_library")
                            : t("common.save_to_library")
                        }
                      >
                        <AnimatePresence mode="wait">
                          {inLibrary ? (
                            <motion.span
                              key="saved"
                              initial={{ scale: 0.5, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0.5, rotate: 20 }}
                              className="flex"
                            >
                              <FolderCheckFill size={18} />
                            </motion.span>
                          ) : (
                            <motion.span
                              key="unsaved"
                              initial={{ scale: 0.5, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0.5, rotate: 20 }}
                              className="flex"
                            >
                              <NewFolderLine size={18} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleShare}
                        className="!h-[36px] !w-[36px] !p-0 flex items-center justify-center text-text-primary"
                        title={t("common.share")}
                      >
                        <ShareForwardLine size={18} />
                      </Button>
                    </>
                  }
                />
              </div>

              <div
                ref={scrollRef}
                data-no-window-drag
                onScroll={(e) => {
                  const nextScrolled = e.currentTarget.scrollTop > 56;
                  setIsScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
                }}
                className="min-w-0 flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden pb-[24px]"
              >
              <section>
                <div className="flex flex-col -mx-[8px]">
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
