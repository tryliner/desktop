import {
  Search2Line,
  GridLine,
  GridFill,
  ListCheckLine,
  ListCheckFill,
} from "@mingcute/react";
import TextInput from "@/shared/ui/TextInput";
import type { LibraryTab, LibraryViewMode } from "../types";
import { useTranslation } from "@/languages";

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
    </div>
  );
}
