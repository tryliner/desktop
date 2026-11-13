import { cn } from "@/shared/lib";

interface RangeControlProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  format: (value: number) => string;
  ariaLabel: string;
  className?: string;
}

export function RangeControl({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  format,
  ariaLabel,
  className,
}: RangeControlProps) {
  return (
    <div className={cn("flex items-center gap-[10px]", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="h-[4px] w-[150px] cursor-pointer accent-accent-primary"
      />
      <span className="w-[44px] text-right text-body tabular-nums text-text-secondary">
        {format(value)}
      </span>
    </div>
  );
}
