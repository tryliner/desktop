import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayFill, Refresh2Line } from "@mingcute/react";
import { LuShuffle, LuTrash2 } from "react-icons/lu";
import { playerEngine } from "@/features/player";
import { useClassicSurfaces } from "@/features/settings/store/customizationStore";
import { useTranslation } from "@/languages";
import { cn, usePageBackdrop } from "@/shared/lib";
import cachedSongsCover from "@/assets/cached-songs-cover.svg";
import {
  EntityHero,
  HERO_BUTTON_CLASS,
  HERO_CHIP_CLASS,
  HERO_GLASS_BUTTON_CLASS,
  HERO_GLASS_CLASS,
  HERO_SUBTITLE_CLASS,
  HERO_TITLE_CLASS,
} from "@/shared/ui";
import Button from "@/shared/ui/Button";
import {
  clearStorageCategories,
  formatStorageBytes,
} from "@/shared/utils/cacheManager";
import {
  TrackSearchEmpty,
  TrackSearchField,
  useTrackSearch,
} from "../../ui/TrackSearch";
import { TrackSortMenu, useTrackSort } from "../../ui/TrackSort";
import { useCachedTracksStore } from "../store/cachedTracksStore";
import CachedSongsCover from "./CachedSongsCover";
import CachedTrackList from "./CachedTrackList";

const PAGE_KEY = "cached";
const INTER = { fontFamily: "var(--font-inter), sans-serif" };

export default function CachedTracksPage() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const classicSurfaces = useClassicSurfaces();
  const items = useCachedTracksStore((state) => state.items);
  const loaded = useCachedTracksStore((state) => state.loaded);
  const load = useCachedTracksStore((state) => state.load);
  const [clearing, setClearing] = useState(false);
  usePageBackdrop(cachedSongsCover, { dim: 0.05 });

  useEffect(() => {
    void load();
  }, [load]);

  const tracks = useMemo(() => items.map((item) => item.track), [items]);
  const totalBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.bytes, 0),
    [items],
  );

  const sort = useTrackSort(tracks, PAGE_KEY);
  const search = useTrackSearch(sort.sorted, PAGE_KEY);
  const entries = useMemo(
    () =>
      search.matches ?? sort.sorted.map((track, index) => ({ track, index })),
    [search.matches, sort.sorted],
  );
  const context = t("library.cached.title");
  const empty = tracks.length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [search.activeQuery, sort.option]);

  const playAll = useCallback(() => {
    if (!sort.sorted.length) return;
    playerEngine.clearQueue();
    void playerEngine.playTrack(sort.sorted[0], sort.sorted, context);
  }, [sort.sorted, context]);

  const shuffle = useCallback(() => {
    if (!sort.sorted.length) return;
    playerEngine.clearQueue();
    void playerEngine.playShuffled(sort.sorted, context);
  }, [sort.sorted, context]);

  const submitSearch = useCallback(() => {
    const first = search.matches?.[0];
    if (first) void playerEngine.playTrack(first.track, sort.sorted, context);
  }, [search.matches, sort.sorted, context]);

  const clearAll = async () => {
    setClearing(true);
    try {
      await clearStorageCategories(["audio"]);
      await load();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div
        ref={scrollRef}
        data-no-window-drag
        className="relative z-10 box-border flex h-full w-full min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pt-(--page-inset-top) pb-(--page-inset-bottom)"
      >
        <div className="shrink-0 pl-[16px] pr-[12px] pt-[8px]">
          <EntityHero
            cover={<CachedSongsCover className="absolute inset-0" />}
            title={
              <h1 className={HERO_TITLE_CLASS}>{t("library.cached.title")}</h1>
            }
            subtitle={
              <p className={HERO_SUBTITLE_CLASS}>
                {t("library.cached.subtitle")}
              </p>
            }
            meta={
              <div className={HERO_CHIP_CLASS}>
                <span>{t("common.songs", { count: tracks.length })}</span>
                {!empty && (
                  <>
                    <span
                      className="h-[3px] w-[3px] shrink-0 rounded-full bg-text-secondary/50"
                      aria-hidden
                    />
                    <span>{formatStorageBytes(totalBytes)}</span>
                  </>
                )}
              </div>
            }
            actions={
              <>
                <Button
                  variant="primary"
                  onClick={playAll}
                  disabled={empty}
                  className={`${HERO_BUTTON_CLASS} px-[22px]`}
                >
                  <PlayFill size={16} />
                  <span>{t("common.play_all")}</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={shuffle}
                  disabled={empty}
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
                  totalCount={tracks.length}
                  placeholder={t("track_search.placeholder_playlist")}
                  onSubmit={submitSearch}
                  className={HERO_GLASS_CLASS}
                />
                <TrackSortMenu sort={sort} disabled={tracks.length < 2} />
                {!empty && (
                  <Button
                    variant="secondary"
                    onClick={() => void clearAll()}
                    disabled={clearing}
                    className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`}
                    title={t("library.cached.clear_all")}
                    aria-label={t("library.cached.clear_all")}
                  >
                    <LuTrash2 size={17} />
                  </Button>
                )}
              </>
            }
          />
        </div>

        <div
          className={cn(
            "mx-[4px] mt-[20px] shrink-0 grow overflow-hidden rounded-t-[14px] bg-black/[0.03] px-[8px] pt-[8px] dark:bg-white/[0.04]",
            !classicSurfaces && "backdrop-blur-xl",
          )}
          style={{
            marginBottom: "calc(var(--page-inset-bottom) * -1)",
            paddingBottom: "calc(var(--page-inset-bottom) + 16px)",
          }}
        >
          {!loaded ? null : empty ? (
            <div
              className="flex min-h-[50vh] flex-col items-center justify-center gap-[14px] text-center"
              style={INTER}
            >
              <Refresh2Line size={40} className="text-border-alpha-33" />
              <div className="flex flex-col gap-[4px]">
                <p className="m-0 text-[15px] font-[500] text-text-primary">
                  {t("library.cached.empty_title")}
                </p>
                <p className="m-0 max-w-[360px] text-[13px] text-text-tertiary">
                  {t("library.cached.empty_subtitle")}
                </p>
              </div>
            </div>
          ) : search.matches && search.matches.length === 0 ? (
            <TrackSearchEmpty
              query={search.activeQuery}
              onClear={() => search.setQuery("")}
            />
          ) : (
            <CachedTrackList
              entries={entries}
              queue={sort.sorted}
              highlight={search.activeQuery || undefined}
              scrollRef={scrollRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}
