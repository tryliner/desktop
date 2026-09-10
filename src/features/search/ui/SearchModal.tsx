import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search3Fill,
  Search3Line,
  CloseCircleFill,
  GridFill,
  Music2Fill,
  User2Fill,
  AlbumFill,
  PlaylistFill,
} from "@mingcute/react";
import {
  useSearchTracks,
  useSearchAll,
  useSearchArtists,
  useSearchAlbums,
  useSearchPlaylists,
} from "../hooks";
import { mediaUrl, toClientTrack, toMaxQualityAvatarUrl } from "@/shared/api";
import SearchResultsList from "./SearchResultsList";
import { useTranslation } from "@/languages";

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack: (track: any) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

type SearchFilterKey = "all" | "tracks" | "artists" | "albums" | "playlists";

const filterKeys: SearchFilterKey[] = [
  "all",
  "tracks",
  "artists",
  "albums",
  "playlists",
];

export function SearchModal({
  isOpen,
  onClose,
  onPlayTrack,
  containerRef,
}: SearchModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SearchFilterKey>("all");
  const [searchScrollMask, setSearchScrollMask] = useState(
    "linear-gradient(to bottom, black 0%, black 100%)",
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const modalRootRef = containerRef ?? internalContainerRef;

  const isAllSearchFilter = activeFilter === "all";
  const isTrackSearchFilter = activeFilter === "tracks";
  const isArtistSearchFilter = activeFilter === "artists";
  const isAlbumSearchFilter = activeFilter === "albums";
  const isPlaylistSearchFilter = activeFilter === "playlists";
  const hasSearchQuery = searchQuery.trim().length > 0;

  const filterLabels: Record<SearchFilterKey, string> = {
    all: t("common.all"),
    tracks: t("common.songs"),
    artists: t("common.artists"),
    albums: t("common.albums"),
    playlists: t("common.playlists"),
  };

  const updateSearchMask = useCallback(() => {
    const el = searchScrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const showTop = scrollTop > 4;
    const showBottom = scrollTop + clientHeight < scrollHeight - 4;

    let stops = "";
    if (showTop) stops += "transparent 0%, black 6%, ";
    else stops += "black 0%, black 6%, ";
    if (showBottom) stops += "black 94%, transparent 100%";
    else stops += "black 94%, black 100%";

    setSearchScrollMask(`linear-gradient(to bottom, ${stops})`);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }
    const id = requestAnimationFrame(() => {
      updateSearchMask();
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, updateSearchMask]);

  const {
    items: allResults,
    loading: allLoading,
    hasLoaded: allHasLoaded,
    runNow: runAllSearchNow,
    partialWarning,
  } = useSearchAll(searchQuery, {
    enabled: isOpen && isAllSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    tracks: trackResults,
    loading: trackLoading,
    hasLoaded: trackHasLoaded,
    runNow: runTrackSearchNow,
  } = useSearchTracks(searchQuery, {
    enabled: isOpen && isTrackSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    artists: artistResults,
    loading: artistLoading,
    hasLoaded: artistHasLoaded,
    runNow: runArtistSearchNow,
  } = useSearchArtists(searchQuery, {
    enabled: isOpen && isArtistSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    albums: albumResults,
    loading: albumLoading,
    hasLoaded: albumHasLoaded,
    runNow: runAlbumSearchNow,
  } = useSearchAlbums(searchQuery, {
    enabled: isOpen && isAlbumSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    playlists: playlistResults,
    loading: playlistLoading,
    hasLoaded: playlistHasLoaded,
    runNow: runPlaylistSearchNow,
  } = useSearchPlaylists(searchQuery, {
    enabled: isOpen && isPlaylistSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const searchResults = useMemo(() => {
    if (isAllSearchFilter) {
      return allResults.map((item: any) => {
        const coverUrl = item.cover
          ? mediaUrl(item.cover.url)
          : (item.coverUrl ?? "");
        if (item.type === "track") {
          const clientTrack = toClientTrack(item);
          return {
            ...clientTrack,
            ...item,
            _type: "track",
            coverUrl: clientTrack.coverUrl || coverUrl,
            artists: clientTrack.artists,
            artistId: clientTrack.artistId,
            artistList: clientTrack.artistList,
          };
        }
        if (item.type === "artist") {
          return {
            ...item,
            _type: "artist",
            title: item.name,
            coverUrl: toMaxQualityAvatarUrl(coverUrl),
            artists: "",
          };
        }
        if (item.type === "album") {
          return {
            ...item,
            _type: "album",
            coverUrl,
            artists: item.artists
              ? item.artists.map((a: any) => a.name).join(", ")
              : (item.artist ?? ""),
          };
        }
        if (item.type === "playlist") {
          return {
            ...item,
            _type: "playlist",
            coverUrl,
            artists: item.author || item.owner || "",
          };
        }
        return item;
      });
    }
    if (isTrackSearchFilter)
      return trackResults.map((t: any) => {
        const clientTrack = toClientTrack(t);
        return {
          ...clientTrack,
          ...t,
          _type: "track",
          coverUrl:
            clientTrack.coverUrl ||
            (t.cover ? mediaUrl(t.cover.url) : (t.coverUrl ?? "")),
          artists: clientTrack.artists,
          artistId: clientTrack.artistId,
          artistList: clientTrack.artistList,
        };
      });
    if (isArtistSearchFilter)
      return artistResults.map((a: any) => ({
        ...a,
        _type: "artist",
        title: a.name,
        coverUrl: toMaxQualityAvatarUrl(a.cover ? mediaUrl(a.cover.url) : (a.coverUrl ?? "")),
      }));
    if (isAlbumSearchFilter)
      return albumResults.map((a: any) => ({
        ...a,
        _type: "album",
        coverUrl: a.cover ? mediaUrl(a.cover.url) : (a.coverUrl ?? ""),
        artists: Array.isArray(a.artists)
          ? a.artists.map((ar: any) => ar.name).join(", ")
          : (a.artists ?? ""),
        artistId: a.artists?.[0]?.id,
        artistList: Array.isArray(a.artists)
          ? a.artists.map((ar: any) => ({ id: ar.id, name: ar.name }))
          : undefined,
      }));
    if (isPlaylistSearchFilter)
      return playlistResults.map((p: any) => ({
        ...p,
        _type: "playlist",
        coverUrl: p.cover ? mediaUrl(p.cover.url) : (p.coverUrl ?? ""),
      }));
    return [];
  }, [
    isAllSearchFilter,
    isTrackSearchFilter,
    isArtistSearchFilter,
    isAlbumSearchFilter,
    isPlaylistSearchFilter,
    allResults,
    trackResults,
    artistResults,
    albumResults,
    playlistResults,
  ]);

  const searchLoading = isAllSearchFilter
    ? allLoading
    : isTrackSearchFilter
      ? trackLoading
      : isArtistSearchFilter
        ? artistLoading
        : isAlbumSearchFilter
          ? albumLoading
          : playlistLoading;

  const searchHasLoaded = isAllSearchFilter
    ? allHasLoaded
    : isTrackSearchFilter
      ? trackHasLoaded
      : isArtistSearchFilter
        ? artistHasLoaded
        : isAlbumSearchFilter
          ? albumHasLoaded
          : playlistHasLoaded;

  const isSearchEmpty =
    searchQuery.trim().length >= 2 &&
    !searchLoading &&
    searchHasLoaded &&
    searchResults.length === 0;

  const runSearchNow = () => {
    if (isAllSearchFilter) {
      runAllSearchNow();
      return;
    }
    if (isTrackSearchFilter) runTrackSearchNow();
    if (isArtistSearchFilter) runArtistSearchNow();
    if (isAlbumSearchFilter) runAlbumSearchNow();
    if (isPlaylistSearchFilter) runPlaylistSearchNow();
  };

  const handleItemClick = (it: any) => {
    if ((it as any)._type === "track") {
      onPlayTrack(it);
    } else if (
      (it as any)._type === "artist" ||
      it.followers !== undefined ||
      activeFilter === "artists"
    ) {
      onClose();
      navigate(`/artist?id=${encodeURIComponent(it.id)}`);
    } else if (
      (it as any)._type === "playlist" ||
      it.owner !== undefined ||
      activeFilter === "playlists"
    ) {
      onClose();
      navigate(`/collection?type=playlist&id=${encodeURIComponent(it.id)}`);
    } else if (
      (it as any)._type === "album" ||
      it.totalTracks !== undefined ||
      it.total_tracks !== undefined ||
      activeFilter === "albums"
    ) {
      onClose();
      navigate(`/collection?type=album&id=${encodeURIComponent(it.id)}`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="search-modal-wrapper"
          ref={modalRootRef}
          initial={{ opacity: 0, y: -12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.99 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-[20px] left-[70px] right-[12px] z-[60] flex flex-col items-center pointer-events-auto select-none"
        >
          {/* 1. Sleek Floating Search Bar Island */}
          <div
            className="w-[min(660px,calc(100vw-90px))] h-[54px] rounded-[8px] bg-bg-panel/98 backdrop-blur-2xl px-[18px] flex items-center gap-[14px]"
          >
        <span className="shrink-0 flex items-center justify-center text-text-tertiary">
          <AnimatePresence mode="wait" initial={false}>
            {searchLoading ? (
              <motion.span
                key="spinner"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
                className="inline-block h-[17px] w-[17px] rounded-full border-[1.5px] border-text-secondary border-t-transparent animate-spin"
              />
            ) : (
              <motion.span
                key="search-icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
              >
                <Search3Line size={19} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <input
          ref={searchInputRef}
          type="text"
          placeholder={t("common.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearchNow();
            }
          }}
          className="w-full flex-1 bg-transparent border-none outline-none text-text-primary text-[16px] font-[400] placeholder:text-text-tertiary tracking-tight"
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            lineHeight: "1.2",
          }}
        />

        <AnimatePresence>
          {searchQuery.length > 0 && (
            <motion.button
              key="clear-btn"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
              type="button"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors border-none bg-transparent p-0 flex items-center justify-center cursor-pointer"
            >
              <CloseCircleFill size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Separate Floating Results Window Island (Only when query is present) */}
      <AnimatePresence>
        {hasSearchQuery && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{
              duration: 0.18,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="w-[min(660px,calc(100vw-90px))] mt-[8px] max-h-[500px] h-[500px] rounded-[8px] bg-bg-panel/98 backdrop-blur-2xl flex flex-col overflow-hidden"
          >
            {/* Filter Pills Bar */}
            <div className="flex items-center gap-[6px] px-[14px] pt-[12px] pb-[6px] shrink-0 overflow-x-auto">
              {filterKeys.map((key) => {
                const label = filterLabels[key];
                const isActive = activeFilter === key;
                let Icon = GridFill;
                if (key === "tracks") Icon = Music2Fill;
                else if (key === "artists") Icon = User2Fill;
                else if (key === "albums") Icon = AlbumFill;
                else if (key === "playlists") Icon = PlaylistFill;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveFilter(key)}
                    className={`
                      relative flex items-center gap-[7px] px-[13px] py-[7px] rounded-[6px] text-[13.5px] font-normal transition-colors border-none bg-transparent cursor-pointer select-none shrink-0
                      ${
                        isActive
                          ? "text-text-primary font-medium"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]"
                      }
                    `}
                    style={{
                      fontFamily: "var(--font-inter), sans-serif",
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeFilterPillModal"
                        className="absolute inset-0 rounded-[6px] bg-white/15 pointer-events-none z-0"
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 35,
                        }}
                      />
                    )}
                    <span className="relative z-[1] flex items-center gap-[7px]">
                      <Icon size={15} />
                      <span>{label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Results Content Area */}
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {isSearchEmpty ? (
                  <motion.div
                    key="search-modal-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.08 }}
                    className="flex h-full flex-col items-center justify-center gap-[6px] px-[20px] text-center"
                  >
                    <p className="m-0 text-[14px] text-text-primary font-medium">
                      {t("common.no_results")}
                    </p>
                    <p className="m-0 text-[12px] text-text-tertiary">
                      {t("common.try_another_search")}
                    </p>
                  </motion.div>
                ) : searchResults.length > 0 ? (
                  <motion.div
                    key={`search-modal-results-${activeFilter}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.08 }}
                    className="h-full w-full"
                  >
                    <SearchResultsList
                      items={searchResults}
                      isArtistSearchFilter={isArtistSearchFilter}
                      isPlaylistSearchFilter={isPlaylistSearchFilter}
                      onPlayFromSearch={onPlayTrack}
                      onNavigateItem={handleItemClick}
                      onScroll={updateSearchMask}
                      scrollRef={searchScrollRef}
                      maskStyle={{
                        WebkitMaskImage: searchScrollMask,
                        maskImage: searchScrollMask,
                      }}
                      partialWarning={partialWarning}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
