import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useTranslation } from "@/languages";

export interface SearchResultsListProps {
  items: any[];
  isArtistSearchFilter: boolean;
  isPlaylistSearchFilter: boolean;
  onPlayFromSearch: (track: any) => void;
  onNavigateItem: (item: any) => void;
  onScroll?: () => void;
  maskStyle?: React.CSSProperties;
  partialWarning?: string | null;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export const SearchResultsList = memo(function SearchResultsList({
  items,
  isArtistSearchFilter,
  isPlaylistSearchFilter,
  onPlayFromSearch,
  onNavigateItem,
  onScroll,
  maskStyle,
  partialWarning,
  scrollRef,
}: SearchResultsListProps) {
  const { t } = useTranslation();
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef ?? internalRef;

  // accurate 64px card estimate with 6px gap prevents overlap and restores spacing
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 64,
    getItemKey: (index) => items[index]?.id || index,
    gap: 6,
    overscan: 5,
  });

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto px-[14px] pt-[8px] pb-[14px]"
      style={maskStyle}
    >
      <div
        className="relative w-full"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const it = items[virtualRow.index];
          if (!it) return null;

          const isArtist =
            isArtistSearchFilter ||
            it._type === "artist" ||
            it.followers !== undefined;
          const isAlbumOrPlaylist =
            isPlaylistSearchFilter ||
            it._type === "playlist" ||
            it._type === "album";

          const subtitle =
            isArtist && it.followers
              ? t("common.followers", { count: it.followers.toLocaleString() })
              : isAlbumOrPlaylist &&
                  (it.totalTracks !== undefined || it.total_tracks !== undefined)
                ? `${it.totalTracks ?? it.total_tracks} ${t("common.tracks")}`
                : it.artists || it.artist || it.owner || "";

          const durationMs = it.durationMs ?? it.duration_ms;
          const durationStr = durationMs
            ? `${Math.floor(durationMs / 60000)}:${Math.floor(
                (durationMs % 60000) / 1000,
              )
                .toString()
                .padStart(2, "0")}`
            : "";

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SongCardWithMenu
                id={it.id}
                title={it.title || it.name || ""}
                artistId={it.artistId ?? it.artist_id}
                artistList={it.artistList}
                artists={subtitle}
                coverUrl={it.coverUrl || it.imageUrl || ""}
                explicit={it.explicit}
                imageShape={isArtist ? "circle" : "square"}
                duration={durationStr}
                durationMs={durationMs}
                searchType={it._type}
                totalTracks={it.totalTracks ?? it.total_tracks}
                onPlay={
                  it._type === "track"
                    ? () => onPlayFromSearch(it)
                    : () => onNavigateItem(it)
                }
                onNavigate={() => onNavigateItem(it)}
              />
            </div>
          );
        })}
      </div>
      {partialWarning ? (
        <div className="text-accent-tertiary text-[12px] px-[8px] py-[6px] mt-[6px]">
          {partialWarning}
        </div>
      ) : null}
    </div>
  );
});

export default SearchResultsList;
