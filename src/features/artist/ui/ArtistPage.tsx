import { useSearchParams } from "react-router-dom";
import {
  useEffect,
  useState,
  Suspense,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  PlayFill,
  NewFolderLine,
  FolderCheckFill,
  ShareForwardLine,
} from "@mingcute/react";
import { LuShuffle } from "react-icons/lu";
import Button from "@/shared/ui/Button";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import AlbumCard from "@/features/collection/ui/AlbumCard";
import ReleaseCard from "@/features/collection/ui/ReleaseCard";
import ScrollableRow from "@/shared/ui/ScrollableRow";
import CoverImage from "@/features/covers/ui/CoverImage";
import { preloadCoverArt } from "@/features/covers/lib/coverArt";
import { playerEngine } from "@/features/player";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/shared/types";
import {
  useToast,
  EntityHero,
  HERO_TITLE_CLASS,
  HERO_SUBTITLE_CLASS,
  HERO_BUTTON_CLASS,
  HERO_GLASS_BUTTON_CLASS,
} from "@/shared/ui";
import { usePageBackdrop } from "@/shared/lib";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { buildShareUrl } from "@/shared/utils/share";
import { useExternalItems } from "@/features/library/hooks";
import ArtistProfileModal from "./ArtistProfileModal";
import ArtistPageSkeleton from "./ArtistPageSkeleton";
import { useArtist } from "../hooks/useArtist";

function stripMarkdown(text: string): string {
  return text
    .replace(/(Дискография)(Официальный)/g, "$1\n\n$2")
    .replace(
      /(сайт|ВКонтакте|канал|#\d|TikTok)(Официальный|Сообщество|Страница|Телеграм|YouTube|TikTok|Twitch)/g,
      "$1, $2",
    )
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^•\s*/gm, "")
    .trim();
}

function VerifiedBadge() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px] shrink-0 text-[#1d9bf0]"
      fill="currentColor"
      aria-label="Verified"
    >
      <path d="M10.007 2.10377C8.60544 1.65006 7.08181 2.28116 6.41156 3.59306L5.60578 5.17023C5.51004 5.35763 5.35763 5.51004 5.17023 5.60578L3.59306 6.41156C2.28116 7.08181 1.65006 8.60544 2.10377 10.007L2.64923 11.692C2.71404 11.8922 2.71404 12.1078 2.64923 12.308L2.10377 13.993C1.65006 15.3946 2.28116 16.9182 3.59306 17.5885L5.17023 18.3942C5.35763 18.49 5.51004 18.6424 5.60578 18.8298L6.41156 20.407C7.08181 21.7189 8.60544 22.35 10.007 21.8963L11.692 21.3508C11.8922 21.286 12.1078 21.286 12.308 21.3508L13.993 21.8963C15.3946 22.35 16.9182 21.7189 17.5885 20.407L18.3942 18.8298C18.49 18.6424 18.6424 18.49 18.8298 18.3942L20.407 17.5885C21.7189 16.9182 22.35 15.3946 21.8963 13.993L21.3508 12.308C21.286 12.1078 21.286 11.8922 21.3508 11.692L21.8963 10.007C22.35 8.60544 21.7189 7.08181 20.407 6.41156L18.8298 5.60578C18.6424 5.51004 18.49 5.35763 18.3942 5.17023L17.5885 3.59306C16.9182 2.28116 15.3946 1.65006 13.993 2.10377L12.308 2.64923C12.1078 2.71403 11.8922 2.71404 11.692 2.64923L10.007 2.10377Z" />
      <path
        d="M6.75977 11.7573L8.17399 10.343L11.0024 13.1715L16.6593 7.51465L18.0735 8.92886L11.0024 15.9999L6.75977 11.7573Z"
        fill="#ffffff"
        transform="translate(-0.42 0.24)"
      />
    </svg>
  );
}

