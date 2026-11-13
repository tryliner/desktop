import { memo } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.svg";
import { cn } from "@/shared/lib";
import { SidebarPins } from "./SidebarPins";
import { SidebarNavItems } from "./SidebarNavItems";
import { SidebarSettingsButton } from "./SidebarSettingsButton";

export type SidebarPlacement = "left" | "top" | "right";

export interface SidebarProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
  position?: SidebarPlacement;
}

const TOOLTIP_SIDE = {
  left: "right",
  top: "bottom",
  right: "left",
} as const;

function Sidebar({
  searchOpen,
  onSearchToggle,
  position = "left",
}: SidebarProps) {
  const horizontal = position === "top";
  const tooltipSide = TOOLTIP_SIDE[position];

  return (
    <div
      className={cn(
        "flex items-center gap-[6px]",
        horizontal ? "h-[52px] w-full pr-[260px]" : "h-full w-[52px] flex-col",
      )}
    >
      {/* one panel for nav and library; hugs its content and scrolls the
          library once it reaches the window bottom */}
      <div
        className={cn(
          "min-h-0 flex rounded-item bg-bg-glass [:root[data-user-accent]_&]:bg-(--user-accent-island) backdrop-blur-[20px]",
          horizontal
            ? "h-full min-w-0 flex-row items-center"
            : "w-full flex-col",
        )}
      >
        <nav
          className={cn(
            "shrink-0 flex items-center gap-[20px]",
            horizontal ? "flex-row px-[18px]" : "flex-col py-[16px]",
          )}
        >
          <Link
            to="/"
            title="Liner"
            className="flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            <img
              src={logo}
              alt="Liner"
              width={30}
              height={23}
              className="h-[23px] w-auto object-contain theme-logo invert dark:invert-0 select-none"
              draggable={false}
            />
          </Link>
          <SidebarNavItems
            searchOpen={searchOpen}
            onSearchToggle={onSearchToggle}
            tooltipSide={tooltipSide}
          />
          <SidebarSettingsButton tooltipSide={tooltipSide} />
        </nav>

        <SidebarPins
          horizontal={horizontal}
          tooltipSide={
            horizontal ? "bottom" : position === "right" ? "left" : "right"
          }
        />
      </div>
    </div>
  );
}

export default memo(Sidebar);
