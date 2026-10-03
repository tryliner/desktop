import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipNext,
  SkipPrevious,
  VolumeCross,
  VolumeSmall,
  VolumeLoud,
  MaximizeSquare3,
} from "@solar-icons/react";
import { HeartFill, HeartLine } from "@mingcute/react";
import { toVolumeLevel, toVolumeGain } from "@/features/player/engine/volume";
import { useDisableButtonFocus } from "@/features/navigation/hooks/useDisableButtonFocus";
import type {
  TouchBarAction,
  TouchBarStatePayload,
  TouchBarActiveLine,
  TouchBarWordData,
} from "../contracts";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function generateWaveform(seed: string, count = 52): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = i / count;
    const wave1 = Math.sin(x * Math.PI * 4 + hash);
    const wave2 = Math.cos(x * Math.PI * 10 + hash * 0.4);
    const wave3 = Math.sin(x * Math.PI * 18 + hash * 0.8);
    const raw = 0.35 + 0.32 * Math.abs(wave1) + 0.18 * Math.abs(wave2) + 0.15 * Math.abs(wave3);
    result.push(Math.max(0.2, Math.min(0.95, raw)));
  }
  return result;
}

function VolumeIcon({ percent, size = 13 }: { percent: number; size?: number }) {
  if (percent === 0) {
    return <VolumeCross size={size} weight="Bold" />;
  }
  if (percent < 45) {
    return <VolumeSmall size={size} weight="Bold" />;
  }
  return <VolumeLoud size={size} weight="Bold" />;
}

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

function extractCoverColor(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 24, 24);
    const data = ctx.getImageData(0, 0, 24, 24).data;

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

    const finalR = Math.round(totalWeight > 0.5 ? weightedR / totalWeight : totalR / count);
    const finalG = Math.round(totalWeight > 0.5 ? weightedG / totalWeight : totalG / count);
    const finalB = Math.round(totalWeight > 0.5 ? weightedB / totalWeight : totalB / count);

    const [h, s, l] = rgbToHsl(finalR, finalG, finalB);
    if (s < 0.1) {
      return "#ffffff";
    }
    const solidL = Math.max(0.55, Math.min(0.78, l < 0.4 ? 0.65 : l));
    const solidS = Math.max(0.70, s);
    const [solidR, solidG, solidB] = hslToRgb(h, solidS, solidL);
    return `rgb(${solidR}, ${solidG}, ${solidB})`;
  } catch {
    return null;
  }
}

