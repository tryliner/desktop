import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
  Suspense,
} from "react";
import CollectionPageSkeleton from "./CollectionPageSkeleton";
import {
  AddLine,
  PlayFill,
  NewFolderLine,
  FolderCheckFill,
  ShareForwardLine,
  PlaylistFill,
  MusicLine,
  CheckLine,
  More1Fill,
} from "@mingcute/react";
import { LuShuffle } from "react-icons/lu";
import Button from "@/shared/ui/Button";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import CoverImage from "@/features/covers/ui/CoverImage";
import { preloadCoverArt } from "@/features/covers/lib/coverArt";
import { DailyMixCover } from "@/features/home";
import { playerEngine } from "@/features/player";
import { AnimatePresence, motion } from "framer-motion";
import {
  useToast,
  EntityHero,
  DropdownMenu,
  HERO_TITLE_CLASS,
  HERO_SUBTITLE_CLASS,
  HERO_CHIP_CLASS,
  HERO_BUTTON_CLASS,
  HERO_GLASS_BUTTON_CLASS,
  HERO_GLASS_CLASS,
} from "@/shared/ui";
import { usePageBackdrop } from "@/shared/lib";
import { useClassicSurfaces } from "@/features/settings/store/customizationStore";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { buildShareUrl } from "@/shared/utils/share";
import { useExternalItems } from "@/features/library/hooks";
import { useCollection } from "../hooks/useCollection";
import { readCollectionPreview } from "../lib/collectionPreview";
import {
  useTrackSearch,
  TrackSearchField,
  TrackSearchEmpty,
} from "@/features/library/ui/TrackSearch";
import { useTrackSort, TrackSortMenu } from "@/features/library/ui/TrackSort";

const NO_TRACKS: Track[] = [];