function formatDuration(durationMs?: number): string | undefined {
  if (!durationMs) return undefined;
  const mins = Math.floor(durationMs / 60000);
  const secs = Math.floor((durationMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function ArtistContent() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");

  const { data, loading } = useArtist(id);
  usePageBackdrop(data?.coverUrl);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(() => !loading && !!data);
  const [skeletonExited, setSkeletonExited] = useState(
    () => !loading && !!data,
  );
  const shownIdRef = useRef(id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const decodedId = id ? decodeURIComponent(id) : "";
  const { data: savedArtists } = useExternalItems("artist");
  const inLibrary = savedArtists.some((artist) => artist.id === decodedId);

  const urlsToPreload = useMemo(() => {
    if (!data) return [];
    const urls = new Set<string>();
    if (data.coverUrl) urls.add(data.coverUrl);
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
    }, 300);

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
    if (shownIdRef.current === id) return;
    shownIdRef.current = id;
    setShowAllTracks(false);
    setIsProfileModalOpen(false);
    setImagesLoaded(false);
    setSkeletonExited(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [id]);

  const handlePlayAll = () => {
    if (!data || data.tracks.length === 0) return;
    const [first] = data.tracks;
    playerEngine.clearQueue();
    playerEngine.playTrack(first, data.tracks, data.title, data.coverUrl);
  };

  const handleShufflePlay = useCallback(() => {
    if (!data || data.tracks.length === 0) return;
    playerEngine.clearQueue();
    void playerEngine.playShuffled(data.tracks, data.title, data.coverUrl);
  }, [data]);

  const { toast } = useToast();

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

  if (!loading && !data) {
    return (
      <div className="h-full w-full bg-transparent flex items-center justify-center">
        <span className="text-text-secondary">
          {t("artist.artist_not_found")}
        </span>
      </div>
    );
  }

  let audienceLabel: string | null = null;
  if (data?.monthlyListeners) {
    const match = data.monthlyListeners.match(/^([\d.,]+[KMBkmb]?)/);
    const count = match ? match[1] : data.monthlyListeners;
    audienceLabel = t("artist.monthly_audience", { count });
  } else if (data?.followers) {
    const count = Intl.NumberFormat("en-US", { notation: "compact" }).format(
      data.followers,
    );
    audienceLabel = `${count} ${t("artist.followers")}`;
  }

  const iconButtonClass = `${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`;
  const sectionTitleClass = "text-[22px] font-[500] text-text-primary m-0";

  const renderTrack = (track: Track) =>
    data && (
      <SongCardWithMenu
        key={track.id}
        id={track.id}
        title={track.title}
        artists={track.artists}
        artistId={track.artistId}
        artistList={track.artistList}
        coverUrl={track.coverUrl || data.coverUrl}
        duration={formatDuration(track.durationMs)}
        durationMs={track.durationMs}
        explicit={track.explicit}
        onPlay={() =>
          playerEngine.playTrack(track, data.tracks, data.title, data.coverUrl)
        }
      />
    );

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div className="relative z-1 grid grid-cols-1 w-full h-full min-h-0 overflow-hidden">
        {data && (
          <div
            className={`col-start-1 row-start-1 w-full h-full min-h-0 overflow-hidden transition-opacity duration-200 ease-out ${
              isReady ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div
              ref={scrollRef}
              data-no-window-drag
              className="relative z-10 h-full w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain box-border pt-(--page-inset-top) pb-(--page-inset-bottom)"
              style={{ willChange: "scroll-position" }}
            >
              <div className="pl-[16px] pr-[12px] pt-[8px]" data-no-window-drag>
                <EntityHero
                  contentClassName="self-stretch justify-center pt-0"
                  actionsClassName="mt-[20px]"
                  coverClassName="h-[144px] w-[144px] rounded-full bg-border-alpha-14"
                  cover={
                    data.coverUrl ? (
                      <CoverImage
                        src={data.coverUrl}
                        alt={data.title}
                        fill
                        sizes="180px"
                        className="object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-[56px] font-[700] text-border-alpha-33">
                        {data.title.charAt(0)}
                      </span>
                    )
                  }
                  title={
                    <div className="flex items-center gap-[8px] min-w-0">
                      <h1 className={HERO_TITLE_CLASS}>{data.title}</h1>
                      {data.verified ? <VerifiedBadge /> : null}
                    </div>
                  }
                  subtitle={
                    audienceLabel ? (
                      <p className={HERO_SUBTITLE_CLASS}>{audienceLabel}</p>
                    ) : undefined
                  }
                  actions={
                    <>
                      <Button
                        variant="primary"
                        onClick={handlePlayAll}
                        disabled={data.tracks.length === 0}
                        className={`${HERO_BUTTON_CLASS} px-[22px]`}
                      >
                        <PlayFill size={16} />
                        <span>{t("artist.play")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleShufflePlay}
                        disabled={data.tracks.length === 0}
                        className={iconButtonClass}
                        title={t("common.shuffle")}
                      >
                        <LuShuffle size={18} />
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleSaveToLibrary}
                        className={iconButtonClass}
                        title={
                          inLibrary
                            ? t("artist.remove_from_library")
                            : t("artist.save_to_library")
                        }
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {inLibrary ? (
                            <motion.span
                              key="saved"
                              initial={{ scale: 0.5, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0.5, rotate: 20 }}
                              transition={{ duration: 0.12 }}
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
                              transition={{ duration: 0.12 }}
                              className="flex"
                            >
                              <NewFolderLine size={18} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleShare}
                        className={iconButtonClass}
                        title={t("artist.share")}
                      >
                        <ShareForwardLine size={18} />
                      </Button>
                    </>
                  }
                />
              </div>

              <div className="relative z-10 pl-[16px] pr-[12px] pt-[28px]">
                <div className="flex flex-col gap-[40px]">
                  <section id="artist-tracks-section">
                    <div className="flex items-center justify-between mb-[16px]">
                      <h2 className={sectionTitleClass}>
                        {t("artist.popular_songs")}
                      </h2>
                      {data.tracks.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllTracks((prev) => !prev)}
                          className="text-[13px] font-[500] text-text-secondary hover:text-text-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
                        >
                          {showAllTracks
                            ? t("artist.show_less")
                            : t("artist.show_all")}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col -mt-[14px] -mx-[8px]">
                      {data.tracks.slice(0, 5).map(renderTrack)}

                      <AnimatePresence initial={false}>
                        {showAllTracks && (
                          <motion.div
                            key="expanded-tracks"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{
                              duration: 0.28,
                              ease: [0.25, 1, 0.5, 1],
                            }}
                            className="overflow-hidden flex flex-col"
                          >
                            {data.tracks.slice(5).map(renderTrack)}
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
                      <h2 className={`${sectionTitleClass} mb-[16px]`}>
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
                      <h2 className={`${sectionTitleClass} mb-[16px]`}>
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

                  {data.description && (
                    <section>
                      <h2 className={`${sectionTitleClass} mb-[16px]`}>
                        {t("artist.about_artist")}
                      </h2>
                      <div
                        className={`max-w-[720px] rounded-[14px] p-[16px] flex flex-col gap-[6px] text-text-primary bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl`}
                      >
                        <p className="m-0 text-[13px] leading-[1.5] text-text-secondary font-[400] select-text line-clamp-3">
                          {stripMarkdown(data.description)}
                        </p>
                        {data.description.length > 120 && (
                          <button
                            type="button"
                            onClick={() => setIsProfileModalOpen(true)}
                            className="mt-[2px] self-start text-[12px] font-[500] text-text-tertiary hover:text-text-primary cursor-pointer bg-transparent border-0 p-0 transition-colors"
                          >
                            {t("artist.show_all")}
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!skeletonExited && (
          <div
            className={`col-start-1 row-start-1 w-full h-full z-10 transition-opacity duration-300 ease-out overflow-hidden pointer-events-none ${
              isReady ? "opacity-0" : "opacity-100"
            }`}
            onTransitionEnd={(event) => {
              if (event.target === event.currentTarget) setSkeletonExited(true);
            }}
          >
            <ArtistPageSkeleton />
          </div>
        )}
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
