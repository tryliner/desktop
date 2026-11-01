import {
  Search2Line,
  CloseLine,
  AddLine,
  GridLine,
  GridFill,
  ListCheckLine,
  ListCheckFill,
} from "@mingcute/react";
import Button from "@/shared/ui/Button";
import {
  HERO_BUTTON_CLASS,
  HERO_GLASS_BUTTON_CLASS,
  HERO_GLASS_CLASS,
} from "@/shared/ui";
import type { LibraryTab, LibraryViewMode } from "../types";
import { useTranslation } from "@/languages";

interface LibraryControlsProps {
  activeTab: LibraryTab;
  query: string;
  onQueryChange: (query: string) => void;
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
  /** shown only when provided (playlist tabs) */
  onCreatePlaylist?: () => void;
}

export default function LibraryControls({
  activeTab,
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  onCreatePlaylist,
}: LibraryControlsProps) {
  const { t } = useTranslation();

  const placeholderByTab: Record<LibraryTab, string> = {
    all: t("library.search_all"),
    playlists: t("library.search_playlists"),
    albums: t("library.search_albums"),
    artists: t("library.search_artists"),
  };

  const iconButtonClass = `${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`;

  return (
    <div className="flex flex-wrap items-center gap-[8px]">
      <div
        role="search"
        data-no-window-drag
        className={`flex h-[32px] w-[220px] items-center gap-[8px] rounded-[9px] px-[10px] text-text-primary ${HERO_GLASS_CLASS}`}
      >
        <Search2Line size={16} className="shrink-0 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholderByTab[activeTab]}
          aria-label={placeholderByTab[activeTab]}
          spellCheck={false}
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              onQueryChange("");
            }
          }}
          className="h-[32px] min-w-0 flex-1 border-none bg-transparent p-0 text-[14px] leading-[32px] font-[400] text-text-primary outline-none placeholder:text-text-secondary"
        />
        {query.length > 0 && (
          <button
            type="button"
            aria-label={t("track_search.clear")}
            data-no-tooltip="true"
            onClick={() => onQueryChange("")}
            className="-mr-[2px] flex shrink-0 items-center justify-center border-none bg-transparent p-0 cursor-pointer text-text-tertiary transition-colors hover:text-text-primary"
          >
            <CloseLine size={16} />
          </button>
        )}
      </div>

      <Button
        variant="secondary"
        data-no-tooltip="true"
        aria-label={t("library.view_grid")}
        aria-pressed={viewMode === "grid"}
        onClick={() => onViewModeChange("grid")}
        className={`${iconButtonClass} ${
          viewMode === "grid"
            ? ""
            : "!text-text-tertiary hover:!text-text-primary"
        }`}
      >
        {viewMode === "grid" ? <GridFill size={16} /> : <GridLine size={16} />}
      </Button>
      <Button
        variant="secondary"
        data-no-tooltip="true"
        aria-label={t("library.view_list")}
        aria-pressed={viewMode === "list"}
        onClick={() => onViewModeChange("list")}
        className={`${iconButtonClass} ${
          viewMode === "list"
            ? ""
            : "!text-text-tertiary hover:!text-text-primary"
        }`}
      >
        {viewMode === "list" ? (
          <ListCheckFill size={16} />
        ) : (
          <ListCheckLine size={16} />
        )}
      </Button>
      {onCreatePlaylist && (
        <Button
          variant="primary"
          onClick={onCreatePlaylist}
          className={`${HERO_BUTTON_CLASS} px-[16px]`}
          title={t("library.create_playlist")}
        >
          <AddLine size={16} />
          <span>{t("library.create_playlist")}</span>
        </Button>
      )}
    </div>
  );
}
