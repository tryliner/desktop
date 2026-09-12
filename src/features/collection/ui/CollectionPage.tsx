import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo, Suspense } from "react";
import CollectionPageSkeleton from "./CollectionPageSkeleton";
import {
  AddLine,
  ArrowLeftLine,
  PlayFill,
  NewFolderLine,
  FolderCheckFill,
  ShareForwardLine,
} from "@mingcute/react";
import Button from "@/shared/ui/Button";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useCoverSrc } from "@/features/covers";
import { playerEngine } from "@/features/player";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/shared/ui";
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
  const heroCoverSrc = useCoverSrc(data?.coverUrl);
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

  if (!loading && !data) {
    return (
      <div className="page-transition h-full w-full bg-bg-primary flex items-center justify-center">
        <span className="text-text-secondary">{t("collection.not_found")}</span>
      </div>
    );
  }

  const isAlbum = type !== "playlist";

  return (
    <div className="page-transition relative h-full w-full overflow-y-auto bg-bg-primary pb-[24px]">
      <div className="relative z-1 grid grid-cols-1 items-start w-full">
        {/* Real Content Layer */}
        {isReady && data && (
          <div className="col-start-1 row-start-1 w-full">
            {data.coverUrl && (
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
              <button
                type="button"
                onClick={() =>
                  window.history.length > 1 ? navigate(-1) : navigate("/library")
                }
                className="inline-flex items-center gap-[10px] text-text-primary no-underline transition-opacity duration-200 hover:opacity-80 border-0 bg-transparent cursor-pointer p-0"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                <ArrowLeftLine size={24} />
                <span className="text-[28px] font-[350]">{data.title}</span>
              </button>

              <section className="mt-[20px] flex items-start gap-[28px]">
                <div className="relative h-[170px] w-[170px] shrink-0 overflow-hidden rounded-xl bg-border-alpha-14">
                  {data.coverUrl && (
                    <CoverImage
                      src={data.coverUrl}
                      alt={data.title}
                      fill
                      sizes="170px"
                      className="object-cover"
                      draggable={false}
                    />
                  )}
                </div>

                <div className="flex min-h-[170px] flex-1 justify-between">
                  <div className="flex flex-col justify-center">
                    <h1
                      className="m-0 text-[34px] leading-[1.02] text-text-primary"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: 400,
                      }}
                    >
                      {data.title}
                    </h1>
                    <p
                      className="m-0 mt-[6px] max-w-[340px] text-[18px] leading-[1.2] text-text-tertiary"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: 350,
                      }}
                    >
                      {data.description}
                    </p>
                    <p
                      className="m-0 mt-[8px] text-[14px] text-text-secondary"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: 400,
                      }}
                    >
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
                    </p>

                    <div className="mt-[16px] flex items-center gap-[10px]">
                      <Button
                        variant="primary"
                        onClick={handlePlayAll}
                        className="!h-[42px] !text-[16px] !font-[500] px-[24px]"
                      >
                        <PlayFill size={16} />
                        {t("common.play_all")}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleAddToQueue}
                        className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                        title={t("common.add_to_queue")}
                      >
                        <AddLine size={20} />
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleSaveToLibrary}
                        className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
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
                              <FolderCheckFill size={20} />
                            </motion.span>
                          ) : (
                            <motion.span
                              key="unsaved"
                              initial={{ scale: 0.5, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0.5, rotate: 20 }}
                              className="flex"
                            >
                              <NewFolderLine size={20} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-end gap-[10px] pb-[6px] pr-[16px]">
                    <Button
                      variant="outline"
                      onClick={handleShare}
                      className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                      title={t("common.share")}
                    >
                      <ShareForwardLine size={20} />
                    </Button>
                  </div>
                </div>
              </section>

              <section className="mt-[20px]">
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
        )}

        {/* Direct Crossfade Skeleton Layer */}
        {!skeletonExited && (
          <div
            className={`col-start-1 row-start-1 w-full z-10 transition-opacity duration-300 ease-out ${
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
