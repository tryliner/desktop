export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[28px] w-[52px] items-center rounded-full border transition-colors cursor-pointer select-none ${
        checked
          ? "bg-text-primary border-text-primary"
          : "bg-black/10 dark:bg-white/15 border-border-secondary dark:border-white/20"
      }`}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span
        className={`inline-block h-[22px] w-[22px] rounded-full transition-all ${
          checked
            ? "translate-x-[27px] bg-bg-primary"
            : "translate-x-[3px] bg-text-secondary"
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
