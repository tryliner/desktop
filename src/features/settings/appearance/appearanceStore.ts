import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";

export interface AppearanceSettings {
  wallpaperKey: string | null;
  wallpaperKind: "image" | "video" | null;
  blur: number;
  dim: number;
  saturation: number;
  surfaceOpacity: number;
  readable: boolean;
  albumBackdrop: boolean;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  wallpaperKey: null,
  wallpaperKind: null,
  blur: 24,
  dim: 0.3,
  saturation: 1.1,
  surfaceOpacity: 0.45,
  readable: true,
  albumBackdrop: false,
};

export const APPEARANCE_KEY = "liner_appearance_v2";
const LEGACY_KEY = "liner_customization_v1";

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export function sanitizeAppearance(
  raw: Partial<Record<keyof AppearanceSettings, unknown>>,
  base: AppearanceSettings = DEFAULT_APPEARANCE,
): AppearanceSettings {
  return {
    wallpaperKey:
      typeof raw.wallpaperKey === "string" &&
      /^[a-f0-9]{20}$/.test(raw.wallpaperKey)
        ? raw.wallpaperKey
        : raw.wallpaperKey === null
          ? null
          : base.wallpaperKey,
    wallpaperKind:
      raw.wallpaperKind === "image" || raw.wallpaperKind === "video"
        ? raw.wallpaperKind
        : raw.wallpaperKind === null
          ? null
          : base.wallpaperKind,
    blur: clamp(raw.blur, 0, 40, base.blur),
    dim: clamp(raw.dim, 0, 0.85, base.dim),
    saturation: clamp(raw.saturation, 0.5, 1.6, base.saturation),
    surfaceOpacity: clamp(raw.surfaceOpacity, 0, 0.9, base.surfaceOpacity),
    readable: typeof raw.readable === "boolean" ? raw.readable : base.readable,
    albumBackdrop:
      typeof raw.albumBackdrop === "boolean"
        ? raw.albumBackdrop
        : base.albumBackdrop,
  };
}

export function fromLegacyCustomization(
  raw: unknown,
): Partial<AppearanceSettings> {
  const state = (raw as { state?: Record<string, unknown> } | null)?.state;
  if (!state) return {};
  const out: Partial<AppearanceSettings> = {};
  if (typeof state.backgroundBlur === "number") {
    out.blur = clamp(state.backgroundBlur, 0, 40, DEFAULT_APPEARANCE.blur);
  }
  if (typeof state.backgroundDim === "number") {
    out.dim = clamp(state.backgroundDim / 100, 0, 0.85, DEFAULT_APPEARANCE.dim);
  }
  return out;
}

function legacySeed(): Partial<AppearanceSettings> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? fromLegacyCustomization(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

interface AppearanceState extends AppearanceSettings {
  set: (patch: Partial<AppearanceSettings>) => void;
  reset: () => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...DEFAULT_APPEARANCE,
      ...(typeof localStorage !== "undefined" ? legacySeed() : {}),
      set: (patch) =>
        set((state) => sanitizeAppearance({ ...state, ...patch }, state)),
      reset: () => set({ ...DEFAULT_APPEARANCE }),
    }),
    {
      name: APPEARANCE_KEY,
      version: 1,
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => {
        const { set: _set, reset: _reset, ...settings } = state;
        return settings;
      },
      migrate: (persisted) =>
        sanitizeAppearance(
          (persisted ?? {}) as Partial<
            Record<keyof AppearanceSettings, unknown>
          >,
        ),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeAppearance(
          (persisted ?? {}) as Partial<
            Record<keyof AppearanceSettings, unknown>
          >,
          current,
        ),
      }),
    },
  ),
);

export function useHasWallpaper(): boolean {
  return useAppearanceStore((s) => Boolean(s.wallpaperKey));
}

export function wallpaperUrl(key: string): string {
  return `liner-local://wallpaper/${key}`;
}
