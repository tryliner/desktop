import { useEffect, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { formatStorageBytes } from "@/shared/utils/cacheManager";

const LOW_DISK_BYTES = 2 * 1024 * 1024 * 1024;
const MIN_SHARE = 0.015;

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

export const SMOOTH_EASE = [0.22, 1, 0.36, 1] as const;

export function useTweenedNumber(value: number) {
  const [current, setCurrent] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration: 0.7,
      ease: SMOOTH_EASE,
      onUpdate: (next) => {
        fromRef.current = next;
        setCurrent(next);
      },
    });
    return () => controls.stop();
  }, [value]);

  return current;
}

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

const formatFree = (bytes: number) =>
  bytes >= 1024 * 1024 * 1024
    ? `${Math.round(bytes / (1024 * 1024 * 1024))} GB`
    : formatStorageBytes(bytes);

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span className={`h-[7px] w-[7px] rounded-full ${swatch}`} />
      {label}
    </span>
  );
}

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

  const share = (bytes: number) =>
    total > 0 && bytes > 0 ? Math.max(bytes / total, MIN_SHARE) : 0;
  const segments = [
    { key: "music", grow: share(musicBytes), swatch: "bg-text-primary" },
    { key: "cache", grow: share(cacheBytes), swatch: "bg-text-tertiary/60" },
  ];
  const empty = segments.every((segment) => segment.grow === 0);

  return (
    <div className="flex flex-col px-[2px] pt-[4px]" style={font}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-[5px]">
          <span className="text-[28px] font-[600] leading-none tracking-[-0.02em] tabular-nums text-text-primary">
            {value}
          </span>
          <span className="text-[15px] text-text-tertiary">{unit}</span>
        </div>
        {freeBytes !== undefined ? (
          <span
            className={`text-[13px] tabular-nums ${
              lowDisk ? "text-amber-500" : "text-text-tertiary"
            }`}
          >
            {t("settings.storage.free_on_disk", {
              size: formatFree(freeBytes),
            })}
          </span>
        ) : null}
      </div>

      <div className="mt-[14px] flex h-[8px] gap-[3px]">
        {empty ? (
          <div className="h-full flex-1 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
        ) : (
          segments.map((segment) => (
            <motion.div
              key={segment.key}
              className={`h-full rounded-full ${segment.swatch}`}
              style={{ flexBasis: 0 }}
              initial={false}
              animate={{
                flexGrow: segment.grow,
                opacity: segment.grow > 0 ? 1 : 0,
              }}
              transition={{ duration: 0.7, ease: SMOOTH_EASE }}
            />
          ))
        )}
      </div>

      <div className="mt-[12px] flex gap-[20px] text-[13px] tabular-nums text-text-tertiary">
        <Legend
          swatch="bg-text-primary"
          label={`${t("settings.storage.music_title")} ${formatStorageBytes(musicBytes)}`}
        />
        <Legend
          swatch="bg-text-tertiary/60"
          label={`${t("settings.storage.cache_title")} ${formatStorageBytes(cacheBytes)}`}
        />
      </div>
    </div>
  );
}
