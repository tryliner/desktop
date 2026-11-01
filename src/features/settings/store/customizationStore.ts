import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTheme } from "next-themes";
import { usePageBackdropStore } from "@/shared/lib";

export interface BlockGlassConfig {
  opacity: number; // 0 - 100
  blur: number; // 0 - 40 px
  dim: number; // 0 - 50 %
}

export interface CustomizationState {
  wallpaperUrl: string;
  wallpaperBlur: number; // 0 - 60 px
  wallpaperDim: number; // 0 - 80 %
  glassmorphismEnabled: boolean;
  sidebarBlock: BlockGlassConfig;
  contentBlock: BlockGlassConfig;
  playerBlock: BlockGlassConfig;
  closeToTray: boolean;

  setWallpaperUrl: (url: string) => void;
  setWallpaperBlur: (blur: number) => void;
  setWallpaperDim: (dim: number) => void;
  setGlassmorphismEnabled: (enabled: boolean) => void;
  setSidebarBlock: (config: Partial<BlockGlassConfig>) => void;
  setContentBlock: (config: Partial<BlockGlassConfig>) => void;
  setPlayerBlock: (config: Partial<BlockGlassConfig>) => void;
  setCloseToTray: (closeToTray: boolean) => void;
  resetCustomization: () => void;
}

const DEFAULT_SIDEBAR: BlockGlassConfig = {
  opacity: 70,
  blur: 20,
  dim: 10,
};

const DEFAULT_CONTENT: BlockGlassConfig = {
  opacity: 60,
  blur: 15,
  dim: 0,
};

const DEFAULT_PLAYER: BlockGlassConfig = {
  opacity: 80,
  blur: 25,
  dim: 15,
};

const IDB_NAME = "liner_wallpaper_db";
const IDB_STORE = "wallpapers";
const IDB_KEY = "active_wallpaper";

