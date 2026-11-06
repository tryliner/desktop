import { Activity, useContext, useRef, type ReactElement } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "@/features/home/ui/HomePage";
import LibraryPage from "@/features/library/ui/LibraryPage";
import PlaylistPage from "@/features/library/ui/PlaylistPage";
import {
  CachedTracksPage,
  LocalTracksPage,
  SavedLikesPage,
} from "@/features/library";
import ArtistPage from "@/features/artist/ui/ArtistPage";
import CollectionPage from "@/features/collection/ui/CollectionPage";
import LoginPage from "@/features/auth/ui/LoginPage";
import PlayerPage from "@/features/player/ui/FullscreenPlayer";
import { FullscreenRouteContext } from "@/features/navigation/fullscreenRouteContext";
import KeepAlivePage from "./KeepAlivePage";
import { useOfflineModeStore } from "@/features/connectivity";

const KEPT_PAGES: ReadonlyArray<{ path: string; element: ReactElement }> = [
  {
    path: "/",
    element: (
      <KeepAlivePage>
        <HomePage />
      </KeepAlivePage>
    ),
  },
  {
    path: "/library",
    element: (
      <KeepAlivePage>
        <LibraryPage />
      </KeepAlivePage>
    ),
  },
];

const PLAYER_PATH = "/player";
const OFFLINE_PATHS = new Set([
  "/library",
  "/library/local",
  "/library/cached",
  "/library/saved",
  PLAYER_PATH,
]);

export function AppRoutes() {
  const location = useLocation();
  const offline = useOfflineModeStore((state) => state.offline);
  const inFullscreenOverlay = useContext(FullscreenRouteContext);
  const shellLocationRef = useRef(location);
  if (location.pathname !== PLAYER_PATH) shellLocationRef.current = location;

  if (inFullscreenOverlay) return <PlayerPage />;
  if (location.pathname === "/login") return <LoginPage />;

  const shellLocation = shellLocationRef.current;
  const { pathname, search } = shellLocation;
  const isKept = KEPT_PAGES.some((page) => page.path === pathname);
  const blocked = offline && !OFFLINE_PATHS.has(pathname);

  return (
    <>
      {KEPT_PAGES.map(({ path, element }) => (
        <Activity
          key={path}
          mode={pathname === path && !blocked ? "visible" : "hidden"}
        >
          {element}
        </Activity>
      ))}
      {blocked && <Navigate to="/library" replace />}
      {!isKept && !blocked && (
        <div key={`${pathname}?${search}`} className="page-transition">
          <Routes location={shellLocation}>
            <Route path="/library/playlist" element={<PlaylistPage />} />
            <Route path="/library/local" element={<LocalTracksPage />} />
            <Route path="/library/cached" element={<CachedTracksPage />} />
            <Route path="/library/saved" element={<SavedLikesPage />} />
            <Route path="/artist" element={<ArtistPage />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/settings" element={<Navigate to="/" replace />} />
            <Route path={PLAYER_PATH} element={null} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      )}
    </>
  );
}
