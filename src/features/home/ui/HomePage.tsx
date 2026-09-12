import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PopularTracksSection from "./PopularTracksSection";
import HomePageSkeleton from "./HomePageSkeleton";
import {
  usePopular,
  usePopularTracksOnly,
  usePopularTracksAllTime,
} from "../hooks/usePopularTracks";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
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
    <div className="relative min-h-full w-full bg-bg-primary overflow-hidden">
      {/* Ambient time-of-day gradient glow (subtle top-left accent) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-8 -left-8 w-[380px] h-[200px] bg-gradient-to-br ${glowClass} blur-3xl opacity-60`}
      />

      <div className="relative z-1 grid grid-cols-1 items-start w-full">
        {/* Real Content Layer */}
        {isReady && (
          <div className="col-start-1 row-start-1 w-full pb-[40px]">
            {/* Hero Greeting Section */}
          <div className={`relative px-8 pt-8 ${hasEnoughQuickData ? "pb-2" : "pb-0"}`}>
            <div className={`relative flex items-center gap-3 ${hasEnoughQuickData ? "mb-5" : "mb-2"}`}>
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-bg-elevated">
                {GreetingIcon}
              </div>
              <h1
                className="text-[26px] font-bold text-text-primary tracking-tight m-0"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {fullGreeting}
              </h1>
            </div>

            {/* Quick Access Mix Grid */}
            {hasEnoughQuickData && (
              <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {/* Liked Songs Quick Card */}
                <SongCard
                  title={t("library.liked_songs")}
                  artists={`${likedData.total} ${likedData.total === 1 ? t("library.song") : t("library.songs")}`}
                  coverUrl=""
                  icon={
                    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-500 text-white rounded-md">
                      <HeartFill size={20} className="text-white" />
                    </div>
                  }
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

          {/* Listening Right Now (Trending Chart) */}
          {popularTracksOnly && popularTracksOnly.length > 0 && (
            <PopularTracksSection
              title={t("home.whatEveryonesOn")}
              icon={<FireFill className="w-5 h-5 text-amber-500" />}
              items={popularTracksOnly}
              headingMarginTop="mt-[28px]"
            />
          )}

          {/* Jump Back In (History) */}
          {recentlyPlayed && recentlyPlayed.length > 0 && (
            <PopularTracksSection
              title={t("home.jumpBackIn")}
              icon={<TimeFill className="w-5 h-5 text-sky-400" />}
              items={recentlyPlayed}
              headingMarginTop="mt-[32px]"
            />
          )}

          {/* Most Listened of All Time */}
          {popularTracksAllTime && popularTracksAllTime.length > 0 && (
            <PopularTracksSection
              title={t("home.mostListened")}
              icon={<TrophyFill className="w-5 h-5 text-yellow-500" />}
              items={popularTracksAllTime}
              showRanks={true}
              headingMarginTop="mt-[32px]"
            />
          )}

          {/* Top Albums */}
          {popularAlbums && popularAlbums.length > 0 && (
            <PopularTracksSection
              title={t("home.popularAlbums")}
              icon={<AlbumFill className="w-5 h-5 text-emerald-400" />}
              items={popularAlbums}
              headingMarginTop="mt-[32px]"
            />
          )}

          {/* Popular Playlists */}
          {popularPlaylists && popularPlaylists.length > 0 && (
            <PopularTracksSection
              title={t("home.popularPlaylists")}
              icon={<PlaylistFill className="w-5 h-5 text-rose-400" />}
              items={popularPlaylists}
              headingMarginTop="mt-[32px]"
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
