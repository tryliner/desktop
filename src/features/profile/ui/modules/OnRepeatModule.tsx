import { useTranslation } from "@/languages";
import { weekdayLabels } from "../../lib/formatProfileStats";
import type { ProfileTrack } from "../../model/types";
import { ModuleCard, ModuleGlow, TrackCover } from "./ModuleCard";

const BAR_MIN_HEIGHT = 22;
const BAR_MAX_HEIGHT = 36;

function WeekBars({ dailyPlays }: { dailyPlays: number[] }) {
  const { locale } = useTranslation();
  const labels = weekdayLabels(locale);
  const max = Math.max(...dailyPlays);
  const min = Math.min(...dailyPlays);
  const barHeight = (plays: number) =>
    max === min
      ? BAR_MAX_HEIGHT
      : BAR_MIN_HEIGHT +
        ((plays - min) / (max - min)) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);

  return (
    <ol className="m-0 flex list-none items-end gap-1.5 p-0">
      {dailyPlays.slice(0, 7).map((plays, day) => (
        <li
          key={day}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
        >
          <span
            className="flex w-full items-center justify-center rounded-control bg-fill-strong text-body font-[500] text-text-primary tabular-nums"
            style={{ height: barHeight(plays) }}
          >
            {plays}
          </span>
          <span className="text-caption leading-tight text-text-tertiary">
            {labels[day]}
          </span>
        </li>
      ))}
    </ol>
  );
}

interface OnRepeatModuleProps {
  track: ProfileTrack;
  playCount: number;
  dailyPlays: number[];
}

export function OnRepeatModule({
  track,
  playCount,
  dailyPlays,
}: OnRepeatModuleProps) {
  const { t } = useTranslation();

  return (
    <ModuleCard
      glow={<ModuleGlow src={track.coverUrl} className="opacity-35" />}
      className="flex-row gap-3"
    >
      <TrackCover src={track.coverUrl} className="size-28 rounded-control" />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body text-text-secondary">
              {t("profile.on_repeat_week")}
            </span>
            <span className="truncate text-heading font-[600] text-text-primary">
              {track.title}
            </span>
            <span className="truncate text-label text-text-secondary">
              {track.artist}
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-fill-strong px-3 py-1 text-title font-[600] text-text-primary tabular-nums">
            {playCount}x
          </span>
        </div>
        <WeekBars dailyPlays={dailyPlays} />
      </div>
    </ModuleCard>
  );
}
