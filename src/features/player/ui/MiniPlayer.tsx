import { memo } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Radio,
  Sidebar,
  Play,
  Pause,
  Repeat,
  RepeatOne,
  Shuffle,
  SkipNext,
  SkipPrevious,
  VolumeCross,
  VolumeSmall,
  VolumeLoud,
  MaximizeSquare3,
  TrashBin2,
  Bookmark,
} from "@solar-icons/react";
import { HeartFill, HeartLine } from "@mingcute/react";

import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import Button from "@/shared/ui/Button";
import SongCard from "./SongCard";
import { useTranslation } from "@/languages";
import { useIsTrackLiked, useLikeTrack, useUnlikeTrack } from "@/features/library/hooks";
import { usePlayerStore } from "../store/playerStore";
import { toVolumeGain, toVolumeLevel } from "../engine/volume";
import { VolumePicker } from "./VolumePicker";
import { TimelineSlider } from "./TimelineSlider";
import { useTheme } from "next-themes";
import { useCoverReady, CoverImage } from "@/features/covers";
import ExplicitBadge from "@/shared/ui/ExplicitBadge";
import { ArtistLink } from "@/features/artist";

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function extractColorsFromCanvas(
  canvas: HTMLCanvasElement,
  isLight = false,
): {
  accentColor: string;
  accentColorSolid: string;
} {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      accentColor: "rgba(255, 255, 255, 0.12)",
      accentColorSolid: "rgb(255, 255, 255)",
    };
  }

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let totalWeight = 0;
  let weightedR = 0;
  let weightedG = 0;
  let weightedB = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  const count = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalR += r;
    totalG += g;
    totalB += b;

    const [, s, l] = rgbToHsl(r, g, b);
    if (l > 0.08 && l < 0.95 && s > 0.1) {
      const vibrancy = s * (1 - Math.abs(l - 0.5) * 1.5);
      const weight = Math.max(0.01, vibrancy * vibrancy);
      weightedR += r * weight;
      weightedG += g * weight;
      weightedB += b * weight;
      totalWeight += weight;
    }
  }

  let finalR = Math.round(totalWeight > 0.5 ? weightedR / totalWeight : totalR / count);
  let finalG = Math.round(totalWeight > 0.5 ? weightedG / totalWeight : totalG / count);
  let finalB = Math.round(totalWeight > 0.5 ? weightedB / totalWeight : totalB / count);

  const [h, s, l] = rgbToHsl(finalR, finalG, finalB);

  if (isLight) {
    if (s < 0.12) {
      return {
        accentColor: "rgba(0, 0, 0, 0.045)",
        accentColorSolid: "rgb(30, 30, 30)",
      };
    }
    // Luminous vibrant tint for light theme card progress fill
    const tintL = 0.50;
    const tintS = Math.max(0.80, s);
    const [tintR, tintG, tintB] = hslToRgb(h, tintS, tintL);

    // Deep high-contrast tone for bottom timeline line
    const solidL = Math.max(0.36, Math.min(0.46, l > 0.55 ? 0.40 : l));
    const solidS = Math.max(0.75, s);
    const [solidR, solidG, solidB] = hslToRgb(h, solidS, solidL);

    return {
      accentColor: `rgba(${tintR}, ${tintG}, ${tintB}, 0.09)`,
      accentColorSolid: `rgb(${solidR}, ${solidG}, ${solidB})`,
    };
  }

  // If mostly achromatic / monochrome (black, white, or gray cover)
  if (s < 0.12) {
    return {
      accentColor: l < 0.5 ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.09)",
      accentColorSolid: "rgb(255, 255, 255)",
    };
  }

  // Ensure high contrast and vibrant visibility on dark backgrounds
  const solidL = Math.max(0.65, Math.min(0.82, l < 0.45 ? 0.70 : l));
  const solidS = Math.max(0.70, s);
  const [solidR, solidG, solidB] = hslToRgb(h, solidS, solidL);

  const bgOpacity = l < 0.25 ? 0.22 : l < 0.5 ? 0.18 : 0.12;

  return {
    accentColor: `rgba(${solidR}, ${solidG}, ${solidB}, ${bgOpacity})`,
    accentColorSolid: `rgb(${solidR}, ${solidG}, ${solidB})`,
  };
}

