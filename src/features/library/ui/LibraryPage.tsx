import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LibraryControls from "./LibraryControls";
import LibraryGrid, { LibraryGridSkeleton } from "./LibraryGrid";
import LibraryTabs from "./LibraryTabs";
import type {
  LibraryItemViewModel,
  LibraryTab,
  LibraryViewMode,
} from "../types";
import {
  usePlaylistsList,
  useExternalItems,
  useLikedTrackCount,
  useYoutubeLibraryItems,
} from "../hooks";
import { useLikesCover } from "../hooks/useLikesCover";
import { useTranslation } from "@/languages";
import { useModalStore } from "../store/modalStore";
import { useImportStore } from "../store/importStore";
import { usePageBackdrop } from "@/shared/lib";
import ImportingPlaylistCard from "./ImportingPlaylistCard";
import OfflineMixCard from "./OfflineMixCard";
import { LocalFilesCard } from "../local";
import { CachedSongsCard, useCachedTracksStore } from "../cached";
import { WifiOffLine } from "@mingcute/react";
import { useOfflineModeStore } from "@/features/connectivity";
import { goOnline } from "@/features/connectivity/engine/offlineController";
import { useSavedTracks } from "../saved/hooks/useSavedTracks";

const PAGE_SIZE = 24;

interface TabState {
  query: string;
  visibleCount: number;
  loadingMore: boolean;
}

type LibraryState = Record<LibraryTab, TabState>;

const initialTabState: TabState = {
  query: "",
  visibleCount: PAGE_SIZE,
  loadingMore: false,
};

const initialState: LibraryState = {
  all: { ...initialTabState },
  playlists: { ...initialTabState },
  albums: { ...initialTabState },
  artists: { ...initialTabState },
};

function sortByRecent(items: LibraryItemViewModel[]) {
  const sorted = [...items];
  sorted.sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  );
  return sorted;
}

