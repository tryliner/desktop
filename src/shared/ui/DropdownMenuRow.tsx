import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@/shared/lib";

interface DropdownMenuRowProps {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  highlighted: boolean;
  current: boolean;
  hasChildren: boolean;
  expanded: boolean;
  onMouseEnter: (e: MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}

function Chevron() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="shrink-0 text-text-tertiary"
    >
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DropdownMenuRow({
  label,
  icon,
  danger,
  disabled,
  highlighted,
  current,
  hasChildren,
  expanded,
  onMouseEnter,
  onMouseLeave,
  onKeyDown,
  onClick,
}: DropdownMenuRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-haspopup={hasChildren ? "menu" : undefined}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-current={current ? "true" : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={cn(
        "group flex w-full h-[30px] items-center gap-[8px] rounded-control px-[9px] text-body font-normal transition-colors border-none bg-transparent text-left cursor-pointer select-none outline-none disabled:pointer-events-none disabled:opacity-40",
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-400"
          : "text-text-primary hover:bg-fill",
        highlighted && "bg-fill",
      )}
    >
      {icon && (
        <span
          className={cn(
            "shrink-0 flex items-center justify-center text-title transition-colors",
            danger
              ? "text-red-400"
              : "text-text-secondary group-hover:text-text-primary",
          )}
        >
          {icon}
        </span>
      )}
      <span className="truncate flex-1">{label}</span>
      {hasChildren && <Chevron />}
    </button>
  );
}
