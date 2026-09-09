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
      className={`relative inline-flex h-[28px] w-[52px] items-center rounded-full border transition-colors ${
        checked
          ? "bg-text-primary border-text-primary"
          : "bg-transparent border-border-primary"
      }`}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span
        className={`inline-block h-[22px] w-[22px] rounded-full bg-bg-primary transition-transform ${
          checked ? "translate-x-[27px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
