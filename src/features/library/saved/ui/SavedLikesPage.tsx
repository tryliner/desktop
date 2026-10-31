import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { HeartLine, PlayFill } from "@mingcute/react";
import { LuShuffle } from "react-icons/lu";
import { playerEngine, SongCardWithMenu } from "@/features/player";
import { useClassicSurfaces } from "@/features/settings/store/customizationStore";
import { useTranslation } from "@/languages";
import { cn, usePageBackdrop } from "@/shared/lib";
import type { Track } from "@/shared/types";
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
  TrackSearchEmpty,
  TrackSearchField,
  useTrackSearch,
} from "../../ui/TrackSearch";
import { TrackSortMenu, useTrackSort } from "../../ui/TrackSort";
import { useLikesCover } from "../../hooks/useLikesCover";
import { formatTrackDuration } from "../../local/lib/formatLocalDurations";
import { useSavedTracks } from "../hooks/useSavedTracks";

const PAGE_KEY = "saved-likes";
const ROW_HEIGHT = 64;
const INTER = { fontFamily: "var(--font-inter), sans-serif" };

const SavedTrackRow = memo(function SavedTrackRow({
  track,
  queue,
  context,
  highlight,
  top,
}: {
  track: Track;
  queue: Track[];
  context: string;
  highlight?: string;
  top: number;
}) {
  const play = useCallback(
    () => void playerEngine.playTrack(track, queue, context),
    [track, queue, context],
  );
  return (
    <div
      className="absolute left-0 top-0 w-full"
      style={{ height: ROW_HEIGHT, transform: `translateY(${top}px)` }}
    >
      <SongCardWithMenu
        id={track.id}
        title={track.title}
        artists={track.artists}
        coverUrl={track.coverUrl}
        duration={formatTrackDuration(track.durationMs)}
        durationMs={track.durationMs}
        highlight={highlight}
        onPlay={play}
      />
    </div>
  );
});

function SavedTrackList({
  entries,
  queue,
  context,
  highlight,
  scrollRef,
}: {
  entries: { track: Track; index: number }[];
  queue: Track[];
  context: string;
  highlight?: string;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (listRef.current) setScrollMargin(listRef.current.offsetTop);
  }, [entries.length]);

  const virtualizer = useVirtualizer({
    count: entries.length,
    scrollMargin,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    getItemKey: (index) => entries[index]?.track.id ?? index,
  });

  return (
    <div
      ref={listRef}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const entry = entries[row.index];
        if (!entry) return null;
        return (
          <SavedTrackRow
            key={entry.track.id}
            track={entry.track}
            queue={queue}
            context={context}
            highlight={highlight}
            top={row.start - scrollMargin}
          />
        );
      })}
    </div>
  );
}

interface SavedTracksViewProps {
  pageKey: string;
  title: string;
  subtitle: string;
  cover: string;
  tracks: Track[];
  isLoading: boolean;
  emptyTitle: string;
  emptySubtitle: string;
}

export function SavedTracksView({
  pageKey,
  title,
  subtitle,
  cover,
  tracks,
  isLoading,
  emptyTitle,
  emptySubtitle,
}: SavedTracksViewProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const classicSurfaces = useClassicSurfaces();
  usePageBackdrop(cover || undefined, { blur: 56, dim: 0.22 });

  const sort = useTrackSort(tracks, pageKey);
  const search = useTrackSearch(sort.sorted, pageKey);
  const entries = useMemo(
    () =>
      search.matches ?? sort.sorted.map((track, index) => ({ track, index })),
    [search.matches, sort.sorted],
  );
  const context = title;
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

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div
        ref={scrollRef}
        data-no-window-drag
        className="relative z-10 box-border flex h-full w-full min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pt-(--page-inset-top) pb-(--page-inset-bottom)"
      >
        <div className="shrink-0 pl-[16px] pr-[12px] pt-[8px]">
          <EntityHero
            cover={
              <img
                src={cover}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover select-none"
              />
            }
            title={<h1 className={HERO_TITLE_CLASS}>{title}</h1>}
            subtitle={<p className={HERO_SUBTITLE_CLASS}>{subtitle}</p>}
            meta={
              <div className={HERO_CHIP_CLASS}>
                <span>{t("common.songs", { count: tracks.length })}</span>
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
          {isLoading ? null : empty ? (
            <div
              className="flex min-h-[50vh] flex-col items-center justify-center gap-[14px] text-center"
              style={INTER}
            >
              <HeartLine size={40} className="text-border-alpha-33" />
              <div className="flex flex-col gap-[4px]">
                <p className="m-0 text-[15px] font-[500] text-text-primary">
                  {emptyTitle}
                </p>
                <p className="m-0 max-w-[360px] text-[13px] text-text-tertiary">
                  {emptySubtitle}
                </p>
              </div>
            </div>
          ) : search.matches && search.matches.length === 0 ? (
            <TrackSearchEmpty
              query={search.activeQuery}
              onClear={() => search.setQuery("")}
            />
          ) : (
            <SavedTrackList
              entries={entries}
              queue={sort.sorted}
              context={context}
              highlight={search.activeQuery || undefined}
              scrollRef={scrollRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SavedLikesPage() {
  const { t } = useTranslation();
  const likesCover = useLikesCover();
  const { tracks, isLoading } = useSavedTracks();
  return (
    <SavedTracksView
      pageKey={PAGE_KEY}
      title={t("library.liked_songs")}
      subtitle={t("library.saved.subtitle")}
      cover={likesCover}
      tracks={tracks}
      isLoading={isLoading}
      emptyTitle={t("library.saved.empty_title")}
      emptySubtitle={t("library.saved.empty_subtitle")}
    />
  );
}
