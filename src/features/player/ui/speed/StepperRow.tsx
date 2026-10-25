import { AddLine, MinimizeLine } from "@mingcute/react";
import { cn } from "@/shared/lib";

export interface StepperRowProps {
  valueText: string;
  decreaseLabel: string;
  increaseLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onReset?: () => void;
}

const stepButton =
  "flex h-[28px] w-[36px] items-center justify-center rounded-[6px] border-0 text-text-primary transition-colors bg-black/[0.06] hover:bg-black/[0.1] dark:bg-white/[0.1] dark:hover:bg-white/[0.16] disabled:cursor-default disabled:opacity-40";

export function StepperRow({
  valueText,
  decreaseLabel,
  increaseLabel,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
  onReset,
}: StepperRowProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={!canDecrease}
        onClick={onDecrease}
        className={stepButton}
      >
        <MinimizeLine size={14} />
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={!onReset}
        className={cn(
          "flex h-[28px] min-w-[64px] items-center justify-center rounded-[6px] border-0 px-[10px] text-[13px] font-[600] tabular-nums text-text-primary",
          "bg-black/[0.06] dark:bg-white/[0.1]",
          onReset ? "cursor-pointer" : "cursor-default",
        )}
      >
        {valueText}
      </button>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={!canIncrease}
        onClick={onIncrease}
        className={stepButton}
      >
        <AddLine size={14} />
      </button>
    </div>
  );
}
