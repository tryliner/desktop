import { useState } from "react";
import { useTweenedNumber } from "@/shared/hooks";
import { UsageOverview } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { formatStorageBytes } from "@/shared/utils/cacheManager";

const LOW_DISK_BYTES = 2 * 1024 * 1024 * 1024;

export const estimateSongs = (limitBytes: number, songBytes: number) => {
  const count = limitBytes / songBytes;
  if (count >= 1000) return Math.round(count / 100) * 100;
  if (count >= 100) return Math.round(count / 10) * 10;
  return Math.max(1, Math.round(count));
};

export function useSongEstimate(limitBytes: number, songBytes: number) {
  const [estimate, setEstimate] = useState(() => ({
    limitBytes,
    count: estimateSongs(limitBytes, songBytes),
  }));
  if (estimate.limitBytes === limitBytes) return estimate.count;
  const next = { limitBytes, count: estimateSongs(limitBytes, songBytes) };
  setEstimate(next);
  return next.count;
}

export { SMOOTH_EASE, useTweenedNumber } from "@/shared/hooks";

const formatFree = (bytes: number) =>
  bytes >= 1024 * 1024 * 1024
    ? `${Math.round(bytes / (1024 * 1024 * 1024))} GB`
    : formatStorageBytes(bytes);

export function StorageOverview({
  musicBytes,
  cacheBytes,
  freeBytes,
}: {
  musicBytes: number;
  cacheBytes: number;
  freeBytes?: number;
}) {
  const { t } = useTranslation();
  const total = musicBytes + cacheBytes;
  const tweenedTotal = useTweenedNumber(total);
  const [value, unit] = formatStorageBytes(Math.round(tweenedTotal)).split(" ");
  const lowDisk = freeBytes !== undefined && freeBytes < LOW_DISK_BYTES;

  return (
    <UsageOverview
      value={value}
      unit={unit}
      meta={
        freeBytes !== undefined ? (
          <span
            className={`text-body tabular-nums ${
              lowDisk ? "text-amber-500" : "text-text-tertiary"
            }`}
          >
            {t("settings.storage.free_on_disk", {
              size: formatFree(freeBytes),
            })}
          </span>
        ) : null
      }
      segments={[
        {
          key: "music",
          value: musicBytes,
          swatch: "bg-text-primary",
          label: `${t("settings.storage.music_title")} ${formatStorageBytes(musicBytes)}`,
        },
        {
          key: "cache",
          value: cacheBytes,
          swatch: "bg-text-tertiary/60",
          label: `${t("settings.storage.cache_title")} ${formatStorageBytes(cacheBytes)}`,
        },
      ]}
    />
  );
}
