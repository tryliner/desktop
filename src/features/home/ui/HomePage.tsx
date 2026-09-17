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
import { useAuthStore } from "@/features/auth/store/authStore";
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
  SunriseFill,
  SunFill,
  SunsetFill,
  MoonStarsFill,
} from "@mingcute/react";

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
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

  // Time-of-day greeting & dynamic colored glow
  const { greetingText, GreetingIcon, glowClass } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return {
        greetingText: t("home.goodMorning"),
        GreetingIcon: <SunriseFill className="w-6 h-6 text-amber-400" />,
        glowClass: "from-amber-500/20 via-orange-500/10 to-transparent",
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        greetingText: t("home.goodAfternoon"),
        GreetingIcon: <SunFill className="w-6 h-6 text-yellow-400" />,
        glowClass: "from-amber-400/20 via-sky-500/10 to-transparent",
      };
    } else if (hour >= 17 && hour < 22) {
      return {
        greetingText: t("home.goodEvening"),
        GreetingIcon: <SunsetFill className="w-6 h-6 text-orange-400" />,
        glowClass: "from-rose-500/20 via-purple-500/10 to-transparent",
      };
    }
    return {
      greetingText: t("home.goodNight"),
      GreetingIcon: <MoonStarsFill className="w-6 h-6 text-indigo-400" />,
      glowClass: "from-indigo-600/25 via-violet-600/15 to-transparent",
    };
  }, [t]);

  const userName =
    user?.displayName ||
    (user?.username ? `@${user.username}` : user?.email ? user.email.split("@")[0] : undefined);
  const fullGreeting = userName ? `${greetingText}, ${userName}` : greetingText;

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
    <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-bg-primary">
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
            {/* Hero Greeting Section */}
          <div className={`relative px-8 pt-4 ${hasEnoughQuickData ? "pb-2" : "pb-0"}`}>
            <div
              className={`relative inline-flex items-center gap-3 px-4 py-2 rounded-2xl rounded-tl-[3px] bg-bg-canvas/45 backdrop-blur-md ${
                hasEnoughQuickData ? "mb-5" : "mb-2"
              }`}
            >
              <svg
                viewBox="0 0 10 16"
                className="absolute -left-[10px] top-0 w-[10px] h-[16px] text-bg-canvas/45 fill-current pointer-events-none"
                aria-hidden="true"
              >
                <path d="M10 0 H2 C0.5 0 0 0.8 0 1.8 C0 3.2 1.5 5.5 3.5 7.8 C6 10.5 8.5 13.2 10 16 Z" />
              </svg>
              <div className="flex items-center shrink-0">
                {GreetingIcon}
              </div>
              <h1
                className="text-[22px] font-bold text-text-primary tracking-tight m-0 leading-tight"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {fullGreeting}
              </h1>
            </div>

            {/* Quick Access Mix Grid */}
            {hasEnoughQuickData && (
              <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
            )}
          </div>

          {/* Daily Mixes (Made For You) */}
          {dailyMixes && dailyMixes.length > 0 && (
            <DailyMixesSection
              mixes={dailyMixes}
              headingMarginTop={hasEnoughQuickData ? "mt-[18px]" : "mt-[14px]"}
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
