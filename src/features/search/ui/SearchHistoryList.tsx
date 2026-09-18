import { memo, useRef } from "react";
import { CloseLine, Search3Line } from "@mingcute/react";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useTranslation } from "@/languages";
import { useSearchHistoryStore } from "../store/searchHistoryStore";

export interface SearchHistoryListProps {
  onSelectQuery: (query: string) => void;
  onPlayTrack: (track: any) => void;
  onNavigateItem: (item: any) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
  maskStyle?: React.CSSProperties;
}

export const SearchHistoryList = memo(function SearchHistoryList({
  onSelectQuery,
  onPlayTrack,
  onNavigateItem,
  scrollRef,
  onScroll,
  maskStyle,
}: SearchHistoryListProps) {
  const { t } = useTranslation();
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef ?? internalRef;

  const items = useSearchHistoryStore((state) => state.items);
  const removeItem = useSearchHistoryStore((state) => state.removeItem);
  const clearHistory = useSearchHistoryStore((state) => state.clearHistory);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto px-[14px] pt-[8px] pb-[14px]"
      style={maskStyle}
    >
      <div className="flex items-center justify-between px-[6px] pt-[4px] pb-[10px]">
        <span className="text-[13px] font-medium text-text-secondary tracking-tight">
          {t("common.recent_searches")}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={clearHistory}
          className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors border-none bg-transparent cursor-pointer p-0 select-none"
        >
          {t("common.clear_recent")}
        </button>
      </div>

      <div className="flex flex-col gap-[6px]">
        {items.map((item) => {
          if (item.type === "query") {
            return (
              <div
                key={item.id}
                onClick={() => onSelectQuery(item.title)}
                className="group relative flex items-center justify-between px-[12px] py-[9px] rounded-[8px] hover:bg-border-alpha-14 cursor-pointer transition-colors select-none"
              >
                <div className="flex items-center gap-[12px] min-w-0">
                  <span className="shrink-0 text-text-tertiary group-hover:text-text-primary transition-colors">
                    <Search3Line size={17} />
                  </span>
                  <span className="truncate text-[14.5px] font-[400] text-text-primary">
                    {item.title}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Remove"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-opacity p-[4px] rounded hover:bg-border-alpha-14 border-none bg-transparent flex items-center justify-center cursor-pointer"
                >
                  <CloseLine size={16} />
                </button>
              </div>
            );
          }

          const isArtist = item.type === "artist";
          const data = item.itemData ?? item;

          return (
            <div
              key={item.id}
              className="group relative flex items-center w-full min-w-0"
            >
              <div className="flex-1 min-w-0">
                <SongCardWithMenu
                  id={item.id}
                  title={item.title}
                  artistId={data?.artistId ?? data?.artist_id}
                  artistList={data?.artistList}
                  artists={item.subtitle || ""}
                  coverUrl={item.coverUrl || ""}
                  explicit={item.explicit}
                  imageShape={isArtist ? "circle" : "square"}
                  duration={item.duration}
                  durationMs={item.durationMs}
                  searchType={item.type}
                  totalTracks={data?.totalTracks ?? data?.total_tracks}
                  onPlay={
                    item.type === "track"
                      ? () => onPlayTrack(data)
                      : () => onNavigateItem(data)
                  }
                  onNavigate={() => onNavigateItem(data)}
                />
              </div>
              <button
                type="button"
                aria-label="Remove"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-opacity p-[6px] rounded-md hover:bg-border-alpha-14 cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0 ml-[4px]"
              >
                <CloseLine size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default SearchHistoryList;