function CollectionContent() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get("type");
  const type = typeParam === "playlist" ? "playlist" : "album";
  const id = searchParams.get("id");
  const { t } = useTranslation();

  const location = useLocation();
  const preview = readCollectionPreview(location.state);
  const { data, loading } = useCollection(type, id);
  const classicSurfaces = useClassicSurfaces();
  usePageBackdrop(
    preview?.coverUrl || data?.coverUrl,
    type === "playlist" ? { dim: 0.05 } : undefined,
  );
  const isSingleArtistAlbum = useMemo(() => {
    if (type === "playlist" || !data || data.tracks.length === 0) return false;
    const first = data.tracks[0].artists;
    return data.tracks.every((track) => track.artists === first);
  }, [type, data]);
  const entityType = type === "playlist" ? "playlist" : "album";
  const decodedId = id ? decodeURIComponent(id) : "";
  const isDailyMix = Boolean(
    data?.isDailyMix ||
    (type === "playlist" &&
      (decodedId.startsWith("daily-mix") ||
        decodedId.startsWith("mix-") ||
        (id && (id.startsWith("daily-mix") || id.startsWith("mix-"))))),
  );

  const { data: savedAlbums } = useExternalItems("album");
  const { data: savedPlaylists } = useExternalItems("playlist");
  const inLibrary =
    entityType === "album"
      ? savedAlbums.some((album) => album.id === decodedId)
      : savedPlaylists.some((playlist) => playlist.id === decodedId);

  const [imagesLoaded, setImagesLoaded] = useState(() => !loading && !!data);
  const [skeletonExited, setSkeletonExited] = useState(
    () => !loading && !!data,
  );

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
  }, [loading, data, urlsToPreload]);

  const isReady = !loading && !!data && imagesLoaded;
  const contentLayerRef = useRef<HTMLDivElement>(null);
  const swapsInPlace = Boolean(preview?.title);

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

  const playbackContext = id
    ? `${entityType}:${decodedId}`
    : data?.title || null;

  const sort = useTrackSort(data?.tracks ?? NO_TRACKS, `${type}:${decodedId}`);
  const sortedTracks = sort.sorted;
  const search = useTrackSearch(sortedTracks, `${type}:${decodedId}`);
  const visibleTracks = useMemo(
    () =>
      search.matches ?? sortedTracks.map((track, index) => ({ track, index })),
    [search.matches, sortedTracks],
  );
  // album track numbers follow the release order, whatever the sort
  const trackNumberById = useMemo(() => {
    const map = new Map<string, number>();
    (data?.tracks ?? NO_TRACKS).forEach((track, index) =>
      map.set(track.id, index + 1),
    );
    return map;
  }, [data?.tracks]);

  const handleSearchSubmit = useCallback(() => {
    const first = search.matches?.[0];
    if (!data || !first) return;
    playerEngine.playTrack(
      first.track,
      sortedTracks,
      playbackContext,
      data.coverUrl,
    );
  }, [search.matches, data, sortedTracks, playbackContext]);

  const { toast } = useToast();
  const [addedToQueue, setAddedToQueue] = useState(false);

  const handlePlayAll = () => {
    if (!data || sortedTracks.length === 0) return;
    const [first] = sortedTracks;
    playerEngine.clearQueue();
    playerEngine.playTrack(first, sortedTracks, playbackContext, data.coverUrl);
  };

  const handleShufflePlay = useCallback(() => {
    if (!data || data.tracks.length === 0) return;
    playerEngine.clearQueue();
    void playerEngine.playShuffled(data.tracks, playbackContext, data.coverUrl);
  }, [data, playbackContext]);

  const handleAddToQueue = useCallback(() => {
    if (!data || sortedTracks.length === 0) return;
    for (const track of sortedTracks) {
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
  }, [data, sortedTracks, toast, t]);

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

  // results start at the top, not wherever the full list was scrolled to
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [search.activeQuery, sort.option]);

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
      <div className="relative z-1 grid grid-cols-1 w-full h-full min-h-0 overflow-hidden">
        {data && (
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
                    data.coverUrl ? (
                      isDailyMix ? (
                        <DailyMixCover
                          coverUrl={data.coverUrl}
                          mixNumber={data.title.match(/\d+/)?.[0] ?? "1"}
                          imageLoaded={imagesLoaded}
                        />
                      ) : (
                        <CoverImage
                          src={data.coverUrl}
                          alt={data.title}
                          fill
                          sizes="180px"
                          className="object-cover"
                          draggable={false}
                        />
                      )
                    ) : (
                      <PlaylistFill
                        size={48}
                        className="text-border-alpha-33"
                      />
                    )
                  }

                  title={<h1 className={HERO_TITLE_CLASS}>{data.title}</h1>}
                  subtitle={
                    data.artists && data.artists.length > 0 ? (
                      <p
                        className={`${HERO_SUBTITLE_CLASS} flex items-center flex-wrap gap-x-[4px]`}
                      >
                        {data.artists.map((artist, i) => (
                          <span
                            key={artist.id || i}
                            className="inline-flex items-center"
                          >
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
                              <span className="text-text-tertiary ml-[2px]">
                                ,
                              </span>
                            )}
                          </span>
                        ))}
                      </p>
                    ) : data.author ? (
                      <p className={HERO_SUBTITLE_CLASS}>{data.author}</p>
                    ) : data.description ? (
                      <p className={HERO_SUBTITLE_CLASS}>{data.description}</p>
                    ) : undefined
                  }
                  meta={
                    <div className="flex items-center flex-wrap gap-[6px]">
                      {data.year && (
                        <div className={HERO_CHIP_CLASS}>
                          <span>{data.year}</span>
                        </div>
                      )}

                      <div className={HERO_CHIP_CLASS}>
                        <MusicLine
                          size={13}
                          className="text-text-secondary shrink-0"
                        />
                        <span>
                          {data.tracks.length} {t("collection.tracks_count")}
                        </span>
                        <span
                          className="w-[3px] h-[3px] rounded-full shrink-0 bg-text-secondary/50"
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
                            const totalSecs = Math.floor(
                              (totalMs % 60000) / 1000,
                            );
                            return `${totalMins} ${t("collection.min")} ${totalSecs} ${t("collection.sec")}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  }
                  actions={
                    <>
                      <Button
                        variant="primary"
                        onClick={handlePlayAll}
                        disabled={!data || data.tracks.length === 0}
                        className={`${HERO_BUTTON_CLASS} px-[22px]`}
                      >
                        <PlayFill size={16} />
                        <span>{t("common.play_all")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleShufflePlay}
                        disabled={!data || data.tracks.length === 0}
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
                        totalCount={data.tracks.length}
                        placeholder={t(
                          isAlbum
                            ? "track_search.placeholder_album"
                            : "track_search.placeholder_playlist",
                        )}
                        onSubmit={handleSearchSubmit}
                        className={HERO_GLASS_CLASS}
                      />
                      <Button
                        variant="secondary"
                        onClick={handleAddToQueue}
                        disabled={!data || data.tracks.length === 0}
                        className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} px-[22px] ${
                          // optical centring: with three icon buttons beside it the label reads 1px right
                          !isDailyMix ? "[&>*]:-translate-x-px" : ""
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
                        disabled={!data || data.tracks.length < 2}
                      />
                      {!isDailyMix && (
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
                <section>
                  {search.matches && search.matches.length === 0 ? (
                    <TrackSearchEmpty
                      query={search.activeQuery}
                      onClear={() => search.setQuery("")}
                    />
                  ) : (
                    <div className="flex flex-col">
                      {visibleTracks.map(({ track, index }) => (
                        <SongCardWithMenu
                          key={track.id}
                          id={track.id}
                          title={track.title}
                          artists={track.artists}
                          artistId={track.artistId}
                          artistList={track.artistList}
                          coverUrl={track.coverUrl || data.coverUrl}
                          highlight={search.activeQuery || undefined}
                          trackNumber={
                            isAlbum
                              ? (trackNumberById.get(track.id) ?? index + 1)
                              : undefined
                          }
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
                          hideArtists={isSingleArtistAlbum}
                          onPlay={() =>
                            playerEngine.playTrack(
                              track,
                              sortedTracks,
                              playbackContext,
                              data.coverUrl,
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Direct Crossfade Skeleton Layer */}
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
            <CollectionPageSkeleton isAlbum={isAlbum} preview={preview} />
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
