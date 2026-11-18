import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import { PRESET_IDS, isHexColor, type PresetId } from "./themePresets";

export type AccentChoice = "default" | "cover" | `#${string}`;

export interface AppearanceSettings {
  preset: PresetId;
  accent: AccentChoice;
  /** key of a wallpaper in the on-device gallery, or null for none */
  wallpaperKey: string | null;
  wallpaperKind: "image" | "video" | null;
  /** px of blur on the wallpaper, 0-40 */
  blur: number;
  /** 0-0.85: how much the wallpaper is darkened (dark) or lightened (light) */
  dim: number;
  /** 0.5-1.6, 1 = as is */
  saturation: number;
  /** 0-0.9: tint of the frosted panels over the wallpaper */
  surfaceOpacity: number;
  /** raise the dim by itself when the picture is too bright/dark for text */
  readable: boolean;
  /** still tint the background with the page's cover art over the wallpaper */
  albumBackdrop: boolean;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  preset: "default",
  accent: "default",
  wallpaperKey: null,
  wallpaperKind: null,
  blur: 24,
  dim: 0.3,
  saturation: 1.1,
  surfaceOpacity: 0.45,
  readable: true,
  // off by default: the cover glow is opaque enough to hide the wallpaper
  albumBackdrop: false,
};

export const APPEARANCE_KEY = "liner_appearance_v2";
const LEGACY_KEY = "liner_customization_v1";

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

/** anything read back from storage or a theme file goes through here */
export function sanitizeAppearance(
  raw: Partial<Record<keyof AppearanceSettings, unknown>>,
  base: AppearanceSettings = DEFAULT_APPEARANCE,
): AppearanceSettings {
  const accent = raw.accent;
  return {
    preset: PRESET_IDS.includes(raw.preset as PresetId)
      ? (raw.preset as PresetId)
      : base.preset,
    accent:
      accent === "default" || accent === "cover" || isHexColor(accent)
        ? (accent as AccentChoice)
        : base.accent,
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

/**
 * People who had a wallpaper before it was removed keep their blur and dim
 * (the old store used 0-40 px and a 0-85 % dim).
 */
export function fromLegacyCustomization(
  raw: unknown,
): Partial<AppearanceSettings> {
  const state = (raw as { state?: Record<string, unknown> } | null)?.state;
  if (!state) return {};
  const out: Partial<AppearanceSettings> = {};
  if (typeof state.backgroundBlur === "number" && state.backgroundBlur > 0) {
    out.blur = clamp(state.backgroundBlur, 0, 40, DEFAULT_APPEARANCE.blur);
  }
  if (typeof state.backgroundDim === "number" && state.backgroundDim > 0) {
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
