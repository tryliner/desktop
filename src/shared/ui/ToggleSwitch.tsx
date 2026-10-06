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
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`group relative inline-flex h-[22px] w-[40px] items-center rounded-full transition-all duration-200 select-none border-0 ${
        disabled
          ? "cursor-not-allowed opacity-40 " + (checked ? "bg-text-tertiary" : "bg-black/[0.08] dark:bg-white/[0.04]")
          : "cursor-pointer " + (checked ? "bg-text-primary" : "bg-black/[0.12] dark:bg-white/[0.07] hover:bg-black/[0.16] dark:hover:bg-white/[0.11]")
      }`}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span
        className={`inline-block h-[16px] w-[16px] rounded-full transition-all duration-200 ease-out ${
          checked
            ? "translate-x-[21px] " + (disabled ? "bg-bg-tertiary" : "bg-bg-primary")
            : "translate-x-[3px] " + (disabled ? "bg-white/60" : "bg-white")
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
