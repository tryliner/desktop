import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const pillId = useId();

  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-[34px] w-fit shrink-0 items-center rounded-item bg-fill p-[3px]",
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            aria-pressed={isActive}
            className={cn(
              "relative inline-flex h-full cursor-pointer items-center whitespace-nowrap rounded-control border-0 bg-transparent px-[12px] text-body leading-none transition-colors",
              isActive
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary",
            )}
            style={{ fontWeight: 500 }}
          >
            {isActive ? (
              <motion.span
                layoutId={pillId}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-control bg-fill-hover"
              />
            ) : null}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
