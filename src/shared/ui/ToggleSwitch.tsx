import { cn } from "@/shared/lib/utils";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "group relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border-0 p-0 select-none outline-none",
        "transition-colors duration-200 ease-out",
        "focus-visible:ring-2 focus-visible:ring-text-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
        checked
          ? "bg-black/[0.35] dark:bg-white/[0.35]"
          : "bg-black/[0.1] dark:bg-white/[0.1]",
        disabled
          ? "cursor-not-allowed opacity-40"
          : cn(
              "cursor-pointer",
              checked
                ? "hover:bg-black/[0.42] dark:hover:bg-white/[0.42]"
                : "hover:bg-black/[0.14] dark:hover:bg-white/[0.14]",
            ),
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[2px] h-[18px] w-[18px] rounded-full",
          "transition-[left,width,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]",
          !disabled && "group-active:w-[22px]",
          checked
            ? cn(
                "left-[18px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]",
                !disabled && "group-active:left-[14px]",
              )
            : "left-[2px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] dark:bg-white/50 dark:shadow-none",
        )}
      />
    </button>
  );
}

export default ToggleSwitch;
