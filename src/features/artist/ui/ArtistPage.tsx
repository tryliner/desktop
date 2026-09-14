import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, Suspense, useRef, useCallback, useMemo } from "react";
import {
  PlayFill,
  AddLine,
  NewFolderLine,
  FolderCheckFill,
  ShareForwardLine,
} from "@mingcute/react";
import Button from "@/shared/ui/Button";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import AlbumCard from "@/features/collection/ui/AlbumCard";
import ReleaseCard from "@/features/collection/ui/ReleaseCard";
import ScrollableRow from "@/shared/ui/ScrollableRow";
import CoverImage from "@/features/covers/ui/CoverImage";
import { playerEngine } from "@/features/player";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/shared/types";
import { useToast, StickyHeader } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { api, mediaUrl, toMaxQualityAvatarUrl, toClientTrack, type ApiTrack } from "@/shared/api";
import { buildShareUrl } from "@/shared/utils/share";
import { useExternalItems } from "@/features/library/hooks";
import ArtistProfileModal from "./ArtistProfileModal";
import ArtistPageSkeleton from "./ArtistPageSkeleton";

interface ArtistAlbumViewModel {
  id: string;
  title: string;
  coverUrl: string;
  releaseDate?: string;
  totalTracks?: number;
  explicit?: boolean;
}

interface ArtistReleaseViewModel extends ArtistAlbumViewModel {
  releaseType: "single" | "ep";
}

import { useArtist } from "../hooks/useArtist";

