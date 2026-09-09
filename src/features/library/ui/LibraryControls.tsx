import { AnimatePresence, motion } from "framer-motion";
import {
  Search2Line,
  AddLine,
  Search3Fill,
  GridLine,
  GridFill,
  ListCheckLine,
  ListCheckFill,
} from "@mingcute/react";
import TextInput from "@/shared/ui/TextInput";
import type { LibraryTab, LibraryViewMode } from "../types";
import { useTranslation } from "@/languages";

import { useModalStore } from "../store/modalStore";

interface LibraryControlsProps {
  activeTab: LibraryTab;
  query: string;
  onQueryChange: (query: string) => void;
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
}

export default function LibraryControls({
  activeTab,
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
}: LibraryControlsProps) {
  const { t } = useTranslation();
  const openCreatePlaylist = useModalStore((state) => state.openCreatePlaylist);
  const openSearch = useModalStore((state) => state.openSearch);

  const placeholderByTab: Record<LibraryTab, string> = {
    playlists: t("library.search_playlists"),
    albums: t("library.search_albums"),
    artists: t("library.search_artists"),
  };

  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <TextInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholderByTab[activeTab]}
        icon={<Search2Line size={16} />}
        className="!h-[34px] w-[220px] md:w-[260px] rounded-lg border-border-primary bg-bg-elevated"
      />

      <div className="inline-flex items-center rounded-lg bg-bg-elevated border border-border-primary p-[2px]">
        <button
          type="button"
          title={t("library.view_grid")}
          aria-label={t("library.view_grid")}
          onClick={() => onViewModeChange("grid")}
          className={`inline-flex items-center justify-center h-[28px] w-[30px] rounded-[6px] border-0 transition-colors cursor-pointer select-none active:scale-[0.95] ${
            viewMode === "grid"
              ? "bg-border-alpha-14 text-text-primary"
              : "bg-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {viewMode === "grid" ? (
            <GridFill size={16} />
          ) : (
            <GridLine size={16} />
          )}
        </button>
        <button
          type="button"
          title={t("library.view_list")}
          aria-label={t("library.view_list")}
          onClick={() => onViewModeChange("list")}
          className={`inline-flex items-center justify-center h-[28px] w-[30px] rounded-[6px] border-0 transition-colors cursor-pointer select-none active:scale-[0.95] ${
            viewMode === "list"
              ? "bg-border-alpha-14 text-text-primary"
              : "bg-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {viewMode === "list" ? (
            <ListCheckFill size={16} />
          ) : (
            <ListCheckLine size={16} />
          )}
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === "playlists" ? (
          <motion.button
            key="create-btn"
            initial={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            type="button"
            onClick={() => openCreatePlaylist()}
            className="inline-flex items-center gap-[6px] !h-[34px] rounded-lg px-[14px] text-[13px] font-[500] bg-btn-primary-bg text-btn-primary-text hover:opacity-90 active:scale-[0.96] transition-all border-0 cursor-pointer shadow-sm"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            <AddLine size={16} />
            <span>{t("common.create")}</span>
          </motion.button>
        ) : (
          <motion.button
            key="search-btn"
            initial={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            type="button"
            onClick={() => openSearch()}
            className="inline-flex items-center gap-[6px] !h-[34px] rounded-lg px-[14px] text-[13px] font-[500] bg-bg-elevated border border-border-primary text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 active:scale-[0.96] transition-all cursor-pointer"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            <Search3Fill size={15} />
            <span>{t("library.find_music")}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
