import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  collectionPath,
  collectionPreviewState,
} from "@/features/collection/lib/collectionPreview";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search3Line,
  CloseCircleFill,
  GridFill,
  Music2Fill,
  User2Fill,
  AlbumFill,
  PlaylistFill,
} from "@mingcute/react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { cn } from "@/shared/lib";
import WindowControlsNotch from "./WindowControlsNotch";
import RightDrawer from "./RightDrawer";
import { FullscreenRouteContext } from "../fullscreenRouteContext";
import DynamicBlurBackground from "./DynamicBlurBackground";
import AmbientTopGlow from "./AmbientTopGlow";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { useDisableButtonFocus } from "../hooks/useDisableButtonFocus";
import { useWindowState } from "../hooks/useWindowState";
import {
  useSearchTracks,
  useSearchAll,
  useSearchArtists,
  useSearchAlbums,
  useSearchPlaylists,
} from "@/features/search/hooks";
import { mediaUrl, toClientTrack, toMaxQualityAvatarUrl } from "@/shared/api";
import {
  FullscreenPlayer,
  playerEngine,
  MiniPlayer,
  usePlayerStore,
  useGlassBlur,
} from "@/features/player";
import SearchResultsList from "@/features/search/ui/SearchResultsList";
import { SearchHistoryList, useSearchHistoryStore } from "@/features/search";
import { useTranslation } from "@/languages";
import { useTheme } from "next-themes";
import {
  AddToPlaylistModal,
  AddToLibraryModal,
  RemoveFromPlaylistModal,
  RemoveFromLibraryModal,
  ImportLikesModal,
  ImportReviewModal,
  LocalDropZone,
  CreatePlaylistModal,
  useModalStore,
} from "@/features/library";
import {
  SettingsModal,
  useHasPageBackdrop,
  useClassicSurfaces,
} from "@/features/settings";
import { UpdateModal, UpdateToastBridge } from "@/features/updater";
import { YoutubeSignInNotice } from "@/features/youtube-auth";
import { useOfflineModeStore } from "@/features/connectivity";

interface AppFrameProps {
  children: React.ReactNode;
}

const RIGHT_DRAWER_WIDTH = 440;
const SIDEBAR_WIDTH = 58;
const SHELL_EDGE_GAP = 6;
const SEARCH_QUERY_CACHE_TTL_MS = 60_000;
const LEGACY_LAYOUT_STORAGE_KEYS = [
  "liner_right_sidebar",
  "liner_sidebar_position",
  "liner_sidebar_width",
  "liner_queue_popup_open",
] as const;

const AppOverlays = memo(function AppOverlays() {
  return (
    <>
      <AddToPlaylistModal />
      <AddToLibraryModal />
      <RemoveFromPlaylistModal />
      <RemoveFromLibraryModal />
      <ImportLikesModal />
      <CreatePlaylistModal />
      <ImportReviewModal />
      <LocalDropZone />
      <SettingsModal />
      <UpdateModal />
      <YoutubeSignInNotice />
      <UpdateToastBridge />
    </>
  );
});

