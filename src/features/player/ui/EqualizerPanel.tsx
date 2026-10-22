import { memo, useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui";
import {
  EQ_BAND_COUNT,
  EQ_FREQUENCIES,
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESET_IDS,
  EQ_STEP_DB,
  autoPreampDb,
  clampBandDb,
  formatBandFrequency,
  formatDb,
  isFlat,
  logFrequencies,
  presetForBands,
  responseDb,
  type EqPresetId,
} from "../engine/eqMath";

// Same visual language as the speed & pitch menu: text-primary fills, soft
// translucent tracks, spring thumbs, no borders.

const GRAPH_HEIGHT = 148;
const CURVE_POINTS = logFrequencies(120, 20, 20000);
const LOG_MIN = Math.log10(EQ_FREQUENCIES[0]);
const LOG_MAX = Math.log10(EQ_FREQUENCIES[EQ_BAND_COUNT - 1]);

/** 0..1 from top for a dB value */
function dbToRatio(db: number): number {
  return (EQ_MAX_DB - db) / (EQ_MAX_DB - EQ_MIN_DB);
}

interface BandSliderProps {
  index: number;
  value: number;
  active: boolean;
  onChange: (index: number, db: number) => void;
  onDragChange: (index: number | null) => void;
  label: string;
}

const BandSlider = memo(function BandSlider({
  index,
  value,
  active,
  onChange,
  onDragChange,
  label,
}: BandSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fromPointer = useCallback((clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return value;
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return clampBandDb(EQ_MAX_DB - ratio * (EQ_MAX_DB - EQ_MIN_DB));
  }, [value]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      el.setPointerCapture?.(e.pointerId);
      setDragging(true);
      onDragChange(index);
      onChange(index, fromPointer(e.clientY));

      const move = (ev: PointerEvent) => onChange(index, fromPointer(ev.clientY));
      const up = (ev: PointerEvent) => {
        setDragging(false);
        onDragChange(null);
        try {
          el.releasePointerCapture?.(ev.pointerId);
        } catch {}
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [fromPointer, index, onChange, onDragChange],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation();
      onChange(index, value + (e.deltaY < 0 ? EQ_STEP_DB : -EQ_STEP_DB));
    },
    [index, onChange, value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number | null = null;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") next = value + EQ_STEP_DB;
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = value - EQ_STEP_DB;
      else if (e.key === "PageUp") next = value + 3;
      else if (e.key === "PageDown") next = value - 3;
      else if (e.key === "Home") next = EQ_MAX_DB;
      else if (e.key === "End") next = EQ_MIN_DB;
      else if (e.key === "0" || e.key === "Delete" || e.key === "Backspace") next = 0;
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      onChange(index, next);
    },
    [index, onChange, value],
  );

  const ratio = dbToRatio(value);
  const centre = dbToRatio(0);
  const highlighted = hovered || dragging;
  const showBubble = dragging || hovered;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={EQ_MIN_DB}
      aria-valuemax={EQ_MAX_DB}
      aria-valuenow={value}
      aria-valuetext={formatDb(value)}
      onPointerDown={handlePointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onChange(index, 0);
      }}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex h-full flex-1 cursor-pointer justify-center outline-none touch-none"
    >
      <div ref={trackRef} className="relative h-full w-[4px]">
        {/* track */}
        <div
          className={`absolute inset-0 rounded-full transition-colors duration-150 ${
            highlighted
              ? "bg-black/[0.16] dark:bg-white/[0.18]"
              : "bg-black/[0.07] dark:bg-white/[0.08]"
          }`}
        />
        {/* fill from 0 dB to the value */}
        <div
          className={`absolute left-0 right-0 rounded-full bg-text-primary transition-opacity duration-150 ${
            active ? "opacity-90" : "opacity-35"
          }`}
          style={{
            top: `${Math.min(ratio, centre) * 100}%`,
            height: `${Math.abs(ratio - centre) * 100}%`,
          }}
        />
        {/* thumb */}
        <motion.div
          animate={{ scale: highlighted ? 1.25 : 1 }}
          transition={{ type: "spring", stiffness: 450, damping: 28 }}
          className={`absolute left-1/2 h-[12px] w-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.35)] ${
            active ? "bg-text-primary" : "bg-text-secondary"
          } group-focus-visible:ring-2 group-focus-visible:ring-text-primary/50`}
          style={{ top: `${ratio * 100}%` }}
        />
        {/* value bubble */}
        <div
          className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-text-primary px-[5px] py-[1px] text-[10px] font-semibold tabular-nums text-bg-primary transition-opacity duration-100 ${
            showBubble ? "opacity-100" : "opacity-0"
          }`}
          // above the thumb, or below it near the top so it never leaves the graph
          style={{ top: ratio < 0.2 ? `calc(${ratio * 100}% + 12px)` : `calc(${ratio * 100}% - 26px)` }}
        >
          {value > 0 ? "+" : ""}
          {value.toFixed(1)}
        </div>
      </div>
    </div>
  );
});

export interface EqualizerPanelProps {
  className?: string;
}

export const EqualizerPanel = memo(function EqualizerPanel({ className = "" }: EqualizerPanelProps) {
  const { t } = useTranslation();
  const player = usePlayerState();
  const bands = player.eqBands;
  const enabled = player.eqEnabled;
  const [draggingBand, setDraggingBand] = useState<number | null>(null);

  const preset = useMemo(() => presetForBands(bands), [bands]);
  const flat = isFlat(bands);
  const audible = enabled && !flat;
  const preampDb = useMemo(() => (audible ? autoPreampDb(bands) : 0), [audible, bands]);

  const handleBand = useCallback((index: number, db: number) => {
    playerEngine.setEqBand(index, db);
  }, []);

  // curve across the slider columns: column centres sit at (i + 0.5) / N
  const curve = useMemo(() => {
    const xFor = (f: number) => {
      const t01 = (Math.log10(f) - LOG_MIN) / (LOG_MAX - LOG_MIN);
      return ((0.5 + t01 * (EQ_BAND_COUNT - 1)) / EQ_BAND_COUNT) * 100;
    };
    const pts = CURVE_POINTS.map((f) => {
      const db = Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, responseDb(bands, f)));
      return [xFor(f), dbToRatio(db) * 100] as const;
    }).filter(([x]) => x >= 0 && x <= 100);
    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const zero = (dbToRatio(0) * 100).toFixed(2);
    const first = pts[0];
    const last = pts[pts.length - 1];
    const area = `${line} L${last[0].toFixed(2)},${zero} L${first[0].toFixed(2)},${zero} Z`;
    return { line, area };
  }, [bands]);

  const presetLabel = (id: EqPresetId) => t(`player.eq_preset_${id}`);
  const subtitle = !enabled
    ? t("player.eq_off")
    : preset === "custom"
      ? t("player.eq_custom")
      : presetLabel(preset);

  return (
    <div
      className={`flex flex-col gap-[14px] select-none text-text-primary ${className}`}
      onClick={(e) => e.stopPropagation()}
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-text-primary">{t("player.equalizer")}</span>
          <span className="truncate text-[10px] leading-tight text-text-tertiary">{subtitle}</span>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={(checked) => playerEngine.setEqEnabled(checked)}
          ariaLabel={t("player.equalizer")}
        />
      </div>

      {/* presets */}
      <div className="flex flex-wrap gap-[4px]">
        {EQ_PRESET_IDS.map((id) => {
          const isActive = enabled && preset === id;
          return (
            <motion.button
              key={id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => playerEngine.applyEqPreset(id)}
              className={`relative flex h-[26px] items-center justify-center rounded-md px-[9px] text-[11px] font-semibold transition-colors duration-150 cursor-pointer border-0 ${
                isActive
                  ? "text-bg-primary"
                  : "bg-black/[0.04] text-text-secondary hover:bg-black/[0.08] hover:text-text-primary dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-eq-preset"
                  className="absolute inset-0 rounded-md bg-text-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10 whitespace-nowrap">{presetLabel(id)}</span>
            </motion.button>
          );
        })}
      </div>

      {/* bands over the live response curve */}
      <div className="flex flex-col gap-[6px]">
        <div className="relative w-full" style={{ height: GRAPH_HEIGHT }}>
          {/* guides: +6 / 0 / -6 dB */}
          {[6, 0, -6].map((db) => (
            <div
              key={db}
              className={`pointer-events-none absolute left-0 right-0 h-px ${
                db === 0 ? "bg-black/[0.10] dark:bg-white/[0.10]" : "bg-black/[0.04] dark:bg-white/[0.04]"
              }`}
              style={{ top: `${dbToRatio(db) * 100}%` }}
            />
          ))}
          <svg
            className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible text-text-primary transition-opacity duration-200 ${
              audible ? "opacity-100" : "opacity-30"
            }`}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={curve.area} fill="currentColor" fillOpacity={0.07} />
            <path
              d={curve.line}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex">
            {EQ_FREQUENCIES.map((freq, i) => (
              <BandSlider
                key={freq}
                index={i}
                value={bands[i] ?? 0}
                active={enabled}
                onChange={handleBand}
                onDragChange={setDraggingBand}
                label={`${formatBandFrequency(freq)} Hz`}
              />
            ))}
          </div>
        </div>
        <div className="flex">
          {EQ_FREQUENCIES.map((freq, i) => (
            <span
              key={freq}
              className={`flex-1 text-center text-[10px] tabular-nums transition-colors duration-100 ${
                draggingBand === i ? "text-text-primary" : "text-text-tertiary"
              }`}
            >
              {formatBandFrequency(freq)}
            </span>
          ))}
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between gap-[8px]">
        <span className="text-[10px] text-text-tertiary">
          {audible && preampDb < -0.05
            ? t("player.eq_headroom", { db: `\u2212${Math.abs(preampDb).toFixed(1)}` })
            : t("player.eq_hint")}
        </span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          disabled={flat}
          onClick={() => playerEngine.resetEq()}
          className="flex h-[24px] items-center rounded-md bg-black/[0.05] px-[9px] text-[11px] font-semibold text-text-secondary transition-colors hover:bg-black/[0.10] hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 dark:bg-white/[0.05] dark:hover:bg-white/[0.12] cursor-pointer border-0"
        >
          {t("player.eq_reset")}
        </motion.button>
      </div>
    </div>
  );
});

export default EqualizerPanel;
