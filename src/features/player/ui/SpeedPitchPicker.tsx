import { memo, useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui";
import { SparklesFill } from "@mingcute/react";

export interface SpeedPitchPickerProps {
  className?: string;
  onClose?: () => void;
}

interface SliderRowProps {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  disabledHint?: string;
  onStepDown: () => void;
  onStepUp: () => void;
  onChange: (val: number) => void;
  ariaLabel: string;
}

function SliderRow({
  label,
  valueText,
  min,
  max,
  step,
  value,
  disabled = false,
  disabledHint,
  onStepDown,
  onStepUp,
  onChange,
  ariaLabel,
}: SliderRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const currentValue = isDragging && dragValue !== null ? dragValue : value;
  const clampedValue = Math.max(min, Math.min(max, currentValue));
  const range = max - min || 1;
  const percentage = Math.max(0, Math.min(100, ((clampedValue - min) / range) * 100));

  const calculateValueFromPointer = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return clampedValue;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round((raw - min) / step) * step + min;
      const precision = step.toString().split(".")[1]?.length || 0;
      return Math.max(min, Math.min(max, Number(stepped.toFixed(precision))));
    },
    [clampedValue, min, max, step],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const nextVal = calculateValueFromPointer(e.clientX);
      setDragValue(nextVal);
      onChange(nextVal);

      const onPointerMove = (ev: PointerEvent) => {
        const val = calculateValueFromPointer(ev.clientX);
        setDragValue(val);
        onChange(val);
      };

      const onPointerUp = (ev: PointerEvent) => {
        setIsDragging(false);
        setDragValue(null);
        try {
          (e.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
        } catch {}
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [calculateValueFromPointer, disabled, onChange],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault();
      const delta = e.deltaY < 0 ? step : -step;
      const nextVal = Math.max(min, Math.min(max, Number((currentValue + delta).toFixed(2))));
      onChange(nextVal);
    },
    [currentValue, disabled, max, min, onChange, step],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onStepUp();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onStepDown();
      }
    },
    [disabled, onStepDown, onStepUp],
  );

  const isActive = (isHovered || isDragging) && !disabled;

  return (
    <div className={`flex flex-col gap-[6px] ${disabled ? "opacity-45" : ""}`}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-text-primary select-none flex items-center gap-[6px]">
          {label}
          <AnimatePresence>
            {disabled && disabledHint ? (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15 }}
                className="text-[10px] px-[5px] py-[1px] rounded bg-white/[0.08] text-text-tertiary font-normal"
              >
                {disabledHint}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
        <div className="flex items-center gap-[4px] select-none">
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            disabled={disabled || clampedValue <= min}
            onClick={(e) => {
              e.stopPropagation();
              onStepDown();
            }}
            className="flex h-[20px] w-[20px] items-center justify-center rounded-md bg-white/[0.05] hover:bg-white/[0.12] text-text-secondary hover:text-text-primary text-[13px] font-bold leading-none disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-0"
            aria-label="Decrease"
          >
            −
          </motion.button>
          <span
            className="w-[52px] text-center text-[12px] font-semibold tabular-nums text-text-primary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {valueText}
          </span>
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            disabled={disabled || clampedValue >= max}
            onClick={(e) => {
              e.stopPropagation();
              onStepUp();
            }}
            className="flex h-[20px] w-[20px] items-center justify-center rounded-md bg-white/[0.05] hover:bg-white/[0.12] text-text-secondary hover:text-text-primary text-[13px] font-bold leading-none disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-0"
            aria-label="Increase"
          >
            +
          </motion.button>
        </div>
      </div>

      <div
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clampedValue}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex h-[20px] w-full items-center cursor-pointer select-none outline-none"
      >
        <div
          ref={trackRef}
          className={`relative h-[6px] w-full rounded-full overflow-hidden transition-colors duration-150 ${
            isActive
              ? "bg-black/[0.20] dark:bg-white/[0.22]"
              : "bg-black/[0.10] dark:bg-white/[0.14]"
          }`}
        >
          <div
            className={`relative h-full rounded-full bg-text-primary transition-[width] ease-out ${
              isDragging ? "duration-0" : "duration-100"
            }`}
            style={{ width: `${percentage}%` }}
          >
            <motion.div
              animate={{ scale: isActive ? 1.25 : 1 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-[10px] w-[10px] rounded-full bg-text-primary shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const SpeedPitchPicker = memo(function SpeedPitchPicker({
  className = "",
}: SpeedPitchPickerProps) {
  const { t } = useTranslation();
  const player = usePlayerState();

  const playbackRate = player.playbackRate ?? 1;
  const pitchSemitones = player.pitchSemitones ?? 0;
  const isPitchLinked = player.isPitchLinked ?? true;
  const keepSpeedAcrossTracks = player.keepSpeedAcrossTracks ?? true;
  const isReverbEnabled = player.isReverbEnabled ?? false;
  const reverbLevel = player.reverbLevel ?? 0.35;

  const handleSpeedChange = useCallback((rate: number) => {
    playerEngine.setPlaybackRate(rate);
  }, []);

  const handlePitchChange = useCallback((pitch: number) => {
    playerEngine.setPitchSemitones(pitch);
  }, []);

  const handleReverbChange = useCallback((level: number) => {
    playerEngine.setReverbLevel(level);
  }, []);

  const handleReverbToggle = useCallback((enabled: boolean) => {
    if (enabled && (player.reverbLevel === undefined || player.reverbLevel < 0.1)) {
      playerEngine.setReverbLevel(0.4);
    }
    playerEngine.setIsReverbEnabled(enabled);
  }, [player.reverbLevel]);

  const handlePresetClick = useCallback(
    (rate: number) => {
      playerEngine.setPlaybackRate(rate);
    },
    [],
  );

  const presets = [
    { label: "x0.8", rate: 0.8, title: t("player.preset_slowed") },
    { label: "x0.9", rate: 0.9, title: "x0.9" },
    { label: "x1.0", rate: 1.0, title: t("player.preset_normal") },
    { label: "x1.15", rate: 1.15, title: "x1.15" },
    { label: "x1.25", rate: 1.25, title: t("player.preset_speedup") },
    { label: "x1.35", rate: 1.35, title: t("player.preset_nightcore") },
  ];

  return (
    <div
      className={`flex flex-col gap-[14px] select-none text-text-primary ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick Presets */}
      <div className="grid grid-cols-6 gap-[4px]">
        {presets.map((preset) => {
          const isActive = Math.abs(playbackRate - preset.rate) < 0.02;
          return (
            <motion.button
              key={preset.rate}
              type="button"
              title={preset.title}
              whileTap={{ scale: 0.94 }}
              onClick={() => handlePresetClick(preset.rate)}
              className={`relative flex h-[26px] items-center justify-center rounded-md text-[11px] font-semibold transition-colors duration-150 cursor-pointer border-0 ${
                isActive
                  ? "text-bg-primary"
                  : "bg-white/[0.04] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-speed-preset"
                  className="absolute inset-0 rounded-md bg-text-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10">{preset.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Speed Slider */}
      <SliderRow
        label={t("player.speed")}
        valueText={`x${playbackRate.toFixed(2)}`}
        min={0.5}
        max={2.0}
        step={0.05}
        value={playbackRate}
        onStepDown={() => handleSpeedChange(Math.max(0.5, Number((playbackRate - 0.05).toFixed(2))))}
        onStepUp={() => handleSpeedChange(Math.min(2.0, Number((playbackRate + 0.05).toFixed(2))))}
        onChange={handleSpeedChange}
        ariaLabel={t("player.speed")}
      />

      {/* Pitch Slider */}
      <SliderRow
        label={t("player.pitch")}
        valueText={`${pitchSemitones > 0 ? `+${pitchSemitones.toFixed(1)}` : pitchSemitones.toFixed(1)} st`}
        min={-12}
        max={12}
        step={0.5}
        value={pitchSemitones}
        onStepDown={() =>
          handlePitchChange(Math.max(-12, Number((pitchSemitones - 0.5).toFixed(1))))
        }
        onStepUp={() =>
          handlePitchChange(Math.min(12, Number((pitchSemitones + 0.5).toFixed(1))))
        }
        onChange={handlePitchChange}
        ariaLabel={t("player.pitch")}
      />

      {/* Options (without separator above) */}
      <div className="flex flex-col gap-[12px] pt-[2px]">
        {/* Link speed to pitch toggle */}
        <div className="flex items-center justify-between gap-[8px]">
          <div className="flex flex-col">
            <span className="text-[12px] font-medium text-text-primary">
              {t("player.link_speed_pitch")}
            </span>
            <span className="text-[10px] text-text-tertiary leading-tight">
              {isPitchLinked
                ? t("player.link_speed_pitch_hint")
                : t("player.key_lock_hint")}
            </span>
          </div>
          <ToggleSwitch
            checked={isPitchLinked}
            onChange={(checked) => playerEngine.setIsPitchLinked(checked)}
            ariaLabel={t("player.link_speed_pitch")}
          />
        </div>

        {/* Keep across tracks toggle */}
        <div className="flex items-center justify-between gap-[8px]">
          <div className="flex flex-col">
            <span className="text-[12px] font-medium text-text-primary">
              {t("player.keep_speed_across_tracks")}
            </span>
            <span className="text-[10px] text-text-tertiary leading-tight">
              {t("player.keep_speed_hint")}
            </span>
          </div>
          <ToggleSwitch
            checked={keepSpeedAcrossTracks}
            onChange={(checked) => playerEngine.setKeepSpeedAcrossTracks(checked)}
            ariaLabel={t("player.keep_speed_across_tracks")}
          />
        </div>

        {/* Reverb group */}
        <div className="flex flex-col pt-[2px]">
          <div className="flex items-center justify-between gap-[8px]">
            <div className="flex flex-col">
              <span className="flex items-center gap-[6px] text-[12px] font-medium text-text-primary">
                {t("player.reverb")}
                <SparklesFill size={13} className="text-amber-400 shrink-0" />
              </span>
              <span className="text-[10px] text-text-tertiary leading-tight">
                {t("player.reverb_hint")}
              </span>
            </div>
            <ToggleSwitch
              checked={isReverbEnabled}
              onChange={handleReverbToggle}
              ariaLabel={t("player.reverb")}
            />
          </div>

          {/* Reverb Amount Slider */}
          <AnimatePresence initial={false}>
            {isReverbEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-[2px]">
                  <SliderRow
                    label={t("player.reverb_amount")}
                    valueText={`${Math.round(reverbLevel * 100)}%`}
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    value={reverbLevel}
                    onStepDown={() =>
                      handleReverbChange(
                        Math.max(0.05, Number((reverbLevel - 0.05).toFixed(2))),
                      )
                    }
                    onStepUp={() =>
                      handleReverbChange(
                        Math.min(1.0, Number((reverbLevel + 0.05).toFixed(2))),
                      )
                    }
                    onChange={handleReverbChange}
                    ariaLabel={t("player.reverb_amount")}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

export default SpeedPitchPicker;
