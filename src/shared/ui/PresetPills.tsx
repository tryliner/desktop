import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib";

export interface PresetPillOption<T> {
  value: T;
  label: string;
  title?: string;
}

export interface PresetPillsProps<T> {
  options: readonly PresetPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  isActive?: (option: T, value: T) => boolean;
  size?: "sm" | "md";
  fill?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

// same look as the settings SegmentedControl: a fill track, the picked
// option lifted onto fill-hover
const TRACK_CLASSES = {
  sm: "rounded-control p-[2px]",
  md: "rounded-item p-[3px]",
};

const SIZE_CLASSES = {
  sm: "h-[24px] rounded-[6px] text-[11px] font-[600]",
  md: "h-[28px] rounded-control px-[12px] text-caption font-[600]",
};

export function PresetPills<T>({
  options,
  value,
  onChange,
  isActive = (option, current) => option === current,
  size = "sm",
  fill = true,
  disabled = false,
  ariaLabel,
  className,
}: PresetPillsProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        "gap-[2px] bg-fill transition-opacity",
        TRACK_CLASSES[size],
        fill ? "grid" : "grid w-fit",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${options.length}, ${fill ? "minmax(0, 1fr)" : "auto"})`,
      }}
    >
      {options.map((option) => {
        const active = isActive(option.value, value);
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex cursor-pointer items-center justify-center whitespace-nowrap border-0 transition-colors",
              SIZE_CLASSES[size],
              "bg-transparent",
              active
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[inherit] bg-fill-hover"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
