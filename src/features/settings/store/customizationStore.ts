import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";

export interface BlockCustomization {
  opacity: number; // 15..100 (%)
  blur: number;    // 0..40 (px)
  dim: number;     // 0..85 (%)
}

export interface CustomizationState {
  backgroundImage: string | null;
  backgroundBlur: number;
  backgroundDim: number;
  sidebar: BlockCustomization;
  contentView: BlockCustomization;
  miniplayer: BlockCustomization;

  setBackgroundImage: (image: string | null) => void;
  setBackgroundBlur: (blur: number) => void;
  setBackgroundDim: (dim: number) => void;
  setBlockConfig: (
    block: "sidebar" | "contentView" | "miniplayer",
    patch: Partial<BlockCustomization>,
  ) => void;
  applyToAllBlocks: (sourceBlock: "sidebar" | "contentView" | "miniplayer") => void;
  resetBlock: (block: "sidebar" | "contentView" | "miniplayer") => void;
  resetAll: () => void;
}

export const MIN_OPACITY = 25;
export const MAX_OPACITY = 100;
export const MIN_BLUR = 10;
export const MAX_BLUR = 40;
export const MIN_DIM = 8;
export const MAX_DIM = 85;

export const DEFAULT_BLOCK_CONFIG: BlockCustomization = {
  opacity: 100,
  blur: 0,
  dim: 0,
};

export const DEFAULT_GLASS_CONFIG: BlockCustomization = {
  opacity: 60,
  blur: 20,
  dim: 15,
};

const DB_NAME = "liner_customization_db";
const STORE_NAME = "wallpapers";
const BG_KEY = "active_wallpaper";

// opens simple indexeddb instance for wallpaper storage
function openWallpaperDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// loads persisted wallpaper payload from indexeddb
async function loadPersistedWallpaper(): Promise<string | null> {
  const db = await openWallpaperDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(BG_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// saves wallpaper payload to indexeddb
async function savePersistedWallpaper(data: string | null): Promise<void> {
  const db = await openWallpaperDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = data ? store.put(data, BG_KEY) : store.delete(BG_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export const clampBlockConfig = (cfg: Partial<BlockCustomization>): BlockCustomization => {
  const opacity = typeof cfg.opacity === "number"
    ? Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, Math.round(cfg.opacity)))
    : DEFAULT_BLOCK_CONFIG.opacity;

  const blur = typeof cfg.blur === "number"
    ? Math.max(MIN_BLUR, Math.min(MAX_BLUR, Math.round(cfg.blur)))
    : DEFAULT_BLOCK_CONFIG.blur;

  const dim = typeof cfg.dim === "number"
    ? Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(cfg.dim)))
    : DEFAULT_BLOCK_CONFIG.dim;

  return { opacity, blur, dim };
};

export const useCustomizationStore = create<CustomizationState>()(
  persist(
    (set, get) => ({
      backgroundImage: null,
      backgroundBlur: 0,
      backgroundDim: 0,
      sidebar: { ...DEFAULT_BLOCK_CONFIG },
      contentView: { ...DEFAULT_BLOCK_CONFIG },
      miniplayer: { ...DEFAULT_BLOCK_CONFIG },

      setBackgroundImage: (image) => {
        const prev = get().backgroundImage;
        set({ backgroundImage: image });
        void savePersistedWallpaper(image);

        // if user just added first background and blocks are fully opaque, apply balanced glass preset
        if (image && !prev) {
          const currentSidebar = get().sidebar;
          const currentContent = get().contentView;
          const currentMiniplayer = get().miniplayer;
          const allDefault =
            currentSidebar.opacity === 100 &&
            currentContent.opacity === 100 &&
            currentMiniplayer.opacity === 100 &&
            currentSidebar.blur === 0 &&
            currentContent.blur === 0 &&
            currentMiniplayer.blur === 0;

          if (allDefault) {
            set({
              sidebar: { ...DEFAULT_GLASS_CONFIG },
              contentView: { ...DEFAULT_GLASS_CONFIG },
              miniplayer: { ...DEFAULT_GLASS_CONFIG },
            });
          }
        } else if (!image) {
          set({
            backgroundBlur: 0,
            backgroundDim: 0,
            sidebar: { ...DEFAULT_BLOCK_CONFIG },
            contentView: { ...DEFAULT_BLOCK_CONFIG },
            miniplayer: { ...DEFAULT_BLOCK_CONFIG },
          });
        }
      },

      setBackgroundBlur: (blur) => {
        const clamped = Math.max(0, Math.min(40, Math.round(blur)));
        set({ backgroundBlur: clamped });
      },

      setBackgroundDim: (dim) => {
        const clamped = Math.max(0, Math.min(85, Math.round(dim)));
        set({ backgroundDim: clamped });
      },

      setBlockConfig: (block, patch) => {
        set((state) => ({
          [block]: {
            ...state[block],
            ...clampBlockConfig({
              ...state[block],
              ...patch,
            }),
          },
        }));
      },

      applyToAllBlocks: (sourceBlock) => {
        const src = get()[sourceBlock];
        const cloned = { ...src };
        set({
          sidebar: { ...cloned },
          contentView: { ...cloned },
          miniplayer: { ...cloned },
        });
      },

      resetBlock: (block) => {
        set((state) => ({
          [block]: state.backgroundImage
            ? { ...DEFAULT_GLASS_CONFIG }
            : { ...DEFAULT_BLOCK_CONFIG },
        }));
      },

      resetAll: () => {
        void savePersistedWallpaper(null);
        set({
          backgroundImage: null,
          backgroundBlur: 0,
          backgroundDim: 0,
          sidebar: { ...DEFAULT_BLOCK_CONFIG },
          contentView: { ...DEFAULT_BLOCK_CONFIG },
          miniplayer: { ...DEFAULT_BLOCK_CONFIG },
        });
      },
    }),
    {
      name: "liner_customization_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        backgroundBlur: state.backgroundBlur,
        backgroundDim: state.backgroundDim,
        sidebar: state.sidebar,
        contentView: state.contentView,
        miniplayer: state.miniplayer,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.sidebar = clampBlockConfig(state.sidebar || {});
        state.contentView = clampBlockConfig(state.contentView || {});
        state.miniplayer = clampBlockConfig(state.miniplayer || {});
        void loadPersistedWallpaper().then((img) => {
          if (img) {
            useCustomizationStore.setState({ backgroundImage: img });
          }
        });
      },
    },
  ),
);

// computes composite inline style for a logic block container
export function getBlockStyle(
  config: BlockCustomization,
  isDark: boolean,
  hasCustomBg: boolean,
): React.CSSProperties {
  // when there is no custom wallpaper background, return empty style so default app styling applies
  if (!hasCustomBg) {
    return {};
  }

  if (config.opacity === 100 && config.blur === 0 && config.dim === 0) {
    return {
      background: isDark ? "var(--color-bg-primary, #0a0a0a)" : "var(--color-bg-primary, #f5f5f7)",
    };
  }

  const alpha = config.opacity / 100;
  const dimAlpha = config.dim / 100;
  const baseRgb = isDark ? "10, 10, 10" : "245, 245, 247";

  let bg: string;
  if (dimAlpha > 0) {
    bg = `linear-gradient(rgba(0, 0, 0, ${dimAlpha}), rgba(0, 0, 0, ${dimAlpha})), rgba(${baseRgb}, ${alpha})`;
  } else {
    bg = `rgba(${baseRgb}, ${alpha})`;
  }

  return {
    background: bg,
    backdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
    WebkitBackdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
  };
}
