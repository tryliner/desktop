import { useEffect, useState } from "react";

/**
 * Viewport-based fullscreen detection: a wayland compositor (kde meta-f,
 * hyprland keybinds) can fullscreen the os window without electron's
 * enter-full-screen event ever firing, so also treat a viewport that
 * covers the whole screen as fullscreen.
 */
export function isViewportFullScreen(): boolean {
  if (typeof window === "undefined") return false;
  const { innerWidth, innerHeight } = window;
  const width = window.screen?.width ?? 0;
  const height = window.screen?.height ?? 0;
  return (
    width > 0 &&
    height > 0 &&
    innerWidth >= width &&
    innerHeight >= height
  );
}

interface WindowOsTruth {
  isFullScreen: boolean | null;
  isMaximized: boolean | null;
}

function merge(osTruth: WindowOsTruth, viewportFullScreen: boolean) {
  // the OS-reported state wins always; the viewport measure only squares
  // corners when the window is NOT merely maximized (on panel-less
  // desktops a maximized window also covers the whole screen)
  return (
    Boolean(osTruth.isFullScreen) ||
    (viewportFullScreen && osTruth.isMaximized !== true)
  );
}

function mergeWindowOsTruth(
  current: WindowOsTruth,
  patch: Partial<WindowOsTruth>,
): WindowOsTruth {
  return {
    isFullScreen:
      typeof patch.isFullScreen === "boolean"
        ? patch.isFullScreen
        : current.isFullScreen,
    isMaximized:
      typeof patch.isMaximized === "boolean"
        ? patch.isMaximized
        : current.isMaximized,
  };
}

/**
 * Tracks the OS window's fullscreen state: hydrates from the main process,
 * follows `window:state-changed` broadcasts, and falls back to measuring
 * the viewport for compositor-driven fullscreen that never produces an
 * electron event (wayland). Maximized windows never trigger the viewport
 * fallback (see merge).
 */
export function useIsWindowFullScreen(): boolean {
  const [osTruth, setOsTruth] = useState<WindowOsTruth>({
    isFullScreen: null,
    isMaximized: null,
  });
  const [viewportFullScreen, setViewportFullScreen] = useState(
    isViewportFullScreen,
  );

  useEffect(() => {
    if (!window.linerElectron) {
      return;
    }

    // hydrate initial os window state
    window.linerElectron.isFullScreen?.().then((fs) => {
      if (typeof fs === "boolean") {
        setOsTruth((current) =>
          mergeWindowOsTruth(current, { isFullScreen: fs }),
        );
      }
    });
    window.linerElectron.isMaximized?.().then((max) => {
      if (typeof max === "boolean") {
        setOsTruth((current) =>
          mergeWindowOsTruth(current, { isMaximized: max }),
        );
      }
    });

    // live sync across os fullscreen transitions
    const unsubscribe = window.linerElectron.onWindowStateChange?.((state) => {
      setOsTruth((current) =>
        mergeWindowOsTruth(current, {
          isFullScreen: state.isFullScreen,
          isMaximized: state.isMaximized,
        }),
      );
    });

    // compositor-driven fullscreen never sends electron events on wayland,
    // so verify against the viewport size on every resize
    const syncViewport = () => setViewportFullScreen(isViewportFullScreen());
    window.addEventListener("resize", syncViewport);

    return () => {
      unsubscribe?.();
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  return merge(osTruth, viewportFullScreen);
}
