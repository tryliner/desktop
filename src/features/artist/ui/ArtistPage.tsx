import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import {
  ArrowLeftLine,
  PlayFill,
  AddLine,
  NewFolderLine,
  FolderCheckFill,
  ShareForwardLine,
  User3Line,
  PlayCircleLine,
  Music2Line,
} from "@mingcute/react";
import Button from "@/shared/ui/Button";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import AlbumCard from "@/features/collection/ui/AlbumCard";
import ReleaseCard from "@/features/collection/ui/ReleaseCard";
import ScrollableRow from "@/shared/ui/ScrollableRow";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useCoverSrc } from "@/features/covers";
import { playerEngine } from "@/features/player";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/shared/types";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { api, mediaUrl, toClientTrack, type ApiTrack } from "@/shared/api";
import { useExternalItems } from "@/features/library/hooks";

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

function ArtistContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");

  const [data, setData] = useState<{
    title: string;
    description: string;
    coverUrl: string;
    monthlyListeners?: string;
    followers?: number;
    totalListens?: number;
    totalTracks?: number;
    tracks: Track[];
    popularSongs: Track[];
    albums: ArtistAlbumViewModel[];
    reposts: Track[];
    singles: ArtistReleaseViewModel[];
  } | null>(null);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore] = useState(false);
  const [hasMore] = useState(true);
  const heroCoverSrc = useCoverSrc(data?.coverUrl);

  const decodedId = id
    ? (() => {
        try {
          return decodeURIComponent(id);
        } catch {
          return id;
        }
      })()
    : "";
  const { data: savedArtists } = useExternalItems("artist");
  const inLibrary = savedArtists.some((artist) => artist.id === decodedId);

  const loadMoreTracks = useCallback(async () => {
    if (!id || loadingMore || !hasMore) return;
  }, [id, loadingMore, hasMore]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastTrackElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loadingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingMore) {
            loadMoreTracks();
          }
        },
        { rootMargin: "1500px" },
      );
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore, loadMoreTracks],
  );

  useEffect(() => {
    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }
      setShowAllTracks(false);
      setLoading(true);
      try {
        const artist = await api.getArtist(id);
        const tracks = artist.tracks.map(toClientTrack);
        setData({
          title: artist.name,
          monthlyListeners: artist.monthlyListeners,
          description:
            artist.bio ??
            (!artist.monthlyListeners ? t("artist.no_biography") : ""),
          coverUrl: artist.cover ? mediaUrl(artist.cover.url) : "",
          totalTracks: tracks.length,
          tracks,
          popularSongs: tracks.slice(0, 5),
          albums: artist.albums.map((album) => ({
            id: album.id,
            title: album.title,
            coverUrl: album.cover ? mediaUrl(album.cover.url) : "",
            ...(album.year ? { releaseDate: String(album.year) } : {}),
            explicit: album.explicit,
          })),
          reposts: [],
          singles: artist.singles.map((single) => ({
            id: single.id,
            title: single.title,
            coverUrl: single.cover ? mediaUrl(single.cover.url) : "",
            releaseType: single.releaseType,
            ...(single.year ? { releaseDate: String(single.year) } : {}),
            explicit: single.explicit,
          })),
        });
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, t]);

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
    toast(t("artist.added_to_queue"), "info");
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

  if (loading) {
    return (
      <div className="page-transition h-full w-full bg-bg-primary flex items-center justify-center">
        <div className="h-[24px] w-[24px] animate-spin rounded-full border-[2px] border-text-tertiary border-t-text-secondary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-transition h-full w-full bg-bg-primary flex items-center justify-center">
        <span className="text-text-secondary">
          {t("artist.artist_not_found")}
        </span>
      </div>
    );
  }

  return (
    <div className="page-transition relative h-full w-full overflow-y-auto bg-bg-primary pb-[24px]">
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
          <div className="relative h-[170px] w-[170px] shrink-0 overflow-hidden rounded-full bg-border-alpha-14">
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

          <div className="flex h-[170px] flex-1 justify-between">
            <div className="flex flex-col justify-between py-[4px]">
              <div>
                <h1
                  className="m-0 text-[34px] leading-[1.02] text-text-primary line-clamp-1"
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontWeight: 400,
                  }}
                >
                  {data.title}
                </h1>
                <div
                  className="mt-[4px] mb-[6px] flex items-center gap-[16px] text-[14px] text-text-secondary font-[500]"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  {data.monthlyListeners && (
                    <span className="flex items-center gap-[6px]">
                      <User3Line size={16} />
                      {(() => {
                        const match = data.monthlyListeners.match(/^([\d.,]+[KMBkmb]?)/);
                        const count = match ? match[1] : data.monthlyListeners;
                        return t("artist.monthly_audience", { count });
                      })()}
                    </span>
                  )}
                  {data.followers !== undefined && data.followers > 0 && (
                    <span className="flex items-center gap-[6px]">
                      <User3Line size={16} />
                      {Intl.NumberFormat("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(data.followers)}{" "}
                      {t("artist.followers")}
                    </span>
                  )}
                  {data.totalListens !== undefined &&
                    data.totalListens > 0 && (
                      <span className="flex items-center gap-[6px]">
                        <PlayCircleLine size={16} />
                        {Intl.NumberFormat("en-US", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(data.totalListens)}{" "}
                        {t("artist.total_listens")}
                      </span>
                    )}
                  {data.totalTracks !== undefined && data.totalTracks > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllTracks(true);
                        document
                          .getElementById("artist-tracks-section")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="flex items-center gap-[6px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer bg-transparent border-0 p-0 text-[14px] font-[500]"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                      title={t("artist.show_all")}
                    >
                      <Music2Line size={16} />
                      {Intl.NumberFormat("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(data.totalTracks)}{" "}
                      {t("artist.tracks")}
                    </button>
                  )}
                </div>
                {data.description && (
                  <p
                    className="m-0 max-w-[600px] text-[15px] leading-[1.4] text-text-secondary line-clamp-2"
                    style={{
                      fontFamily: "var(--font-inter), sans-serif",
                      fontWeight: 350,
                    }}
                  >
                    {data.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-[10px]">
                <Button
                  variant="primary"
                  onClick={handlePlayAll}
                  className="!h-[42px] !text-[16px] !font-[500] px-[24px]"
                >
                  <PlayFill size={16} />
                  {t("artist.play")}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleSaveToLibrary}
                  className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
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
                <Button
                  variant="outline"
                  onClick={handleAddToQueue}
                  className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                  title={t("artist.add_to_queue")}
                >
                  <AddLine size={20} />
                </Button>
              </div>
            </div>

            <div className="flex items-end gap-[10px] pb-[6px] pr-[16px]">
              <Button
                variant="outline"
                className="!h-[42px] !w-[42px] !p-0 flex items-center justify-center text-text-primary"
                title={t("artist.share")}
              >
                <ShareForwardLine size={20} />
              </Button>
            </div>
          </div>
        </section>

        <div className="mt-[40px] flex flex-col gap-[40px]">
          <section id="artist-tracks-section">
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
  );
}

export default function ArtistPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full bg-bg-primary flex items-center justify-center">
          <div className="h-[24px] w-[24px] animate-spin rounded-full border-[2px] border-text-tertiary border-t-text-secondary" />
        </div>
      }
    >
      <ArtistContent />
    </Suspense>
  );
}
