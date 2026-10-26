import type { ReactNode } from "react";
import { ToggleSwitch } from "@/shared/ui";

export interface OptionToggleProps {
  title: ReactNode;
  hint: string;
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}

export function OptionToggle({
  title,
  hint,
  checked,
  ariaLabel,
  onChange,
}: OptionToggleProps) {
  return (
    <div className="flex items-center justify-between gap-[12px]">
      <div className="flex min-w-0 flex-col gap-[2px]">
        <span className="flex items-center gap-[6px] text-[13px] font-[500] text-text-primary">
          {title}
        </span>
        <span className="text-[11px] leading-[1.35] text-text-tertiary">
          {hint}
        </span>
      </div>
      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
