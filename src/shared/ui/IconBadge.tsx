import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

export interface IconBadgeProps {
  icon: ReactNode;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

export default function IconBadge({
  icon,
  label,
  size = "sm",
  className,
}: IconBadgeProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[3px] bg-black/[0.1] text-text-secondary dark:bg-white/[0.14]",
        size === "md" ? "size-[15px]" : "size-[13px]",
        className,
      )}
    >
      {icon}
    </span>
  );
}
