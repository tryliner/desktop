import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SongCardWithMenu, playerEngine } from "@/features/player";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { formatTrackDuration } from "../../local/lib/formatLocalDurations";
import { useCachedTracksStore } from "../store/cachedTracksStore";

const ROW_HEIGHT = 64;

const CachedTrackRow = memo(function CachedTrackRow({
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
  const remove = useCachedTracksStore((state) => state.remove);
  const play = useCallback(
    () => void playerEngine.playTrack(track, queue, context),
    [track, queue, context],
  );
  const removeFromDevice = useCallback(
    () => void remove(track.id),
    [remove, track.id],
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
        onRemoveFromDevice={removeFromDevice}
      />
    </div>
  );
});

export default function CachedTrackList({
  entries,
  queue,
  highlight,
  scrollRef,
}: {
  entries: { track: Track; index: number }[];
  queue: Track[];
  highlight?: string;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
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
          <CachedTrackRow
            key={entry.track.id}
            track={entry.track}
            queue={queue}
            context={t("library.cached.title")}
            highlight={highlight}
            top={row.start - scrollMargin}
          />
        );
      })}
    </div>
  );
}
