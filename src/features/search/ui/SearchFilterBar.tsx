import { memo, type ComponentType } from "react";
import { motion } from "framer-motion";
import { AlbumFill, GridFill, Music2Fill, PlaylistFill, User2Fill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import SearchSourceHub from "./SearchSourceHub";

export type SearchFilterKey = "all" | "tracks" | "artists" | "albums" | "playlists";

export interface SearchFilterBarProps {
  activeFilter: SearchFilterKey;
  onChange: (filter: SearchFilterKey) => void;
}

const FILTERS: Array<{
  key: SearchFilterKey;
  labelKey: string;
  icon: ComponentType<{ size?: number | string }>;
}> = [
  { key: "all", labelKey: "common.all", icon: GridFill },
  { key: "tracks", labelKey: "common.songs", icon: Music2Fill },
  { key: "artists", labelKey: "common.artists", icon: User2Fill },
  { key: "albums", labelKey: "common.albums", icon: AlbumFill },
  { key: "playlists", labelKey: "common.playlists", icon: PlaylistFill },
];

export const SearchFilterBar = memo(function SearchFilterBar({
  activeFilter,
  onChange,
}: SearchFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div
      role="toolbar"
      aria-label={t("common.search")}
      className="flex shrink-0 gap-[6px] overflow-x-auto px-[14px] pt-[8px] pb-[6px]"
    >
      {FILTERS.map(({ key, labelKey, icon: Icon }) => {
        const label = t(labelKey);
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onChange(key)}
            className={`relative flex shrink-0 cursor-pointer select-none items-center gap-[7px] rounded-[6px] border-none bg-transparent px-[13px] py-[7px] text-[13.5px] font-normal transition-colors ${
              isActive
                ? "font-medium text-text-primary"
                : "text-text-secondary hover:bg-border-alpha-14 hover:text-text-primary"
            }`}
            style={{ fontFamily: "var(--font-inter), sans-serif", lineHeight: "1.2" }}
          >
            {isActive && (
              <motion.span
                layoutId="activeFilterPill"
                className="pointer-events-none absolute inset-0 z-0 rounded-[6px] bg-border-alpha-14"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-[1] flex items-center gap-[7px]">
              <Icon size={15} />
              <span>{label}</span>
            </span>
          </button>
        );
      })}
      <SearchSourceHub />
    </div>
  );
});

export default SearchFilterBar;
