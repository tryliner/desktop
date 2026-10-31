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

const SIZE_CLASSES = {
  sm: "h-[26px] rounded-[6px] text-[11px] font-[600]",
  md: "h-[30px] rounded-[8px] px-[12px] text-[12px] font-[600]",
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
        "gap-[4px] transition-opacity",
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
              active
                ? "text-bg-primary"
                : "bg-black/[0.06] text-text-secondary hover:text-text-primary dark:bg-white/[0.06]",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[inherit] bg-text-primary/80"
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