export async function saveWallpaperToIdb(url: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          if (url) {
            tx.objectStore(IDB_STORE).put(url, IDB_KEY);
          } else {
            tx.objectStore(IDB_STORE).delete(IDB_KEY);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadWallpaperFromIdb(): Promise<string | null> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(IDB_STORE, "readonly");
          const getReq = tx.objectStore(IDB_STORE).get(IDB_KEY);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const useCustomizationStore = create<CustomizationState>()(
  persist(
    (set) => ({
      wallpaperUrl: "",
      wallpaperBlur: 20,
      wallpaperDim: 30,
      glassmorphismEnabled: true,
      sidebarBlock: { ...DEFAULT_SIDEBAR },
      contentBlock: { ...DEFAULT_CONTENT },
      playerBlock: { ...DEFAULT_PLAYER },
      closeToTray: true,

      setWallpaperUrl: (wallpaperUrl) => {
        set({ wallpaperUrl });
        void saveWallpaperToIdb(wallpaperUrl);
      },
      setWallpaperBlur: (wallpaperBlur) => set({ wallpaperBlur }),
      setWallpaperDim: (wallpaperDim) => set({ wallpaperDim }),
      setGlassmorphismEnabled: (glassmorphismEnabled) => set({ glassmorphismEnabled }),
      setSidebarBlock: (partial) =>
        set((state) => ({ sidebarBlock: { ...state.sidebarBlock, ...partial } })),
      setContentBlock: (partial) =>
        set((state) => ({ contentBlock: { ...state.contentBlock, ...partial } })),
      setPlayerBlock: (partial) =>
        set((state) => ({ playerBlock: { ...state.playerBlock, ...partial } })),
      setCloseToTray: (closeToTray) => {
        set({ closeToTray });
        void window.linerElectron?.setCloseToTray?.(closeToTray);
      },
      resetCustomization: () => {
        void saveWallpaperToIdb("");
        set({
          wallpaperUrl: "",
          wallpaperBlur: 20,
          wallpaperDim: 30,
          glassmorphismEnabled: true,
          sidebarBlock: { ...DEFAULT_SIDEBAR },
          contentBlock: { ...DEFAULT_CONTENT },
          playerBlock: { ...DEFAULT_PLAYER },
          closeToTray: true,
        });
        void window.linerElectron?.setCloseToTray?.(true);
      },
    }),
    {
      name: "liner_customization_v1",
      partialize: (state) => ({
        wallpaperBlur: state.wallpaperBlur,
        wallpaperDim: state.wallpaperDim,
        glassmorphismEnabled: state.glassmorphismEnabled,
        sidebarBlock: state.sidebarBlock,
        contentBlock: state.contentBlock,
        playerBlock: state.playerBlock,
        closeToTray: state.closeToTray,
      }),
    },
  ),
);

// Preload closeToTray setting from Electron on startup
if (typeof window !== "undefined" && window.linerElectron?.getCloseToTray) {
  void window.linerElectron.getCloseToTray().then((enabled) => {
    if (typeof enabled === "boolean") {
      useCustomizationStore.setState({ closeToTray: enabled });
    }
  });
}

// Preload cached wallpaper from IndexedDB on startup
if (typeof window !== "undefined") {
  void loadWallpaperFromIdb().then((cached) => {
    if (cached) {
      useCustomizationStore.setState({ wallpaperUrl: cached });
    }
  });
}

/**
 * Computes block-level glassmorphism styling
 */
export function getBlockStyle(
  config: BlockGlassConfig,
  isDark: boolean,
  hasCustomBg: boolean,
  glassmorphismEnabled = true,
): React.CSSProperties {
  if (!glassmorphismEnabled && !hasCustomBg) {
    return {};
  }

  const opacity = typeof config?.opacity === "number" ? config.opacity : 100;
  const blur = typeof config?.blur === "number" ? config.blur : 0;
  const dim = typeof config?.dim === "number" ? config.dim : 0;

  if (opacity === 100 && !hasCustomBg) {
    return {
      backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
    };
  }

  const alpha = Math.min(1, Math.max(0, opacity / 100));
  const dimAlpha = Math.min(1, Math.max(0, dim / 100));
  const baseRgb = isDark ? "10, 10, 10" : "255, 255, 255";

  let bg: string;
  if (dimAlpha > 0) {
    bg = `linear-gradient(rgba(0, 0, 0, ${dimAlpha}), rgba(0, 0, 0, ${dimAlpha})), rgba(${baseRgb}, ${alpha})`;
  } else {
    bg = `rgba(${baseRgb}, ${alpha})`;
  }

  const t = (100 - opacity) / 75;
  const glassPillBg = `linear-gradient(135deg, rgba(0, 0, 0, ${(0.55 - 0.35 * t).toFixed(3)}) 0%, rgba(0, 0, 0, ${(0.45 - 0.30 * t).toFixed(3)}) 100%)`;
  const glassPillBgHover = `linear-gradient(135deg, rgba(0, 0, 0, ${(0.70 - 0.35 * t).toFixed(3)}) 0%, rgba(0, 0, 0, ${(0.58 - 0.32 * t).toFixed(3)}) 100%)`;
  const glassBlur = `${Math.round(8 + 16 * t)}px`;
  const glassProminentBg = `rgba(255, 255, 255, ${(1 - 0.18 * t).toFixed(2)})`;

  const borderColor = isDark
    ? `rgba(255, 255, 255, ${Math.min(0.14, Math.max(0.04, alpha * 0.12))})`
    : `rgba(0, 0, 0, ${Math.min(0.12, Math.max(0.04, alpha * 0.08))})`;

  // Tactile Apple specular glass highlight (top edge) & soft elevation shadow
  const boxShadow = isDark
    ? `inset 0 1px 1px 0 rgba(255, 255, 255, 0.08), 0 12px 36px 0 rgba(0, 0, 0, 0.45)`
    : `inset 0 1px 1px 0 rgba(255, 255, 255, 0.6), 0 12px 36px 0 rgba(0, 0, 0, 0.08)`;

  return {
    backgroundColor: `rgba(${baseRgb}, ${alpha})`,
    background: bg,
    backdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
    WebkitBackdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
    borderColor,
    boxShadow,
    ["--glass-pill-bg" as any]: glassPillBg,
    ["--glass-pill-bg-hover" as any]: glassPillBgHover,
    ["--glass-pill-border" as any]: "none",
    ["--glass-blur" as any]: glassBlur,
    ["--glass-prominent-bg" as any]: glassProminentBg,
  };
}

function getIsDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function useIsDarkTheme(): boolean {
  const { resolvedTheme } = useTheme();
  return resolvedTheme ? resolvedTheme === "dark" : getIsDarkTheme();
}

export function useEffectiveCoverGlow(): boolean {
  return useIsDarkTheme();
}

export function useHasPageBackdrop(): boolean {
  const wallpaperUrl = useCustomizationStore((s) => s.wallpaperUrl);
  const coverGlow = useEffectiveCoverGlow();
  const hasCover = usePageBackdropStore((s) => Boolean(s.coverUrl));
  if (wallpaperUrl) return false;
  return coverGlow && hasCover;
}

export function useClassicSurfaces(): boolean {
  return !useEffectiveCoverGlow();
}