export interface MiniPlayerProps {
  onQueueOpenChange?: (open: boolean) => void;
  onQueueToggle?: () => void;
  onFullscreenOpen?: () => void;
  embedded?: boolean;
}

function MiniPlayer({
  onQueueOpenChange,
  onQueueToggle,
  onFullscreenOpen,
  embedded = false,
}: MiniPlayerProps) {
  const player = usePlayerState();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const miniPlayerStyle = usePlayerStore((state) => state.miniPlayerStyle);
  const usesRoundedStyle = !embedded && miniPlayerStyle === "rounded";
  const usesBackgroundProgress = true;
  const [accentColor, setAccentColor] = useState(
    isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.12)",
  );
  const [accentColorSolid, setAccentColorSolid] = useState(
    isLight ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)",
  );
  const [contextAccentColorSolid, setContextAccentColorSolid] = useState(
    isLight ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)",
  );

  const coverUrl = player.currentTrack?.coverUrl || "";

  useEffect(() => {
    if (!player.playbackContextCover) {
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);
        const { accentColorSolid: acs } = extractColorsFromCanvas(canvas, isLight);
        setContextAccentColorSolid(acs);
      } catch {
        setContextAccentColorSolid(isLight ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)");
      }
    };
    img.src = player.playbackContextCover;
  }, [player.playbackContextCover, isLight]);

  useEffect(() => {
    if (!coverUrl) {
      setAccentColor(isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.12)");
      setAccentColorSolid(isLight ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)");
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 64, 64);
        const { accentColor: ac, accentColorSolid: acs } = extractColorsFromCanvas(canvas, isLight);
        setAccentColor(ac);
        setAccentColorSolid(acs);
      } catch {
        setAccentColor(isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.12)");
        setAccentColorSolid(isLight ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)");
      }
    };
    img.src = coverUrl;
  }, [coverUrl, isLight]);

  const extractAccentColor = useCallback((img: HTMLImageElement) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 64, 64);
      const { accentColor: ac, accentColorSolid: acs } = extractColorsFromCanvas(canvas, isLight);
      setAccentColor(ac);
      setAccentColorSolid(acs);
    } catch {
      setAccentColor(isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.12)");
      setAccentColorSolid(isLight ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)");
    }
  }, [isLight]);

  const [queueLimit, setQueueLimit] = useState(50);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumePopupStyle, setVolumePopupStyle] = useState<React.CSSProperties>(
    {},
  );
  const miniPlayerRootRef = useRef<HTMLDivElement>(null);
  const queuePopupRef = useRef<HTMLDivElement>(null);
  const volumePopupRef = useRef<HTMLDivElement>(null);
  const volumeToggleRef = useRef<HTMLButtonElement>(null);
  const volumeAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const currentTrack = player.currentTrack;
  const volumeLevel = toVolumeLevel(player.volume);
  const isLiked = useIsTrackLiked(currentTrack?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();
  const togglingRef = useRef(false);

  const handleLikeToggle = useCallback(() => {
    if (!currentTrack || togglingRef.current) return;
    togglingRef.current = true;
    const onSettled = () => {
      togglingRef.current = false;
    };
    if (isLiked) {
      unlikeMutation.mutate(currentTrack.id, { onSettled });
    } else {
      likeMutation.mutate(currentTrack.id, { onSettled });
    }
  }, [currentTrack, isLiked, likeMutation, unlikeMutation]);

  const durationMs =
    player.durationMs > 0
      ? player.durationMs
      : (player.currentTrack?.durationMs ?? 0);
  const progress =
    durationMs > 0
      ? Math.min(1, Math.max(0, player.positionMs / durationMs))
      : 0;

  const isPlaying = player.status === "playing";
  const isLoading = player.status === "loading";
  const trackTitle = player.currentTrack?.title ?? t("player.nothing_playing");
  const trackArtists =
    player.currentTrack?.artists ?? t("player.choose_track");

  const isCoverLoaded = useCoverReady(coverUrl);

  const queueItems = useMemo(() => {
    return player.queue.slice(0, queueLimit).map((item, index) => {
      const isCurrent = index === player.currentIndex;
      return (
        <SongCard
          key={`${item.id}-${index}`}
          title={item.title}
          artists={item.artists}
          artistId={item.artistId}
          artistList={item.artistList}
          coverUrl={item.coverUrl || ""}
          duration={
            item.durationMs
              ? `${Math.floor(item.durationMs / 60000)}:${Math.floor(
                  (item.durationMs % 60000) / 1000,
                )
                  .toString()
                  .padStart(2, "0")}`
              : undefined
          }
          onPlay={() => {
            void playerEngine.playTrack(
              item,
              player.queue,
              player.playbackContext,
              player.playbackContextCover,
              index,
            );
          }}
          className={`rounded-[12px] px-[8px] py-[10px] text-left transition-all duration-200 ${
            isCurrent
              ? "bg-border-alpha-14"
              : "bg-transparent hover:bg-border-alpha-14"
          }`}
        />
      );
    });
  }, [
    player.queue,
    queueLimit,
    player.currentIndex,
    player.playbackContext,
    player.playbackContextCover,
  ]);

  const repeatIcon = useMemo(() => {
    if (player.repeat === "one") {
      return <RepeatOne size={18} weight="Outline" />;
    }
    return <Repeat size={18} weight="Outline" />;
  }, [player.repeat]);

  const iconButtonClass =
    "inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:bg-bg-toolbox-active hover:text-text-primary active:scale-[0.96] border-none bg-transparent cursor-pointer";

  const clearVolumeAutoCloseTimer = useCallback(() => {
    if (volumeAutoCloseTimerRef.current) {
      clearTimeout(volumeAutoCloseTimerRef.current);
      volumeAutoCloseTimerRef.current = null;
    }
  }, []);

  const scheduleVolumeAutoClose = useCallback(() => {
    clearVolumeAutoCloseTimer();
    volumeAutoCloseTimerRef.current = setTimeout(() => {
      setVolumeOpen(false);
    }, 3000);
  }, [clearVolumeAutoCloseTimer]);

  useEffect(() => {
    if (!volumeOpen) {
      clearVolumeAutoCloseTimer();
      return;
    }
    scheduleVolumeAutoClose();
    return () => {
      clearVolumeAutoCloseTimer();
    };
  }, [clearVolumeAutoCloseTimer, scheduleVolumeAutoClose, volumeOpen]);

  useEffect(() => {
    if (!volumeOpen) return;
    const toggle = volumeToggleRef.current;
    const root = miniPlayerRootRef.current;
    if (!toggle || !root) return;
    const toggleRect = toggle.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const popupW = 176;
    const btnW = toggleRect.width;
    const right = rootRect.right - toggleRect.right + (btnW - popupW) / 2;
    setVolumePopupStyle({ right: Math.max(0, right) });
  }, [volumeOpen]);

  useEffect(() => {
    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (volumeOpen) {
        const clickedVolumePopup = volumePopupRef.current?.contains(target);
        const clickedVolumeToggle =
          volumeToggleRef.current?.contains(target);
        if (!clickedVolumePopup && !clickedVolumeToggle) {
          setVolumeOpen(false);
        } else {
          scheduleVolumeAutoClose();
        }
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onQueueOpenChange?.(false);
        setVolumeOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentPointerDown, true);
    document.addEventListener("keydown", onDocumentKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onDocumentPointerDown, true);
      document.removeEventListener("keydown", onDocumentKeyDown, true);
    };
  }, [onQueueOpenChange, scheduleVolumeAutoClose, volumeOpen]);

  const [scrubRatio, setScrubRatio] = useState<number | null>(null);
  const activeProgress = scrubRatio !== null ? scrubRatio : progress;

  return (
    <div
      ref={miniPlayerRootRef}
      className="relative h-[64px] w-full select-none"
    >
      <AnimatePresence>
        {volumeOpen ? (
          <motion.div
            key="volume-popup"
            ref={volumePopupRef}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-[74px] z-[92] w-[184px] rounded-xl bg-bg-primary border border-border-primary/50 shadow-xl px-[12px] py-[8px] prevent-seek"
            style={volumePopupStyle}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseEnter={clearVolumeAutoCloseTimer}
            onMouseMove={clearVolumeAutoCloseTimer}
            onMouseLeave={scheduleVolumeAutoClose}
            onMouseDown={scheduleVolumeAutoClose}
          >
            <VolumePicker
              size="sm"
              showValue
              trackClassName="bg-black/[0.10] dark:bg-white/[0.14]"
              fillClassName="bg-text-primary"
              iconClassName="text-text-secondary hover:text-text-primary"
              valueClassName="text-text-tertiary text-[11px]"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={`relative h-[64px] w-full overflow-hidden cursor-pointer ${
          usesRoundedStyle
            ? "rounded-full border-[0.5px] border-border-tertiary bg-bg-primary"
            : embedded
              ? "rounded-sm rounded-br-xl bg-bg-primary"
              : "rounded-3xl border-[0.5px] border-border-tertiary bg-bg-primary"
        }`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const target = e.target as Element | null;
          if (
            !target ||
            target.closest?.(
              "button, a, input, [role='button'], [role='slider'], .prevent-seek",
            )
          ) {
            return;
          }
          const card = e.currentTarget;
          const rect = card.getBoundingClientRect();
          if (!rect.width || !durationMs) return;

          const calcRatio = (clientX: number) =>
            Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

          const initialRatio = calcRatio(e.clientX);
          setScrubRatio(initialRatio);

          const onMove = (ev: PointerEvent) => {
            const r = calcRatio(ev.clientX);
            setScrubRatio(r);
          };

          const onUp = (ev: PointerEvent) => {
            const finalRatio = calcRatio(ev.clientX);
            setScrubRatio(null);
            playerEngine.seek(finalRatio * durationMs);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
        }}
      >
        {usesBackgroundProgress && (
          <div
            className="absolute inset-y-0 left-0 z-0 pointer-events-none"
            style={{
              backgroundColor: accentColor,
              width: `${activeProgress * 100}%`,
              willChange: "width",
              transition:
                scrubRatio !== null
                  ? "none"
                  : "width 200ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        )}

        {embedded ? null : (
          <div
            className={`absolute z-30 prevent-seek ${
              usesRoundedStyle
                ? "left-[18px] right-[18px] bottom-[2px]"
                : "left-[8px] right-[8px] bottom-[2px]"
            }`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TimelineSlider
              positionMs={player.positionMs}
              durationMs={durationMs}
              onSeek={(pos) => playerEngine.seek(pos)}
              size="xs"
              fillColor={accentColorSolid || undefined}
              fillClassName={!accentColorSolid ? (isLight ? "bg-text-primary" : "bg-white") : undefined}
              trackBg={isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.15)"}
              trackActiveBg={isLight ? "rgba(0, 0, 0, 0.16)" : "rgba(255, 255, 255, 0.32)"}
              className="!h-[14px]"
            />
          </div>
        )}
        <div
          className={`relative grid h-full ${
            embedded
              ? "grid-cols-[280px_minmax(0,1fr)_260px]"
              : "grid-cols-[286px_minmax(0,1fr)]"
          } ${!usesRoundedStyle && !embedded ? "pb-[4px]" : ""}`}
        >
          <div
            className="flex h-full items-center gap-[16px] px-[18px] pt-[1px] prevent-seek cursor-default"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="Open player"
              className={`relative h-[38px] w-[38px] shrink-0 overflow-hidden rounded-[8px] bg-bg-elevated cursor-pointer prevent-seek ${
                !isCoverLoaded ? "animate-pulse" : ""
              }`}
              onClick={onFullscreenOpen}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <CoverImage
                key={coverUrl}
                src={coverUrl}
                alt="Track artwork"
                width={38}
                height={38}
                priority
                draggable={false}
                onLoad={(e) => {
                  extractAccentColor(e.currentTarget as HTMLImageElement);
                }}
                className={`h-[38px] w-[38px] object-cover transition-opacity duration-300 ease-out ${
                  isCoverLoaded ? "opacity-100" : "opacity-0"
                } rounded-[8px]`}
              />
            </div>
            <div className="flex min-w-0 flex-col prevent-seek">
              <p
                className="m-0 truncate text-[16px] font-[400] text-text-primary flex items-center gap-[6px]"
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                  lineHeight: "18px",
                  letterSpacing: "0",
                }}
              >
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Open player"
                  className="min-w-0 truncate cursor-pointer"
                  onClick={onFullscreenOpen}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onFullscreenOpen?.();
                    }
                  }}
                >
                  {trackTitle}
                </span>
              </p>
              <p
                className="m-0 mt-[4px] flex min-w-0 items-center gap-[5px] text-[13px] font-[300] text-text-tertiary"
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                  lineHeight: "15px",
                }}
              >
                {player.currentTrack?.explicit && <ExplicitBadge />}
                <ArtistLink
                  name={trackArtists}
                  artistId={player.currentTrack?.artistId}
                  artistList={player.currentTrack?.artistList}
                  className="text-text-tertiary"
                />
              </p>
            </div>
            <button
              type="button"
              aria-label={isLiked ? "Unlike" : "Like"}
              className={`${iconButtonClass} shrink-0 transition-colors duration-150 prevent-seek ${
                isLiked ? "text-[#ff4d4d]" : "text-text-secondary"
              }`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleLikeToggle}
              style={{ cursor: "pointer" }}
            >
              {isLiked ? <HeartFill size={20} /> : <HeartLine size={20} />}
            </button>
          </div>

          <div
            className={`flex h-full items-center pl-[10px] pr-[18px] ${
              embedded ? "col-start-3" : ""
            }`}
          >
            <div
              className="ml-auto flex items-center gap-[2px] rounded-lg bg-bg-toolbox p-[3px] prevent-seek cursor-default"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Shuffle"
                title={player.shuffle ? t("player.shuffle_on") : t("player.shuffle_off")}
                className={`${iconButtonClass} ${
                  player.shuffle
                    ? "bg-bg-toolbox-active text-text-primary"
                    : ""
                }`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => playerEngine.setShuffle(!player.shuffle)}
              >
                <Shuffle size={18} weight={player.shuffle ? "Bold" : "Outline"} />
              </button>
              <button
                type="button"
                aria-label="Repeat"
                title="Repeat"
                className={`${iconButtonClass} ${
                  player.repeat !== "off"
                    ? "bg-bg-toolbox-active text-text-primary"
                    : ""
                }`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() =>
                  playerEngine.setRepeat(
                    player.repeat === "one" ? "off" : "one",
                  )
                }
              >
                {repeatIcon}
              </button>
              <button
                ref={volumeToggleRef}
                type="button"
                aria-label="Volume"
                title="Volume"
                className={`${iconButtonClass} ${
                  volumeOpen
                    ? "bg-bg-toolbox-active text-text-primary"
                    : ""
                }`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onQueueOpenChange?.(false);
                  setVolumeOpen((prev) => !prev);
                  scheduleVolumeAutoClose();
                }}
                style={{ cursor: "pointer" }}
              >
                {volumeLevel === 0 ? (
                  <VolumeCross size={20} />
                ) : volumeLevel < 0.33 ? (
                  <VolumeSmall size={20} />
                ) : (
                  <VolumeLoud size={20} />
                )}
              </button>
              <button
                type="button"
                aria-label="Open player"
                title="Open player"
                className={iconButtonClass}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onFullscreenOpen}
              >
                <MaximizeSquare3 size={18} weight="Outline" />
              </button>
              <span
                className="mx-[3px] h-[16px] w-px bg-border-toolbox-divider"
                aria-hidden="true"
              />
              <button
                type="button"
                aria-label="Queue"
                title="Queue"
                className={iconButtonClass}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setVolumeOpen(false);
                  setQueueLimit(50);
                  onQueueToggle?.();
                }}
                style={{ cursor: "pointer" }}
              >
                <Sidebar size={20} weight="Bold" />
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="pointer-events-auto flex items-center gap-[8px] prevent-seek cursor-default"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Previous track"
              className={`${iconButtonClass} text-text-secondary`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                void playerEngine.skipPrevious();
              }}
              style={{ cursor: "pointer" }}
            >
              <SkipPrevious size={18} weight="Bold" />
            </button>
            <button
              type="button"
              aria-label={isPlaying ? "Pause" : "Play"}
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-btn-primary-bg text-btn-primary-text transition-all duration-150 ease-out active:scale-[0.96] border-none cursor-pointer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                void playerEngine.togglePlayPause();
              }}
              style={{ cursor: "pointer" }}
            >
              {isLoading ? (
                <span
                  className="h-[16px] w-[16px] animate-spin rounded-full border-[2px] border-current border-t-transparent"
                  aria-label="Loading playback"
                />
              ) : isPlaying ? (
                <Pause size={16} weight="Bold" />
              ) : (
                <Play size={16} weight="Bold" />
              )}
            </button>
            <button
              type="button"
              aria-label="Next track"
              className={`${iconButtonClass} text-text-secondary`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                void playerEngine.skipNext();
              }}
              style={{ cursor: "pointer" }}
            >
              <SkipNext size={18} weight="Bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MiniPlayer);
