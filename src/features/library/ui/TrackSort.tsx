import { memo, useEffect, useMemo, useState } from "react";
import { LuArrowUpNarrowWide } from "react-icons/lu";
import Button from "@/shared/ui/Button";
import {
  DropdownMenu,
  HERO_BUTTON_CLASS,
  HERO_GLASS_BUTTON_CLASS,
} from "@/shared/ui";
import { useTranslation } from "@/languages";

export type TrackSortOption = "default" | "title" | "duration" | "popularity";

export const TRACK_SORT_OPTIONS: TrackSortOption[] = [
  "default",
  "title",
  "duration",
  "popularity",
];

interface SortableTrack {
  title: string;
  durationMs: number;
  playCount: number;
}

/** Stable sort; "default" keeps the source order untouched. */
export function sortTracks<T extends SortableTrack>(
  tracks: T[],
  option: TrackSortOption,
): T[] {
  if (option === "default") return tracks;
  const indexed = tracks.map((track, index) => ({ track, index }));
  indexed.sort((a, b) => {
    let diff = 0;
    if (option === "title") {
      diff = a.track.title.localeCompare(b.track.title, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    } else if (option === "duration") {
      diff = (a.track.durationMs || 0) - (b.track.durationMs || 0);
    } else if (option === "popularity") {
      diff = (b.track.playCount || 0) - (a.track.playCount || 0);
    }
    return diff !== 0 ? diff : a.index - b.index;
  });
  return indexed.map((entry) => entry.track);
}

export interface TrackSortState<T> {
  option: TrackSortOption;
  setOption: (option: TrackSortOption) => void;
  sorted: T[];
}

/** Sort state for a track list; resets to "default" when `key` changes (another playlist/album). */
export function useTrackSort<T extends SortableTrack>(
  tracks: T[],
  key: string | null | undefined,
): TrackSortState<T> {
  const [option, setOption] = useState<TrackSortOption>("default");

  useEffect(() => {
    setOption("default");
  }, [key]);

  const sorted = useMemo(() => sortTracks(tracks, option), [tracks, option]);

  return { option, setOption, sorted };
}

interface TrackSortMenuProps {
  sort: TrackSortState<unknown>;
  disabled?: boolean;
}

export const TrackSortMenu = memo(function TrackSortMenu({
  sort,
  disabled,
}: TrackSortMenuProps) {
  const { t } = useTranslation();

  const labels: Record<TrackSortOption, string> = {
    default: t("track_sort.default"),
    title: t("track_sort.title"),
    duration: t("track_sort.duration"),
    popularity: t("track_sort.popularity"),
  };

  return (
    <DropdownMenu
      align="end"
      trigger={
        <Button
          variant="secondary"
          disabled={disabled}
          className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`}
          title={t("track_sort.label")}
          aria-label={t("track_sort.label")}
        >
          <LuArrowUpNarrowWide size={18} />
        </Button>
      }
      items={TRACK_SORT_OPTIONS.map((option) => ({
        id: option,
        label: labels[option],
        active: sort.option === option,
        onClick: () => sort.setOption(option),
      }))}
    />
  );
});

export default TrackSortMenu;
