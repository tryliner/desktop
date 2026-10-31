import { useState, useEffect } from "react";
import PopularTracksSection from "./PopularTracksSection";
import DailyMixesSection from "./DailyMixesSection";
import HomePageSkeleton, { MixesSectionSkeleton } from "./HomePageSkeleton";
import { usePopularTracksAllTime } from "../hooks/usePopularTracks";
import { useListeningNow } from "../hooks/useListeningNow";
import ListeningNowSection from "./ListeningNowSection";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useDailyMixes } from "../hooks/useDailyMixes";
import { useMostSaved, usePopularAlbums } from "../hooks/useExploreCollections";
import { useTranslation } from "@/languages";
import Button from "@/shared/ui/Button";
import { usePageBackdrop } from "@/shared/lib";
import { useHomeBackdrop } from "../hooks/useHomeBackdrop";
import {
  AlbumFill,
  BookmarkFill,
  FireFill,
  TrophyFill,
  TimeFill,
} from "@mingcute/react";

export default function HomePage() {
  const [attempt, setAttempt] = useState(0);
  return <HomeFeed key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function HomeFeed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  const { tracks: listeningNow, isLoading: tracksLoading } = useListeningNow();
  const { data: popularTracksAllTime, isLoading: allTimeLoading } =
    usePopularTracksAllTime(20);
  const { data: recentlyPlayed, isLoading: recentLoading } =
    useRecentlyPlayed(20);
  const { items: popularAlbums, isLoading: albumsLoading } = usePopularAlbums();
  const { items: mostSaved, isLoading: savedLoading } = useMostSaved();
  const { data: dailyMixes, isLoading: mixesLoading } = useDailyMixes();
  const hasMixes = dailyMixes.length > 0;
  const firstAlbum = popularAlbums[0];
  const firstAlbumCover =
    firstAlbum?.type === "album" ? firstAlbum.item.coverUrl : undefined;
  const homeBackdrop = useHomeBackdrop(dailyMixes);
  const usesMixBackdrop = hasMixes || mixesLoading;
  usePageBackdrop(
    usesMixBackdrop
      ? homeBackdrop.backdrop
      : firstAlbumCover || listeningNow[0]?.coverUrl || undefined,
    usesMixBackdrop ? { blur: 56, dim: 0.22 } : undefined,
  );

  const hasMixesSlot = hasMixes || mixesLoading;
  const isDataLoading =
    tracksLoading ||
    allTimeLoading ||
    recentLoading ||
    albumsLoading ||
    savedLoading;

  const isReady = !isDataLoading;
  const nothingLoaded =
    !mixesLoading &&
    !hasMixes &&
    popularAlbums.length === 0 &&
    listeningNow.length === 0 &&
    !recentlyPlayed?.length &&
    !popularTracksAllTime?.length &&
    mostSaved.length === 0;
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
        {isReady && nothingLoaded && (
          <div className="col-start-1 row-start-1 flex min-h-[60vh] w-full flex-col items-center justify-center gap-[6px] px-[24px] text-center">
            <span className="text-[15px] font-[600] text-text-primary">
              {t("home.load_failed")}
            </span>
            <span className="text-[13px] text-text-secondary">
              {t("playlist.load_failed_desc")}
            </span>
            <Button
              variant="secondary"
              onClick={onRetry}
              className="mt-[10px] !h-[36px] !rounded-[10px] !border-0 px-[16px]"
            >
              {t("offline.try_again")}
            </Button>
          </div>
        )}

        {isReady && !nothingLoaded && (
          <div className="col-start-1 row-start-1 w-full pb-[16px]">
            {mixesLoading ? (
              <MixesSectionSkeleton />
            ) : (
              hasMixes && (
                <div style={{ animation: "page-enter 200ms ease-out" }}>
                  <DailyMixesSection
                    mixes={dailyMixes}
                    headingMarginTop="mt-0"
                    accentCoverUrl={homeBackdrop.cover}
                  />
                </div>
              )
            )}

            {popularAlbums.length > 0 && (
              <PopularTracksSection
                title={t("home.popularAlbums")}
                icon={<AlbumFill className="w-6 h-6 text-emerald-400" />}
                items={popularAlbums}
                headingMarginTop={hasMixesSlot ? "mt-[22px]" : "mt-0"}
              />
            )}

            {listeningNow.length > 0 && (
              <ListeningNowSection
                title={t("home.whatEveryonesOn")}
                icon={<FireFill className="w-6 h-6 text-amber-500" />}
                tracks={listeningNow}
                headingMarginTop={
                  hasMixesSlot || popularAlbums.length > 0
                    ? "mt-[22px]"
                    : "mt-0"
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
            onTransitionEnd={(event) => {
              if (event.target === event.currentTarget) setSkeletonExited(true);
            }}
          >
            <HomePageSkeleton />
          </div>
        )}
      </div>
    </div>
  );
}
