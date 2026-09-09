import { motion } from "framer-motion";
import type { LibraryTab } from "../types";
import { useTranslation } from "@/languages";

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
  const tabLabels: Record<LibraryTab, string> = {
    playlists: t("library.tab_playlists"),
    albums: t("library.tab_albums"),
    artists: t("library.tab_artists"),
  };

  return (
    <div className="inline-flex items-center gap-[4px] rounded-xl bg-bg-elevated border border-border-primary p-[4px]">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`relative inline-flex items-center justify-center rounded-lg px-[16px] py-[7px] text-[13px] leading-none transition-colors duration-150 border-0 bg-transparent cursor-pointer select-none active:scale-[0.97] ${
              isActive
                ? "text-text-primary"
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
                className="absolute inset-0 rounded-lg bg-border-alpha-14 shadow-sm"
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
