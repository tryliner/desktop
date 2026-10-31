import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playerEngine } from "@/features/player";
import {
  TrackSearchEmpty,
  TrackSearchField,
  useTrackSearch,
} from "../../ui/TrackSearch";
import { TrackSortMenu, useTrackSort } from "../../ui/TrackSort";
import { useClassicSurfaces } from "@/features/settings/store/customizationStore";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { HERO_GLASS_CLASS } from "@/shared/ui";
import { useLocalImport } from "../hooks/useLocalImport";
import { useLocalTracks } from "../hooks/useLocalTracks";
import LocalTrackList from "./LocalTrackList";
import LocalTracksEmpty from "./LocalTracksEmpty";
import LocalTracksHero from "./LocalTracksHero";
import RemoveAllLocalDialog from "./RemoveAllLocalDialog";

const PAGE_KEY = "local";

export default function LocalTracksPage() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const classicSurfaces = useClassicSurfaces();
  const { tracks, isLoading } = useLocalTracks();
  const { chooseFiles, importing } = useLocalImport();
  const [removeAllOpen, setRemoveAllOpen] = useState(false);

  const sort = useTrackSort(tracks, PAGE_KEY);
  const search = useTrackSearch(sort.sorted, PAGE_KEY);
  const entries = useMemo(
    () =>
      search.matches ?? sort.sorted.map((track, index) => ({ track, index })),
    [search.matches, sort.sorted],
  );
  const context = t("library.local.title");

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
          <LocalTracksHero
            tracks={tracks}
            importing={importing}
            onPlayAll={playAll}
            onShuffle={shuffle}
            onAddFiles={() => void chooseFiles()}
            onRemoveAll={() => setRemoveAllOpen(true)}
            search={
              <TrackSearchField
                search={search}
                totalCount={tracks.length}
                placeholder={t("track_search.placeholder_playlist")}
                onSubmit={submitSearch}
                className={HERO_GLASS_CLASS}
              />
            }
            sort={<TrackSortMenu sort={sort} disabled={tracks.length < 2} />}
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
          {isLoading ? null : tracks.length === 0 ? (
            <LocalTracksEmpty
              importing={importing}
              onAddFiles={() => void chooseFiles()}
            />
          ) : search.matches && search.matches.length === 0 ? (
            <TrackSearchEmpty
              query={search.activeQuery}
              onClear={() => search.setQuery("")}
            />
          ) : (
            <LocalTrackList
              entries={entries}
              queue={sort.sorted}
              highlight={search.activeQuery || undefined}
              scrollRef={scrollRef}
            />
          )}
        </div>
      </div>
      <RemoveAllLocalDialog
        open={removeAllOpen}
        onClose={() => setRemoveAllOpen(false)}
      />
    </div>
  );
}
