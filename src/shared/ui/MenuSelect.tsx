import { useState } from "react";
import { DownLine } from "@mingcute/react";
import { cn } from "@/shared/lib/utils";
import DropdownMenu from "./DropdownMenu";
import type { SelectOption } from "./Select";

export interface MenuSelectProps<T extends string = string> {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  align?: "start" | "end";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export default function MenuSelect<T extends string = string>({
  options,
  value,
  onChange,
  align = "end",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(
        "flex h-[34px] min-w-0 cursor-pointer items-center gap-[8px] rounded-[11px] border-0 pr-[10px] pl-[12px] font-sans text-[13px] font-[500] text-text-primary transition-colors",
        "bg-black/[0.05] hover:bg-black/[0.08] dark:bg-white/[0.07] dark:hover:bg-white/[0.1]",
        open && "bg-black/[0.08] dark:bg-white/[0.1]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {selected?.icon && (
        <span className="flex shrink-0 items-center">{selected.icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-left">
        {selected?.label ?? ""}
      </span>
      <DownLine
        size={14}
        className={cn(
          "shrink-0 text-text-tertiary transition-transform duration-150",
          open && "rotate-180",
        )}
      />
    </button>
  );

  if (disabled) return trigger;

  return (
    <DropdownMenu
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      align={align}
      items={options.map((option) => ({
        id: option.value,
        label: option.label,
        icon: option.icon,
        active: option.value === value,
        onClick: () => onChange(option.value),
      }))}
    />
  );
}
