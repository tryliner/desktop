import { useEffect, useState } from "react";
import type { WindowState } from "../../../../electron/preload";

export interface WindowStateHookResult {
  isMaximized: boolean;
  isFullScreen: boolean;
  isEdgeToEdge: boolean;
}

let activeF11Count = 0;
let activeWindowStateInstances = 0;

const handlePreventF11 = (e: KeyboardEvent) => {
  if (e.key === "F11") {
    e.preventDefault();
  }
};

const checkDomFullscreen = (): boolean => {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.fullscreenElement ||
    (window.matchMedia?.("(display-mode: fullscreen)")?.matches ?? false),
  );
};

function syncBodyEdgeToEdge(isEdge: boolean) {
  if (typeof document === "undefined") return;
  if (isEdge) {
    document.body.setAttribute("data-edge-to-edge", "true");
    document.body.classList.remove("p-1");
    document.body.classList.add("p-0");
  } else {
    document.body.removeAttribute("data-edge-to-edge");
    document.body.classList.remove("p-0");
    document.body.classList.add("p-1");
  }
}

export function useWindowState(): WindowStateHookResult {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const isEdgeToEdge = isMaximized || isFullScreen;

  useEffect(() => {
    activeWindowStateInstances++;
    syncBodyEdgeToEdge(isEdgeToEdge);

    return () => {
      activeWindowStateInstances--;
      if (activeWindowStateInstances === 0) {
        syncBodyEdgeToEdge(false);
      }
    };
  }, [isEdgeToEdge]);

  useEffect(() => {
    let mounted = true;
    let pushSeq = 0;

    if (activeF11Count === 0 && typeof window !== "undefined") {
      window.addEventListener("keydown", handlePreventF11);
    }
    activeF11Count++;

    // Browser-only fullscreen fallback
    const checkBrowserFullscreen = () => {
      if (mounted) {
        setIsFullScreen(checkDomFullscreen());
      }
    };

    if (!window.linerElectron) {
      checkBrowserFullscreen();
      const handleFullscreenChange = () => checkBrowserFullscreen();
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      window.addEventListener("resize", handleFullscreenChange);
      const mediaQuery = window.matchMedia?.("(display-mode: fullscreen)");
      mediaQuery?.addEventListener?.("change", handleFullscreenChange);
      return () => {
        mounted = false;
        activeF11Count--;
        if (activeF11Count === 0 && typeof window !== "undefined") {
          window.removeEventListener("keydown", handlePreventF11);
        }
        document.removeEventListener(
          "fullscreenchange",
          handleFullscreenChange,
        );
        window.removeEventListener("resize", handleFullscreenChange);
        mediaQuery?.removeEventListener?.("change", handleFullscreenChange);
      };
    }

    // Hydrate initial os window state from electron
    const initialQuerySeq = pushSeq;
    window.linerElectron
      .isFullScreen?.()
      .then((fs) => {
        if (mounted && pushSeq === initialQuerySeq && typeof fs === "boolean") {
          setIsFullScreen(fs);
        }
      })
      .catch(() => {});

    window.linerElectron
      .isMaximized?.()
      .then((max) => {
        if (
          mounted &&
          pushSeq === initialQuerySeq &&
          typeof max === "boolean"
        ) {
          setIsMaximized(max);
        }
      })
      .catch(() => {});

    // Live sync across os fullscreen transitions & maximize toggles
    const unsubscribe = window.linerElectron.onWindowStateChange?.(
      (state: WindowState) => {
        if (mounted && state) {
          pushSeq++;
          setIsFullScreen(Boolean(state.isFullScreen));
          setIsMaximized(Boolean(state.isMaximized));
        }
      },
    );

    // Fallback sync on window resize for compositors (e.g. Wayland)
    const handleResize = () => {
      if (!mounted) return;
      const isDomFullscreen = checkDomFullscreen();
      if (isDomFullscreen) {
        setIsFullScreen(true);
      }
      const resizeSeq = pushSeq;
      window.linerElectron
        ?.isMaximized?.()
        .then((max) => {
          if (mounted && pushSeq === resizeSeq && typeof max === "boolean") {
            setIsMaximized(max);
          }
        })
        .catch(() => {});
      window.linerElectron
        ?.isFullScreen?.()
        .then((fs) => {
          if (mounted && pushSeq === resizeSeq && typeof fs === "boolean") {
            setIsFullScreen(fs || isDomFullscreen);
          }
        })
        .catch(() => {});
    };

    const handleFullscreenChange = () => {
      if (!mounted) return;
      const isDomFullscreen = checkDomFullscreen();
      if (isDomFullscreen) {
        setIsFullScreen(true);
      } else {
        const querySeq = pushSeq;
        window.linerElectron
          ?.isFullScreen?.()
          .then((fs) => {
            if (mounted && pushSeq === querySeq && typeof fs === "boolean") {
              setIsFullScreen(fs);
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      mounted = false;
      activeF11Count--;
      if (activeF11Count === 0 && typeof window !== "undefined") {
        window.removeEventListener("keydown", handlePreventF11);
      }
      unsubscribe?.();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return {
    isMaximized,
    isFullScreen,
    isEdgeToEdge,
  };
}

export default useWindowState;