function LikesPlaylistCard({
  count,
  isLoading,
  onClick,
  viewMode = "grid",
}: {
  count?: number;
  isLoading?: boolean;
  onClick: () => void;
  viewMode?: LibraryViewMode;
}) {
  const { t } = useTranslation();
  const likesCover = useLikesCover();

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className="w-full flex items-center justify-between rounded-md p-[8px] outline-none transition-colors duration-150 ease-out cursor-pointer hover:bg-border-alpha-14 select-none"
      >
        <div className="flex items-center gap-[16px] min-w-0">
          <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-md">
            <img
              src={likesCover}
              alt=""
              draggable={false}
              className="h-full w-full object-cover select-none"
            />
          </div>

          <div className="min-w-0 flex flex-col gap-[2px]">
            <h3
              className="m-0 max-w-[min(52vw,560px)] overflow-hidden text-ellipsis whitespace-nowrap text-[16px] leading-[1.2] text-text-primary"
              style={{
                fontWeight: 400,
              }}
            >
              {t("library.liked_songs")}
            </h3>
            <p
              className="m-0 flex min-w-0 items-center text-[15px] leading-[1.2] overflow-hidden text-text-secondary"
              style={{
                fontWeight: 350,
              }}
            >
              {isLoading || count === undefined ? (
                <span className="h-[12px] w-[60px] animate-pulse rounded bg-border-alpha-14" />
              ) : (
                t("common.songs", { count })
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group flex flex-col gap-[8px] cursor-pointer"
      draggable={false}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md">
        <img
          src={likesCover}
          alt=""
          draggable={false}
          className="h-full w-full object-cover select-none"
        />
      </div>
      <div className="flex flex-col gap-[4px]">
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {t("library.liked_songs")}
        </span>
        {isLoading || count === undefined ? (
          <div className="h-[13px] w-[56%] animate-pulse rounded bg-border-alpha-14" />
        ) : (
          <span className="truncate text-[13px] text-text-tertiary">
            {t("common.songs", { count })}
          </span>
        )}
      </div>
    </div>
  );
}

function OnlineLibraryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const likesCover = useLikesCover();
  usePageBackdrop(likesCover, { blur: 56, dim: 0.22 });
  const [activeTab, setActiveTab] = useState<LibraryTab>("all");
  const [stateByTab, setStateByTab] = useState<LibraryState>(initialState);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("liner_library_view_mode");
      if (saved === "grid" || saved === "list") {
        return saved;
      }
    }
    return "grid";
  });

  const handleViewModeChange = useCallback((newMode: LibraryViewMode) => {
    setViewMode(newMode);
    localStorage.setItem("liner_library_view_mode", newMode);
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const activeState = stateByTab[activeTab];
  const hasSearchQuery = activeState.query.trim().length > 0;

  const {
    data: playlistsData,
    error: playlistsError,
    isLoading: playlistsLoading,
  } = usePlaylistsList();

  const { data: albumItems = [], isLoading: albumsLoading } =
    useExternalItems("album");
  const { data: artistItems = [], isLoading: artistsLoading } =
    useExternalItems("artist");
  const {
    data: externalPlaylistItems = [],
    isLoading: externalPlaylistsLoading,
  } = useExternalItems("playlist");
  const youtubeItems = useYoutubeLibraryItems();
  const youtubePlaylistItems = useMemo(
    () => youtubeItems.filter((item) => item.kind === "playlist"),
    [youtubeItems],
  );
  const youtubeAlbumItems = useMemo(
    () => youtubeItems.filter((item) => item.kind === "album"),
    [youtubeItems],
  );
  const cachedVisibleOnline = useCachedTracksStore(
    (state) => state.visibleOnline,
  );
  const showCachedSongs = cachedVisibleOnline;
  const { data: likedCount, isLoading: likedCountLoading } =
    useLikedTrackCount();
  const openCreatePlaylist = useModalStore((state) => state.openCreatePlaylist);

  const playlistItems: LibraryItemViewModel[] = useMemo(() => {
    if (!playlistsData) return [];
    const list = playlistsData.playlists ?? [];
    return list.map((playlist) => ({
      id: playlist.id,
      title: playlist.title,
      subtitle: t("common.tracks", { count: playlist.trackCount }),
      imageUrl: playlist.coverUrl || "",
      coverUrls: playlist.coverUrls,
      kind: "playlist" as const,
      isOwned: true,
      href: `/library/playlist?id=${encodeURIComponent(playlist.id)}`,
      addedAt:
        playlist.updatedAt || playlist.createdAt || new Date().toISOString(),
    }));
  }, [playlistsData, t]);

  const initialLoading =
    playlistsLoading ||
    albumsLoading ||
    artistsLoading ||
    externalPlaylistsLoading;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as LibraryTab | null;
    if (tab && ["all", "playlists", "albums", "artists"].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const filteredItems = useMemo(() => {
    let source: LibraryItemViewModel[];
    if (activeTab === "all") {
      source = [
        ...playlistItems,
        ...externalPlaylistItems,
        ...youtubePlaylistItems,
        ...albumItems,
        ...youtubeAlbumItems,
        ...artistItems,
      ];
    } else if (activeTab === "playlists") {
      source = [
        ...playlistItems,
        ...externalPlaylistItems,
        ...youtubePlaylistItems,
      ];
    } else if (activeTab === "albums") {
      source = [...albumItems, ...youtubeAlbumItems];
    } else if (activeTab === "artists") {
      source = artistItems;
    } else {
      return [];
    }
    const filtered =
      debouncedQuery.length === 0
        ? source
        : source.filter((item) => {
            const haystack = `${item.title} ${item.subtitle}`.toLowerCase();
            return haystack.includes(debouncedQuery);
          });

    return sortByRecent(filtered);
  }, [
    activeTab,
    debouncedQuery,
    playlistItems,
    externalPlaylistItems,
    youtubePlaylistItems,
    albumItems,
    youtubeAlbumItems,
    artistItems,
  ]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, activeState.visibleCount),
    [activeState.visibleCount, filteredItems],
  );

  const hasMore = activeState.visibleCount < filteredItems.length;

  const setActiveTabState = useCallback(
    (update: Partial<TabState>) => {
      setStateByTab((prev) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], ...update },
      }));
    },
    [activeTab],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || activeState.loadingMore) {
      return;
    }

    setActiveTabState({ loadingMore: true });
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setStateByTab((prev) => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          visibleCount: Math.min(
            prev[activeTab].visibleCount + PAGE_SIZE,
            filteredItems.length,
          ),
          loadingMore: false,
        },
      }));
    }, 190);
  }, [
    activeState.loadingMore,
    activeTab,
    filteredItems.length,
    hasMore,
    setActiveTabState,
  ]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node || !hasMore || activeState.loadingMore) {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            loadMore();
          }
        },
        { rootMargin: "900px 0px" },
      );
      observerRef.current.observe(node);
    },
    [activeState.loadingMore, hasMore, loadMore],
  );

  useEffect(() => {
    const normalized = activeState.query.trim().toLowerCase();
    const timer = window.setTimeout(
      () => {
        setDebouncedQuery(normalized.length === 0 ? "" : normalized);
      },
      normalized.length === 0 ? 0 : 220,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeState.query]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const importJob = useImportStore((state) => state.job);
  const showsPlaylists = activeTab === "playlists" || activeTab === "all";
  const isImporting =
    Boolean(importJob) &&
    (importJob?.status === "queued" ||
      importJob?.status === "running" ||
      importJob?.status === "finalizing" ||
      importJob?.status === "awaiting_decision");

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-auto bg-transparent pb-(--page-inset-bottom)"
      >
        <div className="relative z-20 bg-transparent">
          <div className="px-[12px] pt-[36px] pb-[10px]">
            <h1 className="text-[26px] font-bold text-text-primary tracking-tight m-0 leading-tight">
              {t("library.title")}
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-[10px] px-[12px] pb-[10px]">
            <LibraryTabs activeTab={activeTab} onChange={setActiveTab} />
            <LibraryControls
              activeTab={activeTab}
              query={activeState.query}
              onQueryChange={(query) =>
                setActiveTabState({
                  query,
                  visibleCount: PAGE_SIZE,
                  loadingMore: false,
                })
              }
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              onCreatePlaylist={
                showsPlaylists ? () => openCreatePlaylist() : undefined
              }
            />
          </div>
        </div>

        <div className="px-[12px] pt-[4px] pb-[20px]">
          {activeTab === "playlists" && playlistsError ? (
            <div className="mb-[10px] text-[12px] text-accent-secondary">
              {t("playlist.error_loading")}
            </div>
          ) : null}
          {initialLoading ? (
            <LibraryGridSkeleton viewMode={viewMode} />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${activeTab}:${debouncedQuery || "all"}:${viewMode}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
              >
                <LibraryGrid
                  items={visibleItems}
                  loadingMore={activeState.loadingMore}
                  hasMore={hasMore}
                  hasSearchQuery={hasSearchQuery}
                  activeTab={activeTab}
                  viewMode={viewMode}
                  sentinelRef={sentinelRef}
                  prependNodes={
                    showsPlaylists && !hasSearchQuery
                      ? [
                          <LikesPlaylistCard
                            key="likes-playlist-card"
                            count={likedCount}
                            isLoading={likedCountLoading}
                            viewMode={viewMode}
                            onClick={() =>
                              navigate("/library/playlist?id=likes")
                            }
                          />,
                          ...(showCachedSongs
                            ? [
                                <CachedSongsCard
                                  key="cached-songs-card"
                                  viewMode={viewMode}
                                />,
                              ]
                            : []),
                          <LocalFilesCard
                            key="local-files-card"
                            viewMode={viewMode}
                          />,
                          ...(isImporting && importJob
                            ? [
                                <ImportingPlaylistCard
                                  key={`importing-playlist-${importJob.id}`}
                                  job={importJob}
                                  viewMode={viewMode}
                                />,
                              ]
                            : []),
                        ]
                      : undefined
                  }
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function OfflineLibraryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const likesCover = useLikesCover();
  usePageBackdrop(likesCover, { blur: 56, dim: 0.22 });
  const source = useOfflineModeStore((state) => state.source);
  const checking = useOfflineModeStore((state) => state.checking);
  const { tracks: savedLikes, isLoading: savedLoading } = useSavedTracks();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="h-full w-full overflow-y-auto bg-transparent pb-(--page-inset-bottom)">
        <div className="px-[12px] pt-[36px] pb-[10px]">
          <h1
            className="text-[26px] font-bold text-text-primary tracking-tight m-0 leading-tight"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("library.title")}
          </h1>
          <div
            className="mt-[10px] flex flex-wrap items-center gap-[10px] text-[13px] text-text-secondary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            <span className="flex items-center gap-[8px]">
              <WifiOffLine size={15} className="text-text-tertiary" />
              {t(
                source === "manual"
                  ? "offline.library_status_manual"
                  : "offline.library_status_auto",
              )}
            </span>
            <button
              type="button"
              disabled={checking}
              onClick={() => void goOnline()}
              className="h-[28px] rounded-[9px] border-0 bg-black/[0.06] px-[12px] text-[12.5px] font-[500] text-text-primary transition-colors hover:bg-black/[0.1] disabled:cursor-default disabled:opacity-60 dark:bg-white/[0.1] dark:hover:bg-white/[0.15] cursor-pointer"
            >
              {checking
                ? t("connectivity.retrying")
                : t(
                    source === "manual"
                      ? "offline.go_online"
                      : "offline.reconnect",
                  )}
            </button>
          </div>
        </div>

        <div className="px-[12px] pt-[14px] pb-[20px]">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-[24px] pb-[24px]">
            <OfflineMixCard />
            {savedLikes.length > 0 || savedLoading ? (
              <LikesPlaylistCard
                count={savedLikes.length}
                isLoading={savedLoading}
                onClick={() => navigate("/library/saved")}
              />
            ) : null}
            <CachedSongsCard />
            <LocalFilesCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const offline = useOfflineModeStore((state) => state.offline);
  return offline ? <OfflineLibraryPage /> : <OnlineLibraryPage />;
}
