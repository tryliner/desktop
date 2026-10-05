import React, { useId } from "react";
import { motion } from "framer-motion";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface PillTabsProps<T extends string = string> {
  tabs: (TabItem<T> | T)[];
  activeTab: T;
  onChange: (tab: T) => void;
  layoutId?: string;
  variant?: "solid" | "glass" | "expressive";
  size?: "sm" | "md" | "lg";
  className?: string;
  tabClassName?: string;
}

export function PillTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId: customLayoutId,
  variant = "expressive",
  size = "md",
  className = "",
  tabClassName = "",
}: PillTabsProps<T>) {
  const autoLayoutId = useId();
  const layoutId = customLayoutId || `pill-tabs-${autoLayoutId}`;

  const normalizedTabs: TabItem<T>[] = tabs.map((tab) =>
    typeof tab === "string" ? { id: tab as T, label: tab } : tab,
  );

  const sizeStyles = {
    sm: "h-[30px] px-[12px] text-[12px] gap-[6px] rounded-lg",
    md: "h-[36px] px-[16px] text-[13px] gap-[8px] rounded-xl",
    lg: "h-[42px] px-[20px] text-[14px] gap-[10px] rounded-2xl",
  }[size];

  const containerPadding = size === "sm" ? "p-[3px] gap-[2px]" : "p-[4px] gap-[4px]";

  const containerStyles =
    variant === "glass"
      ? "bg-black/20 dark:bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]"
      : variant === "expressive"
      ? "bg-black/10 dark:bg-black/30 backdrop-blur-lg border border-white/[0.05]"
      : "bg-bg-elevated";

  return (
    <div
      role="tablist"
      className={`inline-flex items-center rounded-2xl select-none ${containerPadding} ${containerStyles} ${className}`}
    >
      {normalizedTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            type="button"
            onClick={() => !isDisabled && onChange(tab.id)}
            className={`relative inline-flex items-center justify-center font-[500] leading-none transition-colors duration-200 border-0 bg-transparent outline-none cursor-pointer ${
              isDisabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.97]"
            } ${sizeStyles} ${
              isActive
                ? "text-black dark:text-[#0b101b] font-[600]"
                : "text-text-secondary hover:text-text-primary dark:text-white/50 dark:hover:text-white/90"
            } ${tabClassName}`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-[inherit] bg-[#adc6ff] dark:bg-[#b4c5ff] shadow-[0_2px_12px_rgba(180,198,255,0.25)]"
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 32,
                  mass: 0.8,
                }}
              />
            )}

            <span className="relative z-10 flex items-center gap-[6px]">
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge && <span className="shrink-0">{tab.badge}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default PillTabs;
