import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

export interface SettingsNavIconProps {
  size?: number;
  weight?: "Bold";
  className?: string;
}

const itemClass =
  "group relative flex h-[32px] w-full cursor-pointer items-center gap-[10px] rounded-[9px] border-0 bg-transparent px-[9px] text-left text-[13px] font-[500] leading-none transition-colors";

export function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  role,
}: {
  icon: ComponentType<SettingsNavIconProps>;
  label: ReactNode;
  active?: boolean;
  onClick: () => void;
  role?: "tab";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role ? active : undefined}
      onClick={onClick}
      className={cn(
        itemClass,
        active
          ? "text-text-primary"
          : "text-text-secondary hover:text-text-primary",
      )}
    >
      {active ? (
        <motion.span
          layoutId="settings-nav-active"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
          className="absolute inset-0 rounded-[9px] bg-black/[0.07] dark:bg-white/[0.12]"
        />
      ) : null}
      <Icon
        size={17}
        weight="Bold"
        className={cn(
          "relative shrink-0 transition-colors",
          active
            ? "text-text-primary"
            : "text-text-tertiary group-hover:text-text-secondary",
        )}
      />
      <span className="relative truncate">{label}</span>
    </button>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 px-[9px] pb-[6px] text-[12px] font-[500] leading-[16px] text-text-tertiary">
      {children}
    </p>
  );
}
