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
      className={`group relative inline-flex h-[22px] w-[40px] items-center rounded-full border transition-all duration-200 cursor-pointer select-none ${
        checked
          ? "bg-text-primary border-text-primary"
          : "bg-black/15 dark:bg-white/[0.08] hover:bg-black/20 dark:hover:bg-white/[0.12] border-black/10 dark:border-white/[0.10]"
      }`}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span
        className={`inline-block h-[16px] w-[16px] rounded-full shadow-[0_1px_2.5px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out ${
          checked
            ? "translate-x-[20px] bg-bg-primary"
            : "translate-x-[2px] bg-white/80 dark:bg-white/80 group-hover:bg-white"
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
