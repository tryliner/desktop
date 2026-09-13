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
      className={`group relative inline-flex h-[22px] w-[40px] items-center rounded-full transition-all duration-200 cursor-pointer select-none border-0 ${
        checked
          ? "bg-text-primary"
          : "bg-black/[0.12] dark:bg-white/[0.07] hover:bg-black/[0.16] dark:hover:bg-white/[0.11]"
      }`}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span
        className={`inline-block h-[16px] w-[16px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out ${
          checked
            ? "translate-x-[21px] bg-bg-primary"
            : "translate-x-[3px] bg-white"
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