export function TouchBarSimulator() {
  useDisableButtonFocus();

  const containerRef = useRef<HTMLDivElement>(null);
  const leftControlsRef = useRef<HTMLDivElement>(null);

  const [containerHeight, setContainerHeight] = useState(() => {
    if (typeof window !== "undefined" && window.innerHeight > 0) {
      return Math.round(window.innerHeight);
    }
    return 24;
  });

  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth > 0) {
      return Math.round(window.innerWidth);
    }
    return 960;
  });

  const [leftControlsWidth, setLeftControlsWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateDimensions = () => {
      const h = el.clientHeight || el.getBoundingClientRect().height;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (h > 0) {
        setContainerHeight(Math.round(h));
      }
      if (w > 0) {
        setContainerWidth(Math.round(w));
      }
    };
    updateDimensions();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        const w = entry.contentRect.width;
        if (h > 0) {
          setContainerHeight(Math.round(h));
        }
        if (w > 0) {
          setContainerWidth(Math.round(w));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = Math.max(0.6, Math.min(3, containerHeight / 24));
  const iconSize = Math.round(13 * scale);
  const volumeIconSize = Math.round(14 * scale);
  const volumeSliderIconSize = Math.round(15.5 * scale);
  const buttonRadius = `${Math.round(6 * scale)}px`;
  const minTimelineWidth = Math.round(180 * scale);
  const fullThumbSize = Math.max(16, Math.round(containerHeight - 6 * scale));

  const [state, setState] = useState<TouchBarStatePayload>({
    status: "idle",
    track: null,
    positionMs: 0,
    durationMs: 0,
    volume: 1,
    isLiked: false,
    shuffle: false,
    repeat: "off",
    activeLine: null,
    activeLyricText: "",
    nextLyricText: "",
    offsetMs: 0,
    currentRoute: "/",
    isFullscreen: false,
  });

  useEffect(() => {
    const el = leftControlsRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setLeftControlsWidth(Math.round(w));
    };
    update();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setLeftControlsWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.track?.title, state.track?.artist, scale]);

  const [coverAccentColor, setCoverAccentColor] = useState<string>("#0a84ff");

  useEffect(() => {
    if (!state.track?.cover) {
      setCoverAccentColor("#0a84ff");
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!active) return;
      const color = extractCoverColor(img);
      if (color) {
        setCoverAccentColor(color);
      }
    };
    img.src = state.track.cover;
    return () => {
      active = false;
    };
  }, [state.track?.cover]);

  const [isSeeking, setIsSeeking] = useState(false);
  const [localSeekMs, setLocalSeekMs] = useState(0);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);
  const lastNonZeroVolumeRef = useRef<number>(0.7);

  const maxVolumePillWidth = Math.max(
    Math.round(130 * scale),
    Math.min(
      Math.round(260 * scale),
      containerWidth - (leftControlsWidth || Math.round(280 * scale)) - containerHeight - Math.round(36 * scale)
    )
  );
  const volumePillWidth = Math.round(maxVolumePillWidth);
  const estimatedExpandedVolumeWidth = containerHeight + volumePillWidth;
  const effectiveLeftWidth = leftControlsWidth || Math.round(280 * scale);
  const availableCenterWidthWhenVolumeOpen =
    containerWidth - effectiveLeftWidth - estimatedExpandedVolumeWidth - Math.round(16 * scale);
  const isTimelineHidden = isVolumeOpen && availableCenterWidthWhenVolumeOpen < minTimelineWidth;

  useEffect(() => {
    if (!window.linerElectron?.onTouchBarSimulatorState) return;
    const cleanup = window.linerElectron.onTouchBarSimulatorState((newState) => {
      setState(newState);
    });
    return cleanup;
  }, []);

  const sendAction = useCallback((action: TouchBarAction) => {
    window.linerElectron?.sendTouchBarAction?.(action);
  }, []);

  const isPlaying = state.status === "playing";
  const durationMs = state.durationMs || state.track?.durationMs || 1;
  const currentPosMs = isSeeking ? localSeekMs : state.positionMs;
  const progressRatio = Math.min(1, Math.max(0, currentPosMs / durationMs));
  const isTimelineTouched = isSeeking;
  const activeTimelineRatio = progressRatio;
  const activeTimelineMs = currentPosMs;
  const isNearRightEdge = activeTimelineRatio > 0.8;

  const [waveformWidth, setWaveformWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const updateWaveformWidth = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0) {
      setWaveformWidth(Math.round(rect.width));
    }
  }, []);

  const setWaveformRef = useCallback(
    (node: HTMLDivElement | null) => {
      waveformRef.current = node;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (node) {
        updateWaveformWidth(node);
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = entry.contentRect.width;
            if (width > 0) {
              setWaveformWidth(Math.round(width));
            }
          }
        });
        observer.observe(node);
        observerRef.current = observer;
      }
    },
    [updateWaveformWidth]
  );

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) setContainerWidth(Math.round(rect.width));
        if (rect.height > 0) setContainerHeight(Math.round(rect.height));
      }
      if (waveformRef.current) {
        updateWaveformWidth(waveformRef.current);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateWaveformWidth]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  const effectiveWidth =
    waveformWidth > 0
      ? waveformWidth
      : typeof window !== "undefined"
      ? Math.max(minTimelineWidth, window.innerWidth - 260)
      : minTimelineWidth;

  const barSlotWidth = Math.max(3, Math.round(5 * scale));
  const padding = Math.round(16 * scale);
  const barsCount = Math.max(16, Math.floor((effectiveWidth - padding) / barSlotWidth));
  const waveformSeed = state.track ? `${state.track.id || state.track.title}-${durationMs}` : "default";
  const waveformBars = useMemo(
    () => generateWaveform(waveformSeed, barsCount),
    [waveformSeed, barsCount]
  );

  const handleWaveformPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const waveformPad = Math.round(8 * scale);
    const trackWidth = Math.max(1, rect.width - waveformPad * 2);
    const getMsFromClientX = (clientX: number) => {
      const x = clientX - rect.left - waveformPad;
      const ratio = Math.max(0, Math.min(1, x / trackWidth));
      return ratio * durationMs;
    };

    const startClientX = e.clientX;
    const initialMs = getMsFromClientX(startClientX);
    let isDragSeeking = false;

    const startSeeking = (targetMs: number) => {
      if (isDragSeeking) return;
      isDragSeeking = true;
      setIsSeeking(true);
      setLocalSeekMs(targetMs);
    };

    const holdTimer = window.setTimeout(() => {
      startSeeking(initialMs);
    }, 120);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentMs = getMsFromClientX(moveEvent.clientX);
      if (!isDragSeeking) {
        if (Math.abs(moveEvent.clientX - startClientX) > 3) {
          window.clearTimeout(holdTimer);
          startSeeking(currentMs);
        }
      } else {
        setLocalSeekMs(currentMs);
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.clearTimeout(holdTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      const finalMs = getMsFromClientX(upEvent.clientX);
      if (isDragSeeking) {
        setIsSeeking(false);
        sendAction({ type: "seek", payload: { positionMs: finalMs } });
      } else {
        anchorPosRef.current = finalMs;
        anchorTimeRef.current = performance.now();
        setState((prev) => ({ ...prev, positionMs: finalMs }));
        sendAction({ type: "seek", payload: { positionMs: finalMs } });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const lastActiveLineRef = useRef<TouchBarActiveLine | null>(null);
  const lastActiveLyricTextRef = useRef<string>("");
  const currentTrackId = state.track?.id;
  const prevTrackIdRef = useRef<string | undefined>(currentTrackId);
  if (prevTrackIdRef.current !== currentTrackId) {
    prevTrackIdRef.current = currentTrackId;
    lastActiveLineRef.current = null;
    lastActiveLyricTextRef.current = "";
  }

  if (state.activeLine) {
    lastActiveLineRef.current = state.activeLine;
    lastActiveLyricTextRef.current = state.activeLine.text;
  } else if (state.activeLyricText) {
    lastActiveLyricTextRef.current = state.activeLyricText;
  }

  const anchorPosRef = useRef(state.positionMs);
  const anchorTimeRef = useRef(performance.now());
  const wordSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    anchorPosRef.current = state.positionMs;
    anchorTimeRef.current = performance.now();
  }, [state.positionMs, state.status]);

  const displayLine = state.activeLine || lastActiveLineRef.current;
  const displayLineText =
    state.activeLine?.text ||
    state.activeLyricText ||
    lastActiveLyricTextRef.current ||
    state.nextLyricText ||
    "•••";

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const isPlaying = state.status === "playing";
      const now = performance.now();
      const currentPos = isSeeking
        ? localSeekMs
        : isPlaying
          ? anchorPosRef.current + (now - anchorTimeRef.current)
          : state.positionMs;

      const effectiveTime = currentPos;

      const words = displayLine?.words;
      if (words && words.length > 0) {
        for (let i = 0; i < words.length; i++) {
          const span = wordSpanRefs.current[i];
          if (!span) continue;
          const w = words[i];

          const timedDuration = Math.max(120, w.endMs - w.timeMs);
          const swipeDuration = timedDuration * 1.6;
          const swipeLead = timedDuration * 0.1;
          const elapsed = effectiveTime - (w.timeMs - swipeLead);
          let startPct = -20;
          let endPct = -10;

          if (w.endMs <= w.timeMs) {
            if (effectiveTime >= w.timeMs) {
              startPct = 140;
              endPct = 150;
            }
          } else if (elapsed <= 0) {
            startPct = -20;
            endPct = -10;
          } else if (elapsed >= swipeDuration) {
            startPct = 140;
            endPct = 150;
          } else {
            const t = elapsed / swipeDuration;
            startPct = (-0.2 + t * 1.6) * 100;
            endPct = (-0.1 + t * 1.6) * 100;
          }

          const bg = `linear-gradient(90deg, #ffffff ${startPct.toFixed(1)}%, #636366 ${endPct.toFixed(1)}%)`;
          if (span.style.backgroundImage !== bg) {
            span.style.backgroundImage = bg;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [state.status, state.positionMs, state.offsetMs, isSeeking, localSeekMs, displayLine]);

  const [localVolumeLevel, setLocalVolumeLevel] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  useEffect(() => {
    if (!isDraggingVolume) return;
    const handleUp = () => {
      setIsDraggingVolume(false);
      setLocalVolumeLevel(null);
    };
    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, [isDraggingVolume]);

  const baseVolumeLevel = toVolumeLevel(state.volume);
  const activeVolumeLevel =
    isDraggingVolume && localVolumeLevel !== null ? localVolumeLevel : baseVolumeLevel;
  const activeVolumePercent = Math.round(activeVolumeLevel * 100);

  const handleToggleMute = useCallback(() => {
    if (activeVolumeLevel > 0) {
      lastNonZeroVolumeRef.current = activeVolumeLevel;
      setLocalVolumeLevel(0);
      sendAction({ type: "volume", payload: { volume: 0 } });
    } else {
      const restoreLevel = lastNonZeroVolumeRef.current || 0.7;
      setLocalVolumeLevel(restoreLevel);
      sendAction({
        type: "volume",
        payload: { volume: toVolumeGain(restoreLevel) },
      });
    }
  }, [activeVolumeLevel, sendAction]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full select-none items-center justify-between bg-black text-white antialiased overflow-hidden"
      style={{
        paddingLeft: `${Math.round(4 * scale)}px`,
        paddingRight: `${Math.round(4 * scale)}px`,
      }}
    >
      <div
        ref={leftControlsRef}
        className="flex h-full items-center shrink-0"
        style={{
          WebkitAppRegion: "no-drag",
          gap: `${Math.round(6 * scale)}px`,
        } as React.CSSProperties}
      >
        <div
          className="flex h-full cursor-grab items-center justify-center text-[#38383a] hover:text-[#8e8e93] active:cursor-grabbing"
          style={{
            WebkitAppRegion: "drag",
            width: `${Math.round(10 * scale)}px`,
          } as React.CSSProperties}
        >
          <span
            className="leading-none select-none"
            style={{ fontSize: `${Math.round(10 * scale)}px` }}
          >
            ⠿
          </span>
        </div>

        <div
          className="flex h-full items-center pl-0.5"
          style={{
            gap: `${Math.round(8 * scale)}px`,
            paddingRight: `${Math.round(4 * scale)}px`,
          }}
        >
          {state.track?.cover ? (
            <img
              src={state.track.cover}
              alt=""
              crossOrigin="anonymous"
              onLoad={(e) => {
                const color = extractCoverColor(e.currentTarget);
                if (color) {
                  setCoverAccentColor(color);
                }
              }}
              className="h-full aspect-square shrink-0 object-cover ring-1 ring-white/10"
              style={{ borderRadius: `${Math.round(5 * scale)}px` }}
            />
          ) : (
            <div
              className="flex h-full aspect-square shrink-0 items-center justify-center bg-[#1c1c1e] text-[#8e8e93]"
              style={{
                borderRadius: `${Math.round(5 * scale)}px`,
                fontSize: `${Math.round(10 * scale)}px`,
              }}
            >
              ♪
            </div>
          )}
          <div
            className="min-w-0 leading-tight"
            style={{ maxWidth: `${Math.round(100 * scale)}px` }}
          >
            <p
              className="truncate font-medium text-white tracking-tight"
              style={{ fontSize: `${(11 * scale).toFixed(1)}px` }}
            >
              {state.track?.title || "No track"}
            </p>
            <p
              className="truncate text-[#8e8e93]"
              style={{ fontSize: `${(9.5 * scale).toFixed(1)}px` }}
            >
              {state.track?.artist || "Liner"}
            </p>
          </div>
        </div>

        <div
          className="flex h-full items-center"
          style={{ gap: `${Math.round(4 * scale)}px` }}
        >
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => sendAction({ type: "prev" })}
            className="flex h-full aspect-square items-center justify-center bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            style={{ borderRadius: buttonRadius }}
          >
            <SkipPrevious size={iconSize} weight="Bold" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => sendAction({ type: "togglePlay" })}
            className="flex h-full aspect-square items-center justify-center bg-[#1c1c1e] text-white hover:bg-[#2c2c2e] active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            style={{ borderRadius: buttonRadius }}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <span
                className="flex items-center justify-center"
                style={{ transform: `translateX(${(-0.1 * scale).toFixed(2)}px)` }}
              >
                <Pause size={iconSize} weight="Bold" />
              </span>
            ) : (
              <span
                className="flex items-center justify-center"
                style={{ transform: `translateX(${(-0.5 * scale).toFixed(2)}px)` }}
              >
                <Play size={iconSize} weight="Bold" />
              </span>
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => sendAction({ type: "next" })}
            className="flex h-full aspect-square items-center justify-center bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            style={{ borderRadius: buttonRadius }}
          >
            <SkipNext size={iconSize} weight="Bold" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isTimelineHidden && (
          <motion.div
            key="center-timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="relative flex h-full flex-1 items-center justify-center overflow-hidden"
            style={{
              minWidth: `${minTimelineWidth}px`,
              marginLeft: `${Math.round(6 * scale)}px`,
              marginRight: `${Math.round(6 * scale)}px`,
              WebkitAppRegion: "no-drag",
            } as React.CSSProperties}
          >
            {state.isFullscreen ? (
              <div
                onClick={() => sendAction({ type: "toggleFullscreen" })}
                className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden text-center"
              >
                <div
                  className="relative flex items-center justify-center w-full"
                  style={{ minHeight: `${Math.round(14 * scale)}px` }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={displayLine?.timeMs !== undefined ? `${displayLine.timeMs}-${displayLine.text}` : displayLineText}
                      initial={{ y: 13 * scale, scale: 0.82, opacity: 0.6 }}
                      animate={{ y: 0, scale: 1, opacity: 1 }}
                      exit={{ y: -13 * scale, scale: 0.96, opacity: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className="flex max-w-full items-center justify-center px-2 text-center origin-center"
                      style={{ gap: `${Math.round(4 * scale)}px` }}
                    >
                      {displayLine?.words && displayLine.words.length > 0 ? (
                        displayLine.words.map((w: TouchBarWordData, idx: number) => {
                          return (
                            <span
                              key={`${w.timeMs}-${idx}`}
                              ref={(el) => {
                                if (el) {
                                  wordSpanRefs.current[idx] = el;
                                }
                              }}
                              className="bg-clip-text text-transparent font-medium inline"
                              style={{
                                backgroundImage: "linear-gradient(90deg, #ffffff -20%, #636366 -10%)",
                                fontSize: `${(11 * scale).toFixed(1)}px`,
                                lineHeight: `${(13.5 * scale).toFixed(1)}px`,
                              }}
                            >
                              {w.text.trim()}
                            </span>
                          );
                        })
                      ) : (
                        <motion.span
                          initial={{ color: "#636366" }}
                          animate={{ color: currentPosMs >= (displayLine?.timeMs ?? 0) ? "#ffffff" : "#636366" }}
                          transition={{ duration: 0.32, ease: "easeOut" }}
                          className="font-medium truncate max-w-full"
                          style={{
                            fontSize: `${(11 * scale).toFixed(1)}px`,
                            lineHeight: `${(13.5 * scale).toFixed(1)}px`,
                          }}
                        >
                          {displayLineText}
                        </motion.span>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div
                  className="relative flex items-center justify-center w-full overflow-hidden"
                  style={{
                    minHeight: `${Math.round(10 * scale)}px`,
                    transform: `translateY(${(-1.0 * scale).toFixed(1)}px)`,
                  }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {state.nextLyricText && state.nextLyricText !== displayLineText && (
                      <motion.p
                        key={state.nextLyricText}
                        initial={{ y: 8 * scale, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -8 * scale, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="max-w-full truncate text-[#636366] pb-[2px]"
                        style={{
                          fontSize: `${(8.5 * scale).toFixed(1)}px`,
                          lineHeight: `${(10.5 * scale).toFixed(1)}px`,
                        }}
                      >
                        {state.nextLyricText}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div
                className="flex h-full w-full items-center px-0.5"
                style={{ gap: `${Math.round(6 * scale)}px` }}
              >
                <span
                  className="shrink-0 font-mono tabular-nums text-[#8e8e93] text-right"
                  style={{
                    width: `${Math.round(28 * scale)}px`,
                    fontSize: `${(9.5 * scale).toFixed(1)}px`,
                  }}
                >
                  {formatTime(currentPosMs)}
                </span>

                <div
                  ref={setWaveformRef}
                  onPointerDown={handleWaveformPointerDown}
                  className="relative flex h-full flex-1 min-w-[60px] cursor-pointer items-center bg-[#161618] hover:bg-[#19191c] transition-colors overflow-hidden select-none py-1"
                  style={{ borderRadius: buttonRadius }}
                >
                  <div
                    className="absolute flex items-center"
                    style={{
                      left: `${Math.round(8 * scale)}px`,
                      right: `${Math.round(8 * scale)}px`,
                      top: `${Math.round(4 * scale)}px`,
                      bottom: `${Math.round(4 * scale)}px`,
                    }}
                  >
                    {waveformBars.map((heightRatio, i) => {
                      const barRatio = i / (waveformBars.length - 1);
                      const isPlayed = barRatio <= activeTimelineRatio;
                      const pixelHeight = Math.max(3, Math.round(heightRatio * 18 * scale));

                      return (
                        <div
                          key={i}
                          style={{
                            left: `${barRatio * 100}%`,
                            height: `${pixelHeight}px`,
                            width: `${Math.max(2, Math.round(2 * scale))}px`,
                          }}
                          className={`absolute -translate-x-1/2 rounded-full transition-colors duration-75 ${
                            isPlayed ? "bg-white" : "bg-[#333336]"
                          }`}
                        />
                      );
                    })}

                    <div
                      className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-10"
                      style={{
                        left: `${activeTimelineRatio * 100}%`,
                      }}
                    >
                      <motion.div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7),0_1px_3px_rgba(0,0,0,0.6)]"
                        animate={{
                          width: isSeeking ? fullThumbSize : Math.max(2, Math.round(2.5 * scale)),
                          height: isSeeking ? fullThumbSize : Math.round(14 * scale),
                          borderRadius: isSeeking ? Math.round(4 * scale) : Math.round(2 * scale),
                        }}
                        transition={{
                          duration: 0.14,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      />

                      <AnimatePresence>
                        {isSeeking && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85, x: isNearRightEdge ? 4 * scale : -4 * scale }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.85, x: isNearRightEdge ? 4 * scale : -4 * scale }}
                            transition={{ duration: 0.14, ease: "easeOut" }}
                            className="absolute top-1/2 -translate-y-1/2 z-20 flex items-center"
                            style={{
                              [isNearRightEdge ? "right" : "left"]: `${Math.round(fullThumbSize / 2 + 4 * scale)}px`,
                            }}
                          >
                            <div
                              className="flex items-center bg-[#1c1c1e]/95 shadow-[0_2px_8px_rgba(0,0,0,0.8)] backdrop-blur-md"
                              style={{
                                borderRadius: `${Math.round(4 * scale)}px`,
                                padding: `${Math.max(1, Math.round(2 * scale))}px ${Math.round(6 * scale)}px`,
                              }}
                            >
                              <span
                                className="font-mono font-bold text-white tracking-tight leading-none whitespace-nowrap tabular-nums"
                                style={{ fontSize: `${(9 * scale).toFixed(1)}px` }}
                              >
                                {formatTime(activeTimelineMs)}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <span
                  className="shrink-0 font-mono tabular-nums text-[#8e8e93] text-left"
                  style={{
                    width: `${Math.round(28 * scale)}px`,
                    fontSize: `${(9.5 * scale).toFixed(1)}px`,
                  }}
                >
                  {formatTime(durationMs)}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex h-full items-center pl-0.5 shrink-0 justify-end overflow-hidden origin-right"
        style={{
          WebkitAppRegion: "no-drag",
          gap: `${Math.round(4 * scale)}px`,
        } as React.CSSProperties}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isVolumeOpen ? (
            <motion.div
              key="expanded-volume"
              initial={{ opacity: 0, x: 10 * scale }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 * scale }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full items-center justify-end origin-right"
              style={{ gap: `${Math.round(6 * scale)}px` }}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsVolumeOpen(false)}
                className="flex h-full aspect-square shrink-0 items-center justify-center bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                style={{ borderRadius: buttonRadius }}
                title="Close"
              >
                <span
                  className="flex items-center justify-center"
                  style={{ transform: `translateX(${(-0.4 * scale).toFixed(2)}px)` }}
                >
                  <svg
                    width={Math.round(13 * scale)}
                    height={Math.round(13 * scale)}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="block"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              </button>

              <motion.div
                initial={{ width: Math.round(100 * scale), opacity: 0 }}
                animate={{ width: volumePillWidth, opacity: 1 }}
                exit={{ width: Math.round(100 * scale), opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full items-center bg-[#1c1c1e] overflow-hidden origin-right shrink-0"
                style={{
                  borderRadius: buttonRadius,
                  paddingLeft: `${Math.round(10 * scale)}px`,
                  paddingRight: `${Math.round(12 * scale)}px`,
                  gap: `${Math.round(7 * scale)}px`,
                }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleToggleMute}
                  className="flex h-full aspect-square shrink-0 items-center justify-center text-[#8e8e93] hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                  title={activeVolumePercent === 0 ? "Unmute" : "Mute"}
                >
                  <VolumeIcon percent={activeVolumePercent} size={volumeSliderIconSize} />
                </button>

                <div className="relative flex flex-1 items-center h-full min-w-0">
                  <div
                    className="relative w-full bg-[#2c2c2e] overflow-hidden my-auto"
                    style={{
                      height: `${Math.max(3, Math.round(4 * scale))}px`,
                      borderRadius: `${Math.round(2 * scale)}px`,
                    }}
                  >
                    <div
                      className={`h-full ${
                        isDraggingVolume ? "" : "transition-all duration-150 ease-out"
                      }`}
                      style={{
                        width: `${activeVolumePercent}%`,
                        backgroundColor: coverAccentColor,
                        borderRadius: `${Math.round(2 * scale)}px`,
                      }}
                    />
                  </div>
                  <div
                    className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white ${
                      isDraggingVolume
                        ? "shadow-[0_0_8px_rgba(255,255,255,0.7),0_1px_3px_rgba(0,0,0,0.6)]"
                        : "shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                    } ${isDraggingVolume ? "" : "transition-all duration-150 ease-out"}`}
                    style={{
                      left: `${activeVolumePercent}%`,
                      width: isDraggingVolume ? `${fullThumbSize}px` : `${Math.round(12 * scale)}px`,
                      height: isDraggingVolume ? `${fullThumbSize}px` : `${Math.round(12 * scale)}px`,
                      borderRadius: isDraggingVolume ? `${Math.round(4 * scale)}px` : `${Math.round(3.5 * scale)}px`,
                    }}
                  />
                  <input
                    type="range"
                    tabIndex={-1}
                    min={0}
                    max={1}
                    step={0.01}
                    value={activeVolumeLevel}
                    onPointerDown={() => setIsDraggingVolume(true)}
                    onPointerUp={() => {
                      setIsDraggingVolume(false);
                      setLocalVolumeLevel(null);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLocalVolumeLevel(val);
                      sendAction({
                        type: "volume",
                        payload: { volume: toVolumeGain(val) },
                      });
                    }}
                    className="absolute inset-0 h-full w-full opacity-0 cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                  />
                </div>

                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setLocalVolumeLevel(1);
                    sendAction({ type: "volume", payload: { volume: 1 } });
                  }}
                  className="flex h-full aspect-square shrink-0 items-center justify-center text-[#8e8e93] hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                  title="Full volume"
                >
                  <VolumeLoud size={volumeSliderIconSize} />
                </button>

                <span
                  className="shrink-0 font-mono tabular-nums text-[#8e8e93] text-right select-none leading-none flex items-center justify-end h-full"
                  style={{
                    width: `${Math.round(26 * scale)}px`,
                    fontSize: `${(9.5 * scale).toFixed(1)}px`,
                  }}
                >
                  {activeVolumePercent}%
                </span>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="compact-controls"
              initial={{ opacity: 0, x: 6 * scale }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 * scale }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full items-center origin-right"
              style={{ gap: `${Math.round(4 * scale)}px` }}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => sendAction({ type: "like" })}
                className={`flex h-full aspect-square items-center justify-center bg-[#1c1c1e] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                  state.isLiked
                    ? "text-red-500 hover:text-red-400"
                    : "text-[#8e8e93] hover:text-white"
                }`}
                style={{ borderRadius: buttonRadius }}
                title={state.isLiked ? "Unlike" : "Like"}
              >
                {state.isLiked ? (
                  <span
                    className="flex items-center justify-center"
                    style={{ transform: `translateX(${(-0.1 * scale).toFixed(2)}px)` }}
                  >
                    <HeartFill size={iconSize} />
                  </span>
                ) : (
                  <span
                    className="flex items-center justify-center"
                    style={{ transform: `translateX(${(-0.1 * scale).toFixed(2)}px)` }}
                  >
                    <HeartLine size={iconSize} />
                  </span>
                )}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsVolumeOpen(true)}
                className="flex h-full aspect-square items-center justify-center bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                style={{ borderRadius: buttonRadius }}
                title="Volume"
              >
                <VolumeIcon percent={activeVolumePercent} size={volumeIconSize} />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => sendAction({ type: "toggleFullscreen" })}
                className={`flex h-full aspect-square items-center justify-center transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                  state.isFullscreen
                    ? "bg-white text-black hover:bg-[#e5e5ea]"
                    : "bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c]"
                }`}
                style={{ borderRadius: buttonRadius }}
                title="Fullscreen / Lyrics"
              >
                <MaximizeSquare3 size={iconSize} weight="Bold" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TouchBarSimulator;
