import { motion } from "framer-motion";
import type { LibraryTab } from "../types";
import { useTranslation } from "@/languages";
import { useIsContentTransparent } from "@/features/settings/store/customizationStore";

interface LibraryTabsProps {
  activeTab: LibraryTab;
  onChange: (tab: LibraryTab) => void;
}

const tabs: LibraryTab[] = ["playlists", "albums", "artists"];

export default function LibraryTabs({
  activeTab,
  onChange,
}: LibraryTabsProps) {
  const { t } = useTranslation();
  const hasCustomBg = useIsContentTransparent();

  const tabLabels: Record<LibraryTab, string> = {
    playlists: t("library.tab_playlists"),
    albums: t("library.tab_albums"),
    artists: t("library.tab_artists"),
  };

  return (
    <div
      className={`inline-flex items-center gap-[4px] rounded-xl p-[4px] ${
        hasCustomBg
          ? "apple-glass-pill"
          : "bg-bg-elevated"
      }`}
    >
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`relative inline-flex items-center justify-center rounded-lg px-[16px] py-[7px] text-[13px] leading-none transition-colors duration-150 border-0 bg-transparent cursor-pointer select-none active:scale-[0.97] ${
              isActive
                ? hasCustomBg
                  ? "text-white dark:text-black font-semibold"
                  : "text-text-primary"
                : hasCustomBg
                  ? "text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
                  : "text-text-secondary hover:text-text-primary"
            }`}
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {isActive && (
              <motion.div
                layoutId="activeLibraryTab"
                className={`absolute inset-0 rounded-lg ${
                  hasCustomBg
                    ? "apple-glass-prominent"
                    : "bg-border-alpha-14"
                }`}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 35,
                }}
              />
            )}
            <span className="relative z-10">{tabLabels[tab]}</span>
          </button>
        );
      })}
    </div>
  );
}
