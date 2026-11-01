import { useMemo } from "react";
import { ChartBarFill, Delete2Line, Music2Fill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { useStatsStore } from "../store/statsStore";

function formatListeningTime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

const cardClass =
  "rounded-2xl border border-black/[0.06] bg-black/[0.04] p-[16px] dark:border-white/10 dark:bg-white/[0.05]";

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={cn(cardClass, "flex items-center gap-[12px]")}>
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-text-primary dark:bg-white/[0.08]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="m-0 truncate text-[12px] font-[500] text-text-tertiary">
          {label}
        </p>
        <p className="m-0 truncate text-[19px] font-[700] text-text-primary">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { t } = useTranslation();
  const totalMs = useStatsStore((state) => state.totalMs);
  const totalPlays = useStatsStore((state) => state.totalPlays);
  const tracks = useStatsStore((state) => state.tracks);
  const clear = useStatsStore((state) => state.clear);

  const topTracks = useMemo(
    () =>
      Object.values(tracks)
        .sort((a, b) => b.plays - a.plays || b.listenedMs - a.listenedMs)
        .slice(0, 15),
    [tracks],
  );
  const uniqueTracks = Object.keys(tracks).length;

  const handleClear = () => {
    if (!window.confirm(t("stats.clear_confirm"))) return;
    clear();
  };

  return (
    <div
      data-no-window-drag
      className="relative h-full w-full overflow-x-hidden overflow-y-auto overscroll-contain px-[16px] pt-(--page-inset-top) pb-(--page-inset-bottom)"
    >
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-[18px]">
        <div className="flex items-end justify-between gap-[12px] pt-[8px]">
          <div>
            <h1 className="m-0 text-[26px] font-[700] text-text-primary">
              {t("stats.title")}
            </h1>
            <p className="m-0 mt-[4px] text-[13px] text-text-tertiary">
              {t("stats.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={totalMs === 0 && totalPlays === 0}
            className="inline-flex shrink-0 items-center gap-[6px] rounded-full border border-black/[0.06] bg-black/[0.04] px-[12px] py-[7px] text-[12px] font-[500] text-text-secondary transition-opacity hover:text-text-primary disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <Delete2Line size={14} />
            {t("stats.clear")}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-3">
          <SummaryCard
            label={t("stats.total_time")}
            value={formatListeningTime(totalMs)}
            icon={<ChartBarFill size={18} />}
          />
          <SummaryCard
            label={t("stats.total_plays")}
            value={String(totalPlays)}
            icon={<Music2Fill size={18} />}
          />
          <SummaryCard
            label={t("stats.unique_tracks")}
            value={String(uniqueTracks)}
            icon={<Music2Fill size={18} />}
          />
        </div>

        <div className={cn(cardClass, "p-0")}>
          <h2 className="m-0 px-[16px] pb-[8px] pt-[14px] text-[14px] font-[600] text-text-primary">
            {t("stats.top_tracks")}
          </h2>
          {topTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-[8px] px-[16px] py-[48px] text-center">
              <ChartBarFill size={30} className="text-text-tertiary" />
              <p className="m-0 text-[13px] font-[500] text-text-secondary">
                {t("stats.empty")}
              </p>
              <p className="m-0 max-w-[320px] text-[12px] text-text-tertiary">
                {t("stats.empty_hint")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col pb-[6px]">
              {topTracks.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-[12px] px-[16px] py-[8px]"
                >
                  <span className="w-[18px] shrink-0 text-right text-[12px] font-[600] text-text-tertiary">
                    {index + 1}
                  </span>
                  <img
                    src={track.coverUrl}
                    alt=""
                    loading="lazy"
                    className="size-[36px] shrink-0 rounded-[6px] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-[500] text-text-primary">
                      {track.title}
                    </p>
                    <p className="m-0 truncate text-[11.5px] text-text-tertiary">
                      {track.artist}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="m-0 text-[12px] font-[600] text-text-primary">
                      {t("stats.plays", { count: track.plays })}
                    </p>
                    <p className="m-0 text-[11px] text-text-tertiary">
                      {formatListeningTime(track.listenedMs)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
