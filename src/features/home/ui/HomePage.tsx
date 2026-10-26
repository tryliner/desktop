import { useState, useEffect } from "react";
import PopularTracksSection from "./PopularTracksSection";
import DailyMixesSection from "./DailyMixesSection";
import HomePageSkeleton from "./HomePageSkeleton";
import { usePopularTracksAllTime } from "../hooks/usePopularTracks";
import { useListeningNow } from "../hooks/useListeningNow";
import ListeningNowSection from "./ListeningNowSection";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useDailyMixes } from "../hooks/useDailyMixes";
import { useMostSaved, usePopularAlbums } from "../hooks/useExploreCollections";
import { useTranslation } from "@/languages";
import { usePageBackdrop } from "@/shared/lib";
import { useStrikingCover } from "../hooks/useStrikingCover";
import { useAccentBackdrop } from "../hooks/useAccentBackdrop";
import {
  AlbumFill,
  BookmarkFill,
  FireFill,
  TrophyFill,
  TimeFill,
} from "@mingcute/react";

export default function HomePage() {
  const { t } = useTranslation();

  const { tracks: listeningNow, isLoading: tracksLoading } = useListeningNow();
  const { data: popularTracksAllTime, isLoading: allTimeLoading } =
    usePopularTracksAllTime(20);
  const { data: recentlyPlayed, isLoading: recentLoading } =
    useRecentlyPlayed(20);
  const { items: popularAlbums, isLoading: albumsLoading } = usePopularAlbums();
  const { items: mostSaved, isLoading: savedLoading } = useMostSaved();
  const { data: dailyMixes } = useDailyMixes();
  const hasMixes = Boolean(dailyMixes && dailyMixes.length > 0);
  const firstAlbum = popularAlbums[0];
  const firstAlbumCover =
    firstAlbum?.type === "album" ? firstAlbum.item.coverUrl : undefined;
  const mixBackdropCover = useStrikingCover(
    (dailyMixes ?? []).slice(0, 4).map((mix) => mix.coverUrl),
  );
  const mixAccentBackdrop = useAccentBackdrop(mixBackdropCover);
  usePageBackdrop(
    hasMixes
      ? mixAccentBackdrop
      : firstAlbumCover || listeningNow[0]?.coverUrl || undefined,
    hasMixes ? { blur: 56, dim: 0.22 } : undefined,
  );

  const isDataLoading =
    tracksLoading ||
    allTimeLoading ||
    recentLoading ||
    albumsLoading ||
    savedLoading;

  const isReady = !isDataLoading;
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
    <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-transparent pt-(--page-inset-top) pb-(--page-inset-bottom)">
      <div className="relative z-1 grid grid-cols-1 items-start w-full">
        {isReady && (
          <div className="col-start-1 row-start-1 w-full pb-[16px]">
            {dailyMixes && hasMixes && (
              <DailyMixesSection
                mixes={dailyMixes}
                headingMarginTop="mt-0"
                accentCoverUrl={mixBackdropCover}
              />
            )}

            {popularAlbums.length > 0 && (
              <PopularTracksSection
                title={t("home.popularAlbums")}
                icon={<AlbumFill className="w-6 h-6 text-emerald-400" />}
                items={popularAlbums}
                headingMarginTop={hasMixes ? "mt-[22px]" : "mt-0"}
              />
            )}

            {listeningNow.length > 0 && (
              <ListeningNowSection
                title={t("home.whatEveryonesOn")}
                icon={<FireFill className="w-6 h-6 text-amber-500" />}
                tracks={listeningNow}
                headingMarginTop={
                  hasMixes || popularAlbums.length > 0 ? "mt-[22px]" : "mt-0"
                }
              />
            )}

            {recentlyPlayed && recentlyPlayed.length > 0 && (
              <PopularTracksSection
                title={t("home.jumpBackIn")}
                icon={<TimeFill className="w-6 h-6 text-sky-400" />}
                items={recentlyPlayed}
                headingMarginTop="mt-[22px]"
              />
            )}

            {popularTracksAllTime && popularTracksAllTime.length > 0 && (
              <PopularTracksSection
                title={t("home.mostListened")}
                icon={<TrophyFill className="w-6 h-6 text-yellow-500" />}
                items={popularTracksAllTime}
                headingMarginTop="mt-[22px]"
              />
            )}

            {mostSaved.length > 0 && (
              <PopularTracksSection
                title={t("home.mostSaved")}
                icon={<BookmarkFill className="w-6 h-6 text-rose-400" />}
                items={mostSaved}
                headingMarginTop="mt-[22px]"
              />
            )}

          </div>
        )}

        {!skeletonExited && (
          <div
            className={`col-start-1 row-start-1 w-full z-10 transition-opacity duration-300 ease-out ${
              isReady
                ? "opacity-0 pointer-events-none"
                : "opacity-100 pointer-events-auto"
            }`}
            onTransitionEnd={() => setSkeletonExited(true)}
          >
            <HomePageSkeleton />
          </div>
        )}
      </div>
    </div>
  );
}