function stripMarkdown(text: string): string {
  return text
    .replace(/(Дискография)(Официальный)/g, "$1\n\n$2")
    .replace(/(сайт|ВКонтакте|канал|#\d|TikTok)(Официальный|Сообщество|Страница|Телеграм|YouTube|TikTok|Twitch)/g, "$1, $2")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^•\s*/gm, "")
    .trim();
}

function ArtistContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");

  const { data, loading } = useArtist(id);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [skeletonExited, setSkeletonExited] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [loadingMore] = useState(false);
  const [hasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tracksSectionRef = useRef<HTMLElement>(null);

  const decodedId = id ? decodeURIComponent(id) : "";
  const { data: savedArtists } = useExternalItems("artist");
  const inLibrary = savedArtists.some((artist) => artist.id === decodedId);

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

  useEffect(() => {
    setIsScrolled(false);
    setShowAllTracks(false);
    setIsProfileModalOpen(false);
    setImagesLoaded(false);
    setSkeletonExited(false);
  }, [id]);

  const handlePlayAll = () => {
    if (!data || data.tracks.length === 0) return;
    const [first] = data.tracks;
    playerEngine.clearQueue();
    playerEngine.playTrack(first, data.tracks, data.title, data.coverUrl);
  };

  const { toast } = useToast();

  const handleAddToQueue = () => {
    if (!data || data.tracks.length === 0) return;
    data.tracks.forEach((track) => playerEngine.addToQueue(track));
    toast(t("artist.added_to_queue"), "info", {
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
        type: "artist",
      });
    } else {
      useModalStore.getState().openAddToLibrary({
        id: decoded,
        title: data.title,
        coverUrl: data.coverUrl,
        type: "artist",
      });
    }
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && decodedId) {
      navigator.clipboard.writeText(buildShareUrl("artist", decodedId));
      toast(t("common.link_copied"), "checkmark", {
        description: data?.title || undefined,
      });
    }
  };

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

  if (!loading && !data) {
    return (
      <div className="page-transition h-full w-full bg-bg-primary flex items-center justify-center">
        <span className="text-text-secondary">
          {t("artist.artist_not_found")}
        </span>
      </div>
    );
  }

  return (
    <div className="page-transition relative h-full w-full overflow-hidden bg-bg-primary">
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

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const container = e.currentTarget;
          let nextScrolled = false;
          if (tracksSectionRef.current) {
            const relativeTrackTop =
              tracksSectionRef.current.getBoundingClientRect().top -
              container.getBoundingClientRect().top;
            nextScrolled = relativeTrackTop <= 56;
          } else {
            nextScrolled = container.scrollTop > 260;
          }
          setIsScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
        }}
        className="relative z-1 h-full w-full overflow-y-auto pb-[32px]"
      >
        <StickyHeader
          isScrolled={isScrolled}
          title={data?.title}
          thumbnail={
            data?.coverUrl ? (
              <div className="relative h-[24px] w-[24px] shrink-0 overflow-hidden rounded-full bg-white/10">
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
              <div className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 text-[11px] font-bold">
                {data?.title ? data.title.charAt(0) : ""}
              </div>
            )
          }
        />

        <div className="relative z-1 grid grid-cols-1 items-start w-full">
          {isReady && data && (
            <div className="col-start-1 row-start-1 w-full pb-[32px]">
              <div className="relative w-full min-h-[340px] md:min-h-[380px] flex flex-col justify-between overflow-hidden">
                {data.coverUrl ? (
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <CoverImage
                      src={data.coverUrl}
                      alt={data.title}
                      fill
                      sizes="100vw"
                      className="object-cover object-center"
                      draggable={false}
                    />
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(to top, var(--bg-primary) 0%, color-mix(in srgb, var(--bg-primary) 90%, transparent) 25%, color-mix(in srgb, var(--bg-primary) 60%, transparent) 50%, color-mix(in srgb, var(--bg-primary) 20%, transparent) 75%, transparent 100%)",
                      }}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 z-0 bg-bg-elevated" />
                )}

                <div className="relative z-10 px-[32px] pt-[56px]" data-window-drag />

              <div className="relative z-10 px-[32px] pb-[20px] flex flex-col md:flex-row items-start md:items-end justify-between gap-[24px]">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-[8px] md:gap-[10px]">
                    <h1
                      className="m-0 text-[38px] md:text-[48px] font-[700] tracking-[-0.03em] leading-[1.05] text-text-primary"
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                      }}
                    >
                      {data.title}
                    </h1>
                    {data.verified ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-[24px] w-[24px] md:h-[32px] md:w-[32px] shrink-0 translate-y-[2px] md:translate-y-[3px] text-[#1d9bf0]"
                        fill="currentColor"
                        aria-label="Verified"
                      >
                        <path d="M10.007 2.10377C8.60544 1.65006 7.08181 2.28116 6.41156 3.59306L5.60578 5.17023C5.51004 5.35763 5.35763 5.51004 5.17023 5.60578L3.59306 6.41156C2.28116 7.08181 1.65006 8.60544 2.10377 10.007L2.64923 11.692C2.71404 11.8922 2.71404 12.1078 2.64923 12.308L2.10377 13.993C1.65006 15.3946 2.28116 16.9182 3.59306 17.5885L5.17023 18.3942C5.35763 18.49 5.51004 18.6424 5.60578 18.8298L6.41156 20.407C7.08181 21.7189 8.60544 22.35 10.007 21.8963L11.692 21.3508C11.8922 21.286 12.1078 21.286 12.308 21.3508L13.993 21.8963C15.3946 22.35 16.9182 21.7189 17.5885 20.407L18.3942 18.8298C18.49 18.6424 18.6424 18.49 18.8298 18.3942L20.407 17.5885C21.7189 16.9182 22.35 15.3946 21.8963 13.993L21.3508 12.308C21.286 12.1078 21.286 11.8922 21.3508 11.692L21.8963 10.007C22.35 8.60544 21.7189 7.08181 20.407 6.41156L18.8298 5.60578C18.6424 5.51004 18.49 5.35763 18.3942 5.17023L17.5885 3.59306C16.9182 2.28116 15.3946 1.65006 13.993 2.10377L12.308 2.64923C12.1078 2.71403 11.8922 2.71404 11.692 2.64923L10.007 2.10377Z" />
                        <path
                          d="M6.75977 11.7573L8.17399 10.343L11.0024 13.1715L16.6593 7.51465L18.0735 8.92886L11.0024 15.9999L6.75977 11.7573Z"
                          fill="#ffffff"
                        />
                      </svg>
                    ) : null}
                  </div>

                  {data.monthlyListeners ? (
                    <p
                      className="m-0 mt-[6px] text-[14px] text-text-secondary font-[400]"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {(() => {
                        const match = data.monthlyListeners.match(
                          /^([\d.,]+[KMBkmb]?)/,
                        );
                        const count = match ? match[1] : data.monthlyListeners;
                        return t("artist.monthly_audience", { count });
                      })()}
                    </p>
                  ) : data.followers ? (
                    <p
                      className="m-0 mt-[6px] text-[14px] text-text-secondary font-[400]"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {Intl.NumberFormat("en-US", { notation: "compact" }).format(
                        data.followers,
                      )}{" "}
                      {t("artist.followers")}
                    </p>
                  ) : null}

                  <div className="mt-[16px] flex items-center gap-[8px]">
                    <Button
                      variant="primary"
                      onClick={handlePlayAll}
                      className="!h-[38px] !text-[13px] !font-[500] px-[20px] flex items-center gap-[6px]"
                    >
                      <PlayFill size={15} />
                      <span>{t("artist.play")}</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleAddToQueue}
                      className="!h-[38px] !w-[38px] !p-0 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors bg-bg-panel/40 backdrop-blur-sm"
                      title={t("artist.add_to_queue")}
                    >
                      <AddLine size={18} />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleSaveToLibrary}
                      className="!h-[38px] !w-[38px] !p-0 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors bg-bg-panel/40 backdrop-blur-sm"
                      title={
                        inLibrary
                          ? t("artist.remove_from_library")
                          : t("artist.save_to_library")
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
                      className="!h-[38px] !w-[38px] !p-0 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors bg-bg-panel/40 backdrop-blur-sm"
                      title={t("artist.share")}
                    >
                      <ShareForwardLine size={18} />
                    </Button>
                  </div>
                </div>

                {data.description && (
                  <div className="w-full md:w-[340px] lg:w-[380px] shrink-0 rounded-md bg-bg-panel/90 p-[16px] backdrop-blur-md flex flex-col gap-[6px]">
                    <span
                      className="text-[15px] font-[600] tracking-[-0.01em] text-text-primary"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {t("artist.about_artist")}
                    </span>
                    <p
                      className="m-0 text-[13px] leading-[1.5] text-text-secondary font-[400] select-text line-clamp-3"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {stripMarkdown(data.description)}
                    </p>
                    {data.description.length > 120 && (
                      <button
                        type="button"
                        onClick={() => setIsProfileModalOpen(true)}
                        className="mt-[2px] self-start text-[12px] font-[500] text-text-tertiary hover:text-text-primary cursor-pointer bg-transparent border-0 p-0 transition-colors"
                        style={{ fontFamily: "var(--font-inter), sans-serif" }}
                      >
                        {t("artist.show_all")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="relative z-10 px-[32px] pt-[24px]">
              <div className="flex flex-col gap-[40px]">
                <section id="artist-tracks-section" ref={tracksSectionRef}>
                  <div className="flex items-center justify-between mb-[16px]">
                    <h2
                      className="text-[22px] font-[500] text-text-primary m-0"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {t("artist.popular_songs")}
                    </h2>
                    {data.tracks.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllTracks((prev) => !prev)}
                        className="text-[13px] font-[500] text-text-secondary hover:text-text-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
                        style={{ fontFamily: "var(--font-inter), sans-serif" }}
                      >
                        {showAllTracks ? t("artist.show_less") : t("artist.show_all")}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col -mt-[14px] -mx-[8px]">
                    {data.tracks.slice(0, 5).map((track) => (
                      <SongCardWithMenu
                        key={track.id}
                        id={track.id}
                        title={track.title}
                        artists={track.artists}
                        artistId={track.artistId}
                        artistList={track.artistList}
                        coverUrl={track.coverUrl || data.coverUrl}
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
                            data.title,
                            data.coverUrl,
                          )
                        }
                      />
                    ))}

                    <AnimatePresence initial={false}>
                      {showAllTracks && (
                        <motion.div
                          key="expanded-tracks"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
                          className="overflow-hidden flex flex-col"
                        >
                          {data.tracks.slice(5).map((track) => (
                            <SongCardWithMenu
                              key={track.id}
                              id={track.id}
                              title={track.title}
                              artists={track.artists}
                              artistId={track.artistId}
                              artistList={track.artistList}
                              coverUrl={track.coverUrl || data.coverUrl}
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
                                  data.title,
                                  data.coverUrl,
                                )
                              }
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {data.tracks.length === 0 && (
                      <p className="text-text-secondary px-[8px] py-[14px]">
                        {t("artist.no_popular_songs")}
                      </p>
                    )}
                  </div>
                </section>

                {data.albums.length > 0 && (
                  <section>
                    <h2
                      className="text-[22px] font-[500] text-text-primary mb-[16px]"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {t("artist.albums")}
                    </h2>
                    <ScrollableRow
                      overlayWidth="w-[32px]"
                      className="flex w-full gap-[16px] overflow-x-auto pb-[24px]"
                    >
                      {data.albums.map((album) => (
                        <AlbumCard
                          key={album.id}
                          id={album.id}
                          title={album.title}
                          coverUrl={album.coverUrl}
                          year={album.releaseDate}
                          explicit={album.explicit}
                          trackCount={album.totalTracks}
                          className="w-[180px] shrink-0"
                        />
                      ))}
                    </ScrollableRow>
                  </section>
                )}

                {data.singles.length > 0 && (
                  <section>
                    <h2
                      className="text-[22px] font-[500] text-text-primary mb-[16px]"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {t("artist.singles")}
                    </h2>
                    <ScrollableRow
                      overlayWidth="w-[32px]"
                      className="flex w-full gap-[16px] overflow-x-auto pb-[24px]"
                    >
                      {data.singles.map((single) => (
                        <ReleaseCard
                          key={single.id}
                          id={single.id}
                          title={single.title}
                          coverUrl={single.coverUrl}
                          releaseType={single.releaseType}
                          year={single.releaseDate}
                          explicit={single.explicit}
                          className="w-[180px] shrink-0"
                        />
                      ))}
                    </ScrollableRow>
                  </section>
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
            <ArtistPageSkeleton />
          </div>
        )}
      </div>
      </div>

      {data && (
        <ArtistProfileModal
          open={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          name={data.title}
          verified={data.verified}
          geniusImageUrl={data.geniusImageUrl}
          fallbackImageUrl={data.coverUrl}
          geniusUsername={data.geniusUsername}
          geniusAka={data.geniusAka}
          bio={data.description}
        />
      )}
    </div>
  );
}

export default function ArtistPage() {
  return (
    <Suspense fallback={<ArtistPageSkeleton />}>
      <ArtistContent />
    </Suspense>
  );
}
