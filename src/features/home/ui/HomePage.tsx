import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PopularTracksSection from "./PopularTracksSection";
import DailyMixesSection from "./DailyMixesSection";
import HomePageSkeleton from "./HomePageSkeleton";
import {
  usePopular,
  usePopularTracksOnly,
  usePopularTracksAllTime,
} from "../hooks/usePopularTracks";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useDailyMixes } from "../hooks/useDailyMixes";
import { useLikedTracks } from "@/features/library/hooks/useLikedTracks";
import { playerEngine } from "@/features/player";
import SongCard from "@/features/player/ui/SongCard";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useTranslation } from "@/languages";
import {
  FireFill,
  TrophyFill,
  TimeFill,
  AlbumFill,
  PlaylistFill,
  HeartFill,
  FlashCircleFill,
} from "@mingcute/react";

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: likedData, isLoading: likedLoading } = useLikedTracks();

  const { data: popularItems, isLoading: popularLoading } = usePopular(100);
  const { data: popularTracksOnly, isLoading: tracksLoading } =
    usePopularTracksOnly(20);
  const { data: popularTracksAllTime, isLoading: allTimeLoading } =
    usePopularTracksAllTime(20);
  const { data: recentlyPlayed, isLoading: recentLoading } =
    useRecentlyPlayed(20);
  const { data: dailyMixes } = useDailyMixes();

  const isDataLoading =
    tracksLoading ||
    allTimeLoading ||
    popularLoading ||
    recentLoading ||
    likedLoading;

  const popularAlbums =
    popularItems?.filter((it) => it.type === "album") ?? [];
  const popularPlaylists =
    popularItems?.filter((it) => it.type === "playlist") ?? [];

  // Ambient time-of-day colored glow
  const glowClass = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "from-amber-500/20 via-orange-500/10 to-transparent";
    } else if (hour >= 12 && hour < 17) {
      return "from-amber-400/20 via-sky-500/10 to-transparent";
    } else if (hour >= 17 && hour < 22) {
      return "from-rose-500/20 via-purple-500/10 to-transparent";
    }
    return "from-indigo-600/25 via-violet-600/15 to-transparent";
  }, []);

  // Quick mix items: up to 5 recently played items (tracks or albums)
  const quickRecentItems = useMemo(() => {
    return (recentlyPlayed || []).slice(0, 5);
  }, [recentlyPlayed]);

  const hasEnoughQuickData = quickRecentItems.length >= 5;

  // Collect above-the-fold images to preload so everything displays ready at once
  const urlsToPreload = useMemo(() => {
    if (isDataLoading) return [];
    const urls = new Set<string>();

    if (hasEnoughQuickData) {
      for (const item of quickRecentItems) {
        if ("coverUrl" in item.item && item.item.coverUrl) {
          urls.add(item.item.coverUrl);
        }
      }
    }
    for (const mix of (dailyMixes || []).slice(0, 5)) {
      if (mix.coverUrl) urls.add(mix.coverUrl);
    }
    for (const item of (popularTracksOnly || []).slice(0, 8)) {
      if (item.type === "track" && item.item?.coverUrl) {
        urls.add(item.item.coverUrl);
      }
    }
    for (const item of (recentlyPlayed || []).slice(0, 8)) {
      if ("coverUrl" in item.item && item.item.coverUrl) {
        urls.add(item.item.coverUrl);
      }
    }
    for (const item of (popularTracksAllTime || []).slice(0, 8)) {
      if (item.type === "track" && item.item?.coverUrl) {
        urls.add(item.item.coverUrl);
      }
    }
    for (const item of popularAlbums.slice(0, 8)) {
      if (item.item?.coverUrl) urls.add(item.item.coverUrl);
    }
    for (const item of popularPlaylists.slice(0, 8)) {
      if (item.item?.coverUrl) urls.add(item.item.coverUrl);
    }

    return Array.from(urls);
  }, [
    isDataLoading,
    quickRecentItems,
    dailyMixes,
    popularTracksOnly,
    recentlyPlayed,
    popularTracksAllTime,
    popularAlbums,
    popularPlaylists,
  ]);

  const [imagesLoaded, setImagesLoaded] = useState(() => !isDataLoading);

  useEffect(() => {
    if (isDataLoading) {
      setImagesLoaded(false);
      return;
    }

    if (urlsToPreload.length === 0) {
      setImagesLoaded(true);
      return;
    }

    let active = true;
    let settled = false;

    // Safety timeout: max 1200ms for images so slow network doesn't indefinitely block page
    const timer = setTimeout(() => {
      if (active && !settled) {
        settled = true;
        setImagesLoaded(true);
      }
    }, 1200);

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
  }, [isDataLoading, urlsToPreload]);

  const isReady = !isDataLoading && imagesLoaded;
  const [skeletonExited, setSkeletonExited] = useState(() => !isDataLoading);

  useEffect(() => {
    if (isReady && !skeletonExited) {
      const timer = setTimeout(() => {
        setSkeletonExited(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isReady, skeletonExited]);

  return (
    <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-transparent">

      <div
        data-window-drag
        className="sticky top-0 z-20 h-[32px] w-full shrink-0 select-none pointer-events-auto"
        style={{ marginBottom: "-32px" }}
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-8 -left-8 w-[380px] h-[200px] bg-gradient-to-br ${glowClass} blur-3xl opacity-60`}
      />

      <div className="relative z-1 grid grid-cols-1 items-start w-full">
        {/* Real Content Layer */}
        {isReady && (
          <div className="col-start-1 row-start-1 w-full pb-[16px]">
            {/* Speed Dial Section */}
            {hasEnoughQuickData && (
              <div className="flex flex-col">
                <div className="mt-[20px] px-8 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center shrink-0">
                      <FlashCircleFill className="w-5 h-5 text-amber-400" />
                    </div>
                    <h2
                      className="text-text-primary text-[21px] font-semibold m-0 leading-tight tracking-tight"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {t("home.speedDial") || "Speed dial"}
                    </h2>
                  </div>
                </div>

                <div className="px-8 mt-[12px] relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <SongCard
                    title={t("library.liked_songs")}
                    artists={`${likedData.total} ${likedData.total === 1 ? t("library.song") : t("library.songs")}`}
                    coverUrl=""
                    icon={<HeartFill size={22} className="text-zinc-400 dark:text-zinc-500" />}
                    onPlay={() => navigate("/library/playlist?id=likes")}
                    compact
                    className="bg-bg-elevated hover:bg-border-alpha-14"
                  />

                  {/* Recently Played Quick Cards */}
                  {quickRecentItems.map((entry, idx) => {
                    if (entry.type === "album") {
                      const album = entry.item;
                      return (
                        <SongCardWithMenu
                          key={`quick-album-${album.id}-${idx}`}
                          id={album.id}
                          title={album.title}
                          artists={album.artist}
                          coverUrl={album.coverUrl ?? ""}
                          onPlay={() =>
                            navigate(
                              `/collection?type=album&id=${encodeURIComponent(album.id)}`,
                            )
                          }
                          searchType="album"
                          compact
                          className="bg-bg-elevated hover:bg-border-alpha-14"
                        />
                      );
                    }
                    if (entry.type === "track") {
                      const track = entry.item;
                      return (
                        <SongCardWithMenu
                          key={`quick-track-${track.id}-${idx}`}
                          id={track.id}
                          title={track.title}
                          artists={track.artists}
                          coverUrl={track.coverUrl ?? ""}
                          durationMs={track.durationMs}
                          explicit={track.explicit}
                          onPlay={() => {
                            void playerEngine.playTrack(
                              track,
                              [track],
                              `${track.title} Radio`,
                              track.coverUrl,
                            );
                          }}
                          searchType="track"
                          compact
                          className="bg-bg-elevated hover:bg-border-alpha-14"
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}

            {/* Daily Mixes (Made For You) */}
            {dailyMixes && dailyMixes.length > 0 && (
              <DailyMixesSection
                mixes={dailyMixes}
                headingMarginTop="mt-[22px]"
              />
            )}

          {/* Listening Right Now (Trending Chart) */}
          {popularTracksOnly && popularTracksOnly.length > 0 && (
            <PopularTracksSection
              title={t("home.whatEveryonesOn")}
              icon={<FireFill className="w-5 h-5 text-amber-500" />}
              items={popularTracksOnly}
              headingMarginTop="mt-[22px]"
            />
          )}

          {/* Jump Back In (History) */}
          {recentlyPlayed && recentlyPlayed.length > 0 && (
            <PopularTracksSection
              title={t("home.jumpBackIn")}
              icon={<TimeFill className="w-5 h-5 text-sky-400" />}
              items={recentlyPlayed}
              headingMarginTop="mt-[22px]"
            />
          )}

          {/* Most Listened of All Time */}
          {popularTracksAllTime && popularTracksAllTime.length > 0 && (
            <PopularTracksSection
              title={t("home.mostListened")}
              icon={<TrophyFill className="w-5 h-5 text-yellow-500" />}
              items={popularTracksAllTime}
              headingMarginTop="mt-[22px]"
            />
          )}

          {/* Top Albums */}
          {popularAlbums && popularAlbums.length > 0 && (
            <PopularTracksSection
              title={t("home.popularAlbums")}
              icon={<AlbumFill className="w-5 h-5 text-emerald-400" />}
              items={popularAlbums}
              headingMarginTop="mt-[22px]"
            />
          )}

          {/* Popular Playlists */}
          {popularPlaylists && popularPlaylists.length > 0 && (
            <PopularTracksSection
              title={t("home.popularPlaylists")}
              icon={<PlaylistFill className="w-5 h-5 text-rose-400" />}
              items={popularPlaylists}
              headingMarginTop="mt-[22px]"
            />
          )}
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
          <HomePageSkeleton glowClass={glowClass} showQuickGrid={hasEnoughQuickData} />
        </div>
      )}
    </div>
  </div>
  );
}
