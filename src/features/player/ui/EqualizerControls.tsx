import { useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  EQUALIZER_BANDS,
  EQUALIZER_GAIN_LIMIT,
} from "../store/audioSettings";
import { usePlayerStore } from "../store/playerStore";

function formatGain(value: number) {
  const formatted = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${formatted} dB`;
}

function VerticalGainSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const clamp = useCallback(
    (next: number) =>
      Math.max(-EQUALIZER_GAIN_LIMIT, Math.min(EQUALIZER_GAIN_LIMIT, next)),
    [],
  );
  const fromPointer = useCallback(
    (clientY: number) => {
      const rect = sliderRef.current?.getBoundingClientRect();
      if (!rect || rect.height === 0) return value;
      const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      return clamp(Number(((ratio * 2 - 1) * EQUALIZER_GAIN_LIMIT).toFixed(1)));
    },
    [clamp, value],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      target.setPointerCapture?.(event.pointerId);
      onChange(fromPointer(event.clientY));

      const onPointerMove = (moveEvent: PointerEvent) => {
        onChange(fromPointer(moveEvent.clientY));
      };
      const onPointerUp = (upEvent: PointerEvent) => {
        try {
          target.releasePointerCapture?.(upEvent.pointerId);
        } catch {
          // Pointer capture may already be released by the browser.
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [disabled, fromPointer, onChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        onChange(clamp(value + 1));
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(clamp(value - 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        onChange(-EQUALIZER_GAIN_LIMIT);
      } else if (event.key === "End") {
        event.preventDefault();
        onChange(EQUALIZER_GAIN_LIMIT);
      }
    },
    [clamp, disabled, onChange, value],
  );

  const knobTop = 50 - (value / EQUALIZER_GAIN_LIMIT) * 50;
  const fillTop = value >= 0 ? knobTop : 50;
  const fillHeight = (Math.abs(value) / EQUALIZER_GAIN_LIMIT) * 50;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-[6px]">
      <span className="h-[16px] whitespace-nowrap text-[10px] font-medium tabular-nums text-text-secondary">
        {formatGain(value)}
      </span>
      <div
        ref={sliderRef}
        role="slider"
        aria-label={label}
        aria-valuemin={-EQUALIZER_GAIN_LIMIT}
        aria-valuemax={EQUALIZER_GAIN_LIMIT}
        aria-valuenow={value}
        aria-valuetext={formatGain(value)}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        className={`relative flex h-[116px] w-[28px] touch-none items-center justify-center outline-none ${
          disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"
        }`}
      >
        <span className="absolute top-0 h-full w-[3px] rounded-full bg-black/[0.12] dark:bg-white/[0.17]" />
        <span
          className="absolute w-[3px] rounded-full bg-text-primary"
          style={{ top: `${fillTop}%`, height: `${fillHeight}%` }}
        />
        <span
          className="absolute z-[1] h-[7px] w-[17px] rounded-full bg-text-primary shadow-sm transition-[top] duration-100"
          style={{ top: `${knobTop}%` }}
        />
        <span className="absolute top-1/2 h-[1px] w-[13px] bg-text-tertiary/70" />
      </div>
      <span className="h-[14px] whitespace-nowrap text-[10px] text-text-secondary">
        {label}
      </span>
    </div>
  );
}

export function EqualizerControls({
  compact = false,
}: {
  compact?: boolean;
}) {
  const state = usePlayerStore(
    useShallow((state) => ({
      equalizerBands: state.equalizerBands,
      isEqualizerEnabled: state.isEqualizerEnabled,
      setEqualizerBand: state.setEqualizerBand,
    })),
  );

  return (
    <div
      className={`flex w-full items-stretch ${
        compact ? "gap-[2px]" : "gap-[6px]"
      }`}
      aria-label="Equalizer bands"
    >
      {EQUALIZER_BANDS.map((band, index) => (
        <VerticalGainSlider
          key={band.id}
          label={band.label}
          value={state.equalizerBands[index] ?? 0}
          disabled={!state.isEqualizerEnabled}
          onChange={(value) => state.setEqualizerBand(band.id, value)}
        />
      ))}
    </div>
  );
}
