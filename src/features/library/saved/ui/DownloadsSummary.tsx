import { useMemo } from "react";
import { DownloadLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useSavedTracksStore } from "../store/savedTracksStore";
import { currentDownloads, useDownloadsStore } from "../store/downloadsStore";
import { formatDownloadBytes } from "../hooks/useDownloads";
import { retryDownload } from "../store/savedTracksStore";
import { CollectionChip } from "./CollectionChip";

export function DownloadsSummary() {
  const { t } = useTranslation();
  const records = useSavedTracksStore((s) => s.records);
  const limitBytes = useSavedTracksStore((s) => s.limitBytes);
  const active = useDownloadsStore((s) => s.active);
  const queued = useDownloadsStore((s) => s.queued);
  const failed = useDownloadsStore((s) => s.failed);
  const byAccount = useDownloadsStore((s) => s.byAccount);

  const downloads = currentDownloads({ byAccount });
  const collections = useMemo(
    () =>
      Object.values(downloads.collections).sort(
        (a, b) => b.pinnedAt - a.pinnedAt,
      ),
    [downloads.collections],
  );
  const saved = useMemo(
    () => new Set(records.map((record) => record.trackId)),
    [records],
  );
  const usedBytes = records.reduce((sum, record) => sum + record.byteSize, 0);
  const activeTitle = useMemo(() => {
    if (!active) return null;
    const pinned =
      downloads.tracks[active.trackId] ??
      collections
        .flatMap((collection) => collection.tracks)
        .find((track) => track.id === active.trackId);
    return pinned?.title ?? null;
  }, [active, downloads.tracks, collections]);

  const waiting = queued.filter((id) => id !== active?.trackId).length;
  const busy = Boolean(active) || waiting > 0 || failed.length > 0;
  const percent =
    active?.total && active.total > 0
      ? Math.round((active.received / active.total) * 100)
      : null;

  if (!busy && collections.length === 0 && records.length === 0) return null;

  return (
    <div className="flex flex-col gap-[14px] px-[16px] pb-[6px] pt-[10px]">
      {busy && (
        <div className="flex flex-col gap-[8px] rounded-[12px] bg-fill px-[14px] py-[12px]">
          <div className="flex items-center gap-[10px]">
            <DownloadLine size={16} className="shrink-0 text-text-secondary" />
            <span className="min-w-0 flex-1 truncate text-label text-text-primary">
              {active
                ? `${t("downloads.now")}: ${activeTitle ?? "…"}`
                : waiting > 0
                  ? t("downloads.waiting", { count: waiting })
                  : t("downloads.failed", { count: failed.length })}
            </span>
            {active && waiting > 0 && (
              <span className="shrink-0 text-caption tabular-nums text-text-tertiary">
                {t("downloads.waiting", { count: waiting })}
              </span>
            )}
            {failed.length > 0 && (
              <button
                type="button"
                onClick={() => failed.forEach((id) => retryDownload(id))}
                className="shrink-0 cursor-pointer rounded-control border-none bg-fill-strong px-[10px] py-[4px] text-caption font-[500] text-text-primary hover:bg-fill-hover"
              >
                {t("downloads.retry_all")} ({failed.length})
              </button>
            )}
          </div>
          {active && (
            <div
              className="h-[4px] overflow-hidden rounded-full bg-border-alpha-14"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent ?? undefined}
            >
              <div
                className={`h-full rounded-full bg-text-primary transition-[width] duration-300 ${
                  percent === null ? "w-1/3 animate-pulse" : ""
                }`}
                style={percent === null ? undefined : { width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-[12px] text-caption tabular-nums text-text-tertiary">
        <span>
          {formatDownloadBytes(usedBytes)}
          {limitBytes > 0 ? ` / ${formatDownloadBytes(limitBytes)}` : ""}
        </span>
        {limitBytes > 0 && (
          <span className="h-[4px] w-[120px] overflow-hidden rounded-full bg-border-alpha-14">
            <span
              className="block h-full rounded-full bg-text-secondary"
              style={{
                width: `${Math.min(100, (usedBytes / limitBytes) * 100)}%`,
              }}
            />
          </span>
        )}
      </div>

      {collections.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <span className="text-caption font-[500] uppercase tracking-[0.04em] text-text-tertiary">
            {t("downloads.collections")}
          </span>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[8px]">
            {collections.map((collection) => (
              <CollectionChip
                key={collection.id}
                collection={collection}
                saved={saved}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
