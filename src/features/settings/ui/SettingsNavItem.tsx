import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { RightLine } from "@mingcute/react";
import { cn } from "@/shared/lib/utils";

export interface SettingsNavIconProps {
  size?: number;
  weight?: "Bold";
  className?: string;
}

const itemClass =
  "group relative flex h-[32px] w-full cursor-pointer items-center gap-[10px] rounded-control border-0 bg-transparent px-[9px] text-left text-body font-[500] leading-none transition-colors";

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
          className="absolute inset-0 rounded-control bg-fill-hover"
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
      <RightLine size={15} className="relative ml-auto text-text-tertiary/60 md:hidden shrink-0" />
    </button>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 px-[9px] pb-[6px] text-caption font-[500] leading-[16px] text-text-tertiary">
      {children}
    </p>
  );
}
