import { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home7Fill,
  Search3Fill,
  BookmarksFill,
  Settings4Fill,
} from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { cn } from "@/shared/lib";

export interface BottomNavBarProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
  className?: string;
}

export function BottomNavBar({
  searchOpen,
  onSearchToggle,
  className,
}: BottomNavBarProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const openSettings = useModalStore((state) => state.openSettings);
  const isSettingsOpen = useModalStore((state) => state.settingsOpen);

  const isHomeActive = !searchOpen && !isSettingsOpen && (pathname === "/" || pathname === "/home");
  const isLibraryActive = !searchOpen && !isSettingsOpen && pathname.startsWith("/library");

  return (
    <nav
      className={cn(
        "md:hidden w-full h-[60px] shrink-0 z-[45] flex items-center justify-around",
        "bg-bg-glass backdrop-blur-[24px] border-t border-border-primary/80",
        "px-3 pb-[env(safe-area-inset-bottom,0px)] select-none",
        className,
      )}
    >
      {/* Home */}
      <Link
        to="/"
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-150 active:scale-95",
          isHomeActive
            ? "text-accent-primary drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            : "text-text-tertiary hover:text-text-secondary",
        )}
      >
        <Home7Fill size={22} />
        <span className="text-[10px] font-medium tracking-tight">
          {t("common.sidebar.home") || "Home"}
        </span>
      </Link>

      {/* Search */}
      <button
        type="button"
        onClick={onSearchToggle}
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-150 active:scale-95 bg-transparent border-0 cursor-pointer p-0",
          searchOpen
            ? "text-accent-primary drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            : "text-text-tertiary hover:text-text-secondary",
        )}
      >
        <Search3Fill size={22} />
        <span className="text-[10px] font-medium tracking-tight">
          {t("common.sidebar.search") || "Search"}
        </span>
      </button>

      {/* Library */}
      <Link
        to="/library"
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-150 active:scale-95",
          isLibraryActive
            ? "text-accent-primary drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            : "text-text-tertiary hover:text-text-secondary",
        )}
      >
        <BookmarksFill size={22} />
        <span className="text-[10px] font-medium tracking-tight">
          {t("common.sidebar.library") || "Library"}
        </span>
      </Link>

      {/* Settings */}
      <button
        type="button"
        onClick={openSettings}
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-150 active:scale-95 bg-transparent border-0 cursor-pointer p-0",
          isSettingsOpen
            ? "text-accent-primary drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            : "text-text-tertiary hover:text-text-secondary",
        )}
      >
        <Settings4Fill size={22} />
        <span className="text-[10px] font-medium tracking-tight">
          {t("common.sidebar.settings") || "Settings"}
        </span>
      </button>
    </nav>
  );
}

export default memo(BottomNavBar);

