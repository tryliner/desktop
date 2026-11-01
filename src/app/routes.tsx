import { Activity, useContext, useRef, type ReactElement } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "@/features/home/ui/HomePage";
import LibraryPage from "@/features/library/ui/LibraryPage";
import PlaylistPage from "@/features/library/ui/PlaylistPage";
import { LocalTracksPage } from "@/features/library";
import ArtistPage from "@/features/artist/ui/ArtistPage";
import CollectionPage from "@/features/collection/ui/CollectionPage";
import LoginPage from "@/features/auth/ui/LoginPage";
import PlayerPage from "@/features/player/ui/FullscreenPlayer";
import { StatsPage } from "@/features/stats";
import { FullscreenRouteContext } from "@/features/navigation/fullscreenRouteContext";
import KeepAlivePage from "./KeepAlivePage";

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

export function AppRoutes() {
  const location = useLocation();
  const inFullscreenOverlay = useContext(FullscreenRouteContext);
  const shellLocationRef = useRef(location);
  if (location.pathname !== PLAYER_PATH) shellLocationRef.current = location;

  if (inFullscreenOverlay) return <PlayerPage />;
  if (location.pathname === "/login") return <LoginPage />;

  const shellLocation = shellLocationRef.current;
  const { pathname, search } = shellLocation;
  const isKept = KEPT_PAGES.some((page) => page.path === pathname);

  return (
    <>
      {KEPT_PAGES.map(({ path, element }) => (
        <Activity key={path} mode={pathname === path ? "visible" : "hidden"}>
          {element}
        </Activity>
      ))}
      {!isKept && (
        <div key={`${pathname}?${search}`} className="page-transition">
          <Routes location={shellLocation}>
            <Route path="/library/playlist" element={<PlaylistPage />} />
            <Route path="/library/local" element={<LocalTracksPage />} />
            <Route path="/stats" element={<StatsPage />} />
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