export default function AppFrame({ children }: AppFrameProps) {
  const location = useLocation();
  const { pathname, search } = location;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isEdgeToEdge } = useWindowState();

  const searchOpen = useModalStore((state) => state.searchOpen);
  const openSearch = useModalStore((state) => state.openSearch);
  const closeSearch = useModalStore((state) => state.closeSearch);
  const toggleSearch = useModalStore((state) => state.toggleSearch);
  const openSettings = useModalStore((state) => state.openSettings);
  const offline = useOfflineModeStore((state) => state.offline);

  const [searchQuery, setSearchQuery] = useState("");
  const [queuePopupOpen, setQueuePopupOpen] = useState(false);
  const fullscreenPlayerOpen = usePlayerStore((state) => state.fullscreen);
  const setFullscreenPlayerOpen = usePlayerStore(
    (state) => state.setFullscreen,
  );
  const [fullscreenEffectsReady, setFullscreenEffectsReady] = useState(false);

  useEffect(() => {
    if (pathname === "/settings") {
      openSettings();
      navigate("/", { replace: true });
    }
  }, [pathname, openSettings, navigate]);

  useEffect(() => {
    if (offline && searchOpen) closeSearch();
  }, [offline, searchOpen, closeSearch]);

  useEffect(() => {
    for (const key of LEGACY_LAYOUT_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  }, []);

  const handleQueuePopupToggle = useCallback((open: boolean) => {
    setQueuePopupOpen(open);
  }, []);

  const handleQueuePopupToggleRequest = useCallback(() => {
    setQueuePopupOpen((current) => !current);
  }, []);

  const shouldShowMiniPlayer = useSyncExternalStore(
    playerEngine.subscribe,
    () => {
      const state = playerEngine.getSnapshot();
      return state.currentTrack !== null && state.status !== "idle";
    },
    () => false,
  );

  const hasCurrentTrack = useSyncExternalStore(
    playerEngine.subscribe,
    () => playerEngine.getSnapshot().currentTrack !== null,
    () => false,
  );

  const appFrameRef = useRef<HTMLDivElement>(null);
  const queueDrawerRef = useRef<HTMLDivElement>(null);
  const searchPopupRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const prevLocationRef = useRef(pathname + search);

  useEffect(() => {
    if (prevLocationRef.current !== pathname + search) {
      prevLocationRef.current = pathname + search;
      if (searchOpen && searchQuery.trim().length === 0) {
        closeSearch();
      }
    }
  }, [pathname, search, searchOpen, searchQuery, closeSearch]);

  useLayoutEffect(() => {
    const main = mainScrollRef.current;
    if (main && main.scrollTop !== 0) main.scrollTop = 0;
  }, [pathname, search]);

  const updateSearchMask = useCallback(() => {
    const el = searchScrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const showTop = scrollTop > 1;
    const showBottom = scrollTop + clientHeight < scrollHeight - 1;

    let stops = "";
    if (showTop) stops += "transparent 0%, black 7%, ";
    else stops += "black 0%, black 7%, ";
    if (showBottom) stops += "black 93%, transparent 100%";
    else stops += "black 93%, black 100%";

    setSearchScrollMask(`linear-gradient(to bottom, ${stops})`);
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      const timeoutId = setTimeout(() => {
        setSearchQuery("");
      }, SEARCH_QUERY_CACHE_TTL_MS);
      return () => clearTimeout(timeoutId);
    }
    const id = requestAnimationFrame(updateSearchMask);
    requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [searchOpen, updateSearchMask]);

  const miniPlayerContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  type SearchFilterKey = "all" | "tracks" | "artists" | "albums" | "playlists";
  const filterKeys: SearchFilterKey[] = [
    "all",
    "tracks",
    "artists",
    "albums",
    "playlists",
  ];
  const filterLabels: Record<SearchFilterKey, string> = {
    all: t("common.all"),
    tracks: t("common.songs"),
    artists: t("common.artists"),
    albums: t("common.albums"),
    playlists: t("common.playlists"),
  };

  const [activeFilter, setActiveFilter] = useState<SearchFilterKey>("all");
  const isAllSearchFilter = activeFilter === "all";
  const isTrackSearchFilter = activeFilter === "tracks";
  const isArtistSearchFilter = activeFilter === "artists";
  const isAlbumSearchFilter = activeFilter === "albums";
  const isPlaylistSearchFilter = activeFilter === "playlists";
  const hasSearchQuery = searchQuery.trim().length > 0;
  const isFullscreenRoute = pathname === "/player";
  const isFullscreenPlayer = isFullscreenRoute || fullscreenPlayerOpen;
  const shellChildrenRef = useRef<React.ReactNode>(null);
  if (!isFullscreenRoute) {
    shellChildrenRef.current = children;
  }
  const isRightDrawerOpen =
    queuePopupOpen && !searchOpen && !isFullscreenPlayer;

  const openFullscreenPlayer = useCallback(() => {
    setFullscreenPlayerOpen(true);
  }, [setFullscreenPlayerOpen]);

  const closeFullscreenPlayer = useCallback(() => {
    setFullscreenPlayerOpen(false);
  }, [setFullscreenPlayerOpen]);

  const handleCloseFullscreen = useCallback(() => {
    if (fullscreenPlayerOpen) {
      setFullscreenPlayerOpen(false);
    } else if (isFullscreenRoute) {
      navigate("/", { replace: true });
    }
  }, [
    fullscreenPlayerOpen,
    isFullscreenRoute,
    navigate,
    setFullscreenPlayerOpen,
  ]);

  useEffect(() => {
    if (isFullscreenPlayer && !hasCurrentTrack) {
      handleCloseFullscreen();
    }
  }, [isFullscreenPlayer, hasCurrentTrack, handleCloseFullscreen]);

  const openRightPanel = useCallback(() => setQueuePopupOpen(true), []);
  const closeRightPanel = useCallback(() => setQueuePopupOpen(false), []);

  const isBackNavigableRoute =
    pathname === "/artist" ||
    pathname === "/library/playlist" ||
    pathname === "/library/local" ||
    pathname === "/library/cached" ||
    pathname === "/library/saved" ||
    pathname === "/collection";
  const handleEscapeFallback = useCallback(() => {
    if (queuePopupOpen || searchOpen || isFullscreenPlayer) return false;
    if (!isBackNavigableRoute) return false;
    if (window.history.length > 1) navigate(-1);
    else navigate("/library");
    return true;
  }, [
    isBackNavigableRoute,
    queuePopupOpen,
    searchOpen,
    isFullscreenPlayer,
    navigate,
  ]);

  useDisableButtonFocus();

  useGlobalShortcuts({
    searchOpen,
    openSearch,
    closeSearch,
    rightPanelOpen: queuePopupOpen,
    openRightPanel,
    closeRightPanel,
    fullscreenOpen: isFullscreenPlayer,
    openFullscreen: openFullscreenPlayer,
    closeFullscreen: handleCloseFullscreen,
    onEscapeFallback: handleEscapeFallback,
  });
  const [searchScrollMask, setSearchScrollMask] = useState(
    "linear-gradient(to bottom, black 0%, black 100%)",
  );
  const addHistoryItem = useSearchHistoryStore((state) => state.addItem);
  const historyItems = useSearchHistoryStore((state) => state.items);
  const {
    items: allResults,
    loading: allLoading,
    hasLoaded: allHasLoaded,
    runNow: runAllSearchNow,
    partialWarning,
  } = useSearchAll(searchQuery, {
    enabled: searchOpen && isAllSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    tracks: trackResults,
    loading: trackLoading,
    hasLoaded: trackHasLoaded,
    runNow: runTrackSearchNow,
  } = useSearchTracks(searchQuery, {
    enabled: searchOpen && isTrackSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    artists: artistResults,
    loading: artistLoading,
    hasLoaded: artistHasLoaded,
    runNow: runArtistSearchNow,
  } = useSearchArtists(searchQuery, {
    enabled: searchOpen && isArtistSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    albums: albumResults,
    loading: albumLoading,
    hasLoaded: albumHasLoaded,
    runNow: runAlbumSearchNow,
  } = useSearchAlbums(searchQuery, {
    enabled: searchOpen && isAlbumSearchFilter,
    limit: 20,
    debounceMs: 320,
  });

  const {
    playlists: playlistResults,
    loading: playlistLoading,
    hasLoaded: playlistHasLoaded,
    runNow: runPlaylistSearchNow,
  } = useSearchPlaylists(searchQuery, {
    enabled: searchOpen && isPlaylistSearchFilter,
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
            artists: Array.isArray(item.artists)
              ? item.artists.map((a: any) => a.name).join(", ")
              : (item.artists ?? ""),
            artistId: item.artists?.[0]?.id,
            artistList: Array.isArray(item.artists)
              ? item.artists.map((a: any) => ({ id: a.id, name: a.name }))
              : undefined,
          };
        }
        return {
          ...item,
          _type: item.type,
          coverUrl,
          artists: item.author ?? item.artists ?? "",
          artistId: item.artists?.[0]?.id,
          artistList: Array.isArray(item.artists)
            ? item.artists.map((a: any) => ({ id: a.id, name: a.name }))
            : undefined,
        };
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
        coverUrl: toMaxQualityAvatarUrl(
          a.cover ? mediaUrl(a.cover.url) : (a.coverUrl ?? ""),
        ),
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

  useEffect(() => {
    if (isFullscreenPlayer) {
      setQueuePopupOpen(false);
      closeSearch();
    }
  }, [isFullscreenPlayer, closeSearch]);

  useEffect(() => {
    const onGlobalPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (
        target instanceof Element &&
        (target.closest("[data-dialog-container]") ||
          target.closest("[data-dialog-backdrop]") ||
          target.closest("[data-dropdown-menu]") ||
          // a toast action (e.g. Undo after removing a queue track) must not close the open drawer
          target.closest("[data-toast]"))
      ) {
        return;
      }
      if (searchOpen) {
        if (searchPopupRef.current?.contains(target)) {
          return;
        }
        if (sidebarRef.current?.contains(target)) {
          return;
        }
        closeSearch();
      }
      if (queuePopupOpen) {
        if (queueDrawerRef.current?.contains(target)) {
          return;
        }
        if (miniPlayerContainerRef.current?.contains(target)) {
          return;
        }
        if (sidebarRef.current?.contains(target)) {
          return;
        }
        if (
          event.clientY <= 32 ||
          (target instanceof Element && target.closest("[data-window-drag]"))
        ) {
          return;
        }
        if (queuePopupOpen) {
          handleQueuePopupToggle(false);
        }
      }
    };

    document.addEventListener("mousedown", onGlobalPointerDown, true);
    return () => {
      document.removeEventListener("mousedown", onGlobalPointerDown, true);
    };
  }, [searchOpen, queuePopupOpen, handleQueuePopupToggle, closeSearch]);

  const handleSearchToggle = useCallback(() => {
    toggleSearch();
  }, [toggleSearch]);

  const handlePlayFromSearch = useCallback(
    (track: any) => {
      playerEngine.primeUserGesture();
      if (!track) {
        return;
      }
      const durationMs = track.durationMs ?? track.duration_ms;
      const durationStr = durationMs
        ? `${Math.floor(durationMs / 60000)}:${Math.floor(
            (durationMs % 60000) / 1000,
          )
            .toString()
            .padStart(2, "0")}`
        : "";
      addHistoryItem({
        id: track.id,
        type: "track",
        title: track.title,
        subtitle: track.artists,
        coverUrl: track.coverUrl,
        explicit: track.explicit,
        duration: durationStr,
        durationMs,
        itemData: track,
      });
      void playerEngine.playTrack(
        track,
        [track],
        `${track.title} Radio`,
        track.coverUrl,
      );
    },
    [addHistoryItem],
  );

  const handleNavigateItem = useCallback(
    (it: any) => {
      closeSearch();
      if (
        it._type === "artist" ||
        it.followers !== undefined ||
        activeFilter === "artists"
      ) {
        addHistoryItem({
          id: it.id,
          type: "artist",
          title: it.name || it.title,
          subtitle: t("common.artists"),
          coverUrl: it.coverUrl,
          itemData: it,
        });
        navigate(`/artist?id=${encodeURIComponent(it.id)}`);
      } else if (
        it._type === "playlist" ||
        it.owner !== undefined ||
        activeFilter === "playlists"
      ) {
        addHistoryItem({
          id: it.id,
          type: "playlist",
          title: it.name || it.title,
          subtitle: it.author || it.owner || t("common.playlists"),
          coverUrl: it.coverUrl,
          itemData: it,
        });
        navigate(collectionPath("playlist", it.id), {
          state: collectionPreviewState({
            coverUrl: it.coverUrl,
            title: it.name || it.title,
            subtitle: it.author || it.owner,
          }),
        });
      } else if (
        it._type === "album" ||
        it.totalTracks !== undefined ||
        it.total_tracks !== undefined ||
        activeFilter === "albums"
      ) {
        addHistoryItem({
          id: it.id,
          type: "album",
          title: it.name || it.title,
          subtitle: it.artists || it.artist || t("common.albums"),
          coverUrl: it.coverUrl,
          itemData: it,
        });
        navigate(collectionPath("album", it.id), {
          state: collectionPreviewState({
            coverUrl: it.coverUrl,
            title: it.name || it.title,
            subtitle: it.artists || it.artist,
          }),
        });
      }
    },
    [activeFilter, closeSearch, navigate, addHistoryItem, t],
  );

  const submitSearchQuery = useCallback(
    (queryToSubmit: string) => {
      const trimmed = queryToSubmit.trim();
      if (!trimmed) return;
      addHistoryItem({
        id: `query:${trimmed.toLowerCase()}`,
        type: "query",
        title: trimmed,
      });
    },
    [addHistoryItem],
  );

  const handleSelectHistoryQuery = useCallback(
    (queryText: string) => {
      setSearchQuery(queryText);
      submitSearchQuery(queryText);
      searchInputRef.current?.focus();
    },
    [submitSearchQuery],
  );

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme
    ? resolvedTheme === "dark"
    : typeof document !== "undefined" &&
      (document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.getAttribute("data-theme") &&
          window.matchMedia?.("(prefers-color-scheme: dark)")?.matches));
  const hasPageBackdrop = useHasPageBackdrop();
  const classicSurfaces = useClassicSurfaces();
  const glassBlur = useGlassBlur();

  return (
    <div
      ref={appFrameRef}
      className={`app-shell-enter relative flex flex-col h-full w-full overflow-hidden p-1.5 gap-1.5 ${
        isFullscreenPlayer ? "bg-black" : "bg-bg-canvas"
      } ${isEdgeToEdge ? "rounded-none" : "rounded-[12px]"}`}
      style={isEdgeToEdge ? undefined : { clipPath: "inset(0 round 12px)" }}
      onScroll={(e) => {
        if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
        if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
      }}
    >
      {classicSurfaces ? (
        isDark ? (
          <AmbientTopGlow />
        ) : null
      ) : (
        <DynamicBlurBackground isDark={isDark} />
      )}

      <AnimatePresence>
        {!isFullscreenPlayer && (
          <motion.div
            key="app-header-container"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-x-1.5 top-1.5 z-[45]"
          >
            <Header
              searchOpen={searchOpen}
              onSearchToggle={handleSearchToggle}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 flex flex-row w-full gap-1.5 overflow-hidden relative z-10">
        <aside
          ref={sidebarRef}
          className="w-[58px] mt-[56px] shrink-0 z-[45] relative flex flex-col"
        >
          <Sidebar
            searchOpen={searchOpen}
            onSearchToggle={handleSearchToggle}
          />
        </aside>

        <div className="flex-1 flex flex-col min-w-0 h-full relative gap-1.5 overflow-hidden">
          <main
            className={cn(
              "flex-1 min-w-0 flex flex-col relative h-full overflow-hidden [--page-inset-top:56px]",
              "rounded-xl",
              shouldShowMiniPlayer && hasPageBackdrop
                ? "[--page-inset-bottom:64px] [--floating-inset-bottom:70px]"
                : "[--page-inset-bottom:0px] [--floating-inset-bottom:0px]",
            )}
          >
            <div
              ref={mainScrollRef}
              className={`h-full ${
                searchOpen || isFullscreenPlayer
                  ? "overflow-hidden"
                  : "overflow-y-auto"
              }`}
            >
              <div className="h-full w-full">
                {isFullscreenRoute ? shellChildrenRef.current : children}
              </div>
            </div>

            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 bg-black/12 backdrop-blur-[2px] pointer-events-auto z-[30]"
                  onClick={() => closeSearch()}
                />
              )}
            </AnimatePresence>

            {!isFullscreenPlayer && (
              <AnimatePresence initial={false}>
                {isRightDrawerOpen && (
                  <motion.aside
                    key="right-drawer"
                    ref={queueDrawerRef}
                    initial={{ x: RIGHT_DRAWER_WIDTH }}
                    animate={{ x: 0 }}
                    exit={{ x: RIGHT_DRAWER_WIDTH }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-auto absolute top-(--page-inset-top) bottom-(--floating-inset-bottom) right-0 z-[50]"
                    style={{ width: RIGHT_DRAWER_WIDTH }}
                  >
                    <RightDrawer onClose={closeRightPanel} />
                  </motion.aside>
                )}
              </AnimatePresence>
            )}
          </main>

          {shouldShowMiniPlayer && (
            <div
              ref={miniPlayerContainerRef}
              // Above the right drawer (z-50) so the player's volume/speed/queue
              // popups, which live in this stacking context, aren't hidden by it.
              className={`relative z-[55] w-full shrink-0 ${hasPageBackdrop ? "-mt-[70px]" : ""}`}
            >
              <MiniPlayer
                embedded
                onQueueOpenChange={handleQueuePopupToggle}
                onQueueToggle={handleQueuePopupToggleRequest}
                onFullscreenOpen={openFullscreenPlayer}
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {fullscreenPlayerOpen ? (
          <motion.div
            key="fullscreen-player-overlay"
            data-theme="dark"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() =>
              setFullscreenEffectsReady(fullscreenPlayerOpen)
            }
            className={`dark absolute inset-0 z-[70] overflow-hidden rounded-[inherit] bg-black ${
              fullscreenEffectsReady ? "" : "will-change-transform"
            }`}
          >
            <FullscreenPlayer
              onClose={closeFullscreenPlayer}
              effectsReady={fullscreenEffectsReady}
            />
          </motion.div>
        ) : isFullscreenRoute ? (
          <div
            data-theme="dark"
            className="dark absolute inset-0 z-[70] overflow-hidden rounded-[inherit] bg-black"
          >
            <FullscreenRouteContext.Provider value>
              {children}
            </FullscreenRouteContext.Provider>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search-popup-wrapper"
            ref={searchPopupRef}
            initial={{ opacity: 0, y: -12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute right-0 z-[60] flex flex-col items-center pointer-events-none pt-[54px]`}
            style={{
              left: SIDEBAR_WIDTH + SHELL_EDGE_GAP,
              right: SHELL_EDGE_GAP,
              top: 6,
            }}
          >
            <div className="w-[min(660px,calc(100vw-72px))] h-[54px] rounded-[8px] pointer-events-auto flex items-center px-[18px] gap-[14px] bg-bg-panel/95 border border-border-primary/50 backdrop-blur-2xl">
              <span className="shrink-0 flex items-center justify-center text-text-tertiary">
                <AnimatePresence mode="wait" initial={false}>
                  {searchLoading ? (
                    <motion.span
                      key="loader"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.1 }}
                      className="inline-block h-[17px] w-[17px] rounded-full border-[1.5px] border-text-secondary border-t-transparent animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <motion.span
                      key="icon"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.1 }}
                      className="inline-flex text-text-tertiary"
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
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitSearchQuery(searchQuery);
                    runSearchNow();
                  }
                }}
                className="w-full flex-1 bg-transparent border-none outline-none text-text-primary text-[16px] placeholder:text-text-tertiary font-[400] tracking-tight"
                style={{
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
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors border-none bg-transparent p-0 flex items-center justify-center cursor-pointer"
                  >
                    <CloseCircleFill size={18} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {hasSearchQuery ? (
                <motion.div
                  key="search-results-island"
                  initial={{ opacity: 0, y: -6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.99 }}
                  transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="w-[min(660px,calc(100vw-72px))] mt-[8px] max-h-[500px] h-[500px] rounded-[8px] pointer-events-auto flex flex-col overflow-hidden bg-bg-panel/95 border border-border-primary/50 backdrop-blur-2xl"
                >
                  <div className="flex gap-[6px] px-[14px] pt-[12px] pb-[6px] shrink-0 overflow-x-auto">
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
                            relative flex items-center gap-[7px] px-[13px] py-[7px] rounded-[12px] text-[13.5px] font-normal transition-colors border-none bg-transparent cursor-pointer select-none shrink-0
                            ${
                              isActive
                                ? "text-text-primary font-medium"
                                : "text-text-secondary hover:text-text-primary hover:bg-border-alpha-14"
                            }
                          `}
                          style={{
                            lineHeight: "1.2",
                          }}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeFilterPill"
                              className="absolute inset-0 rounded-[12px] bg-border-alpha-14 pointer-events-none z-0"
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

                  <div className="relative flex-1 min-h-0 overflow-hidden">
                    <AnimatePresence mode="wait">
                      {isSearchEmpty ? (
                        <motion.div
                          key="search-empty"
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
                          key={`search-results-${activeFilter}`}
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
                            onPlayFromSearch={handlePlayFromSearch}
                            onNavigateItem={handleNavigateItem}
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
              ) : historyItems.length > 0 ? (
                <motion.div
                  key="search-history-island"
                  initial={{ opacity: 0, y: -6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.99 }}
                  transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="w-[min(660px,calc(100vw-72px))] mt-[8px] max-h-[480px] h-auto rounded-[8px] pointer-events-auto flex flex-col overflow-hidden bg-bg-panel/95 border border-border-primary/50 backdrop-blur-2xl"
                >
                  <SearchHistoryList
                    onSelectQuery={handleSelectHistoryQuery}
                    onPlayTrack={handlePlayFromSearch}
                    onNavigateItem={handleNavigateItem}
                    onScroll={updateSearchMask}
                    scrollRef={searchScrollRef}
                    maskStyle={{
                      WebkitMaskImage: searchScrollMask,
                      maskImage: searchScrollMask,
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AppOverlays />
      {isFullscreenPlayer && (
        <div
          data-theme="dark"
          className="dark absolute top-1.5 right-1.5 z-[80]"
        >
          <WindowControlsNotch tone="glass" blur={glassBlur} />
        </div>
      )}
    </div>
  );
}
