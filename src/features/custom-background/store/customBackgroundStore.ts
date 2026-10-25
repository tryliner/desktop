import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import {
  saveBackgroundMedia,
  loadBackgroundMedia,
  deleteBackgroundMedia,
  readLegacyWallpaper,
  dropLegacyWallpaper,
  type BackgroundMediaRecord,
} from "./backgroundMediaDb";

export type BackgroundMediaKind = "image" | "video";
export type BackgroundFileError = "type" | "size" | "save";

export interface BackgroundMediaInfo {
  kind: BackgroundMediaKind;
  type: string;
  name: string;
  size: number;
  savedAt: number;
}

export interface CustomBackgroundSettings {
  /** wallpaper blur in px */
  blur: number;
  /** black overlay on the wallpaper, 0..80 % */
  dim: number;
  /** how see-through sidebar, content and player bar are, 0..100 % */
  panelTransparency: number;
  /** let pages with a cover backdrop (album, artist, ...) show it instead */
  useCoversOnPages: boolean;
  media: BackgroundMediaInfo | null;
  legacyChecked: boolean;
}

interface CustomBackgroundState extends CustomBackgroundSettings {
  /** blob: url of the stored file, null until loaded */
  mediaUrl: string | null;
  setBlur: (blur: number) => void;
  setDim: (dim: number) => void;
  setPanelTransparency: (value: number) => void;
  setUseCoversOnPages: (value: boolean) => void;
  setMediaFile: (file: File) => Promise<BackgroundFileError | null>;
  /** false when the stored file couldn't be deleted; state is left as is */
  removeMedia: () => Promise<boolean>;
  loadMedia: () => Promise<void>;
}

export const MAX_BACKGROUND_BYTES = 30 * 1024 * 1024;
export const MAX_BACKGROUND_BLUR = 40;
export const MAX_BACKGROUND_DIM = 80;
export const MAX_PANEL_TRANSPARENCY = 100;

export const BACKGROUND_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const BACKGROUND_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const BACKGROUND_ACCEPT = [
  ...BACKGROUND_IMAGE_TYPES,
  ...BACKGROUND_VIDEO_TYPES,
].join(",");

const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

export const DEFAULT_CUSTOM_BACKGROUND: CustomBackgroundSettings = {
  blur: 0,
  dim: 25,
  panelTransparency: 40,
  useCoversOnPages: false,
  media: null,
  legacyChecked: false,
};

const LEGACY_SETTINGS_KEY = "liner_customization_v1";
// keeps a fading-out layer alive until its crossfade has finished
const REVOKE_DELAY_MS = 1500;

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export const clampBlur = (v: unknown) =>
  clampInt(v, 0, MAX_BACKGROUND_BLUR, DEFAULT_CUSTOM_BACKGROUND.blur);
export const clampDim = (v: unknown) =>
  clampInt(v, 0, MAX_BACKGROUND_DIM, DEFAULT_CUSTOM_BACKGROUND.dim);
export const clampPanelTransparency = (v: unknown) =>
  clampInt(
    v,
    0,
    MAX_PANEL_TRANSPARENCY,
    DEFAULT_CUSTOM_BACKGROUND.panelTransparency,
  );

/** Resolves a file's mime type, falling back to its extension when the OS reports none. */
export function resolveBackgroundType(file: {
  type: string;
  name: string;
}): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? "";
}

export function getBackgroundKind(type: string): BackgroundMediaKind | null {
  if ((BACKGROUND_IMAGE_TYPES as readonly string[]).includes(type))
    return "image";
  if ((BACKGROUND_VIDEO_TYPES as readonly string[]).includes(type))
    return "video";
  return null;
}

export function validateBackgroundFile(file: {
  type: string;
  name: string;
  size: number;
}):
  { kind: BackgroundMediaKind; type: string } | { error: BackgroundFileError } {
  const type = resolveBackgroundType(file);
  const kind = getBackgroundKind(type);
  if (!kind) return { error: "type" };
  if (file.size > MAX_BACKGROUND_BYTES) return { error: "size" };
  return { kind, type };
}

function sanitizeMedia(value: unknown): BackgroundMediaInfo | null {
  if (!value || typeof value !== "object") return null;
  const media = value as Partial<BackgroundMediaInfo>;
  const kind =
    typeof media.type === "string" ? getBackgroundKind(media.type) : null;
  if (!kind) return null;
  return {
    kind,
    type: media.type as string,
    name: typeof media.name === "string" ? media.name : "",
    size: typeof media.size === "number" ? media.size : 0,
    savedAt: typeof media.savedAt === "number" ? media.savedAt : 0,
  };
}

/** Clamps persisted values so a hand-edited or older payload can't break the layout. */
export function sanitizeBackgroundSettings(
  value: unknown,
): CustomBackgroundSettings {
  const raw = (
    value && typeof value === "object" ? value : {}
  ) as Partial<CustomBackgroundSettings>;
  return {
    blur: clampBlur(raw.blur),
    dim: clampDim(raw.dim),
    panelTransparency: clampPanelTransparency(raw.panelTransparency),
    useCoversOnPages:
      typeof raw.useCoversOnPages === "boolean" ? raw.useCoversOnPages : false,
    media: sanitizeMedia(raw.media),
    legacyChecked: raw.legacyChecked === true,
  };
}

function toMediaInfo(
  record: BackgroundMediaRecord,
): BackgroundMediaInfo | null {
  const kind = getBackgroundKind(record.type);
  if (!kind) return null;
  return {
    kind,
    type: record.type,
    name: record.name,
    size: record.size,
    savedAt: record.savedAt,
  };
}

function createObjectUrl(blob: Blob): string | null {
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function revokeLater(url: string | null) {
  if (!url) return;
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, REVOKE_DELAY_MS);
}

// pulls blur / dim / block opacity out of the 0.1.x customization store
function readLegacySettings(): Partial<CustomBackgroundSettings> {
  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return {};
    const state = JSON.parse(raw)?.state ?? {};
    const opacity = state.contentView?.opacity;
    return {
      blur: clampBlur(state.backgroundBlur),
      dim: clampDim(state.backgroundDim),
      ...(typeof opacity === "number"
        ? { panelTransparency: clampPanelTransparency(100 - opacity) }
        : {}),
    };
  } catch {
    return {};
  }
}

// bumps on every file change so a slow load can't overwrite a newer pick
let mediaToken = 0;

export const useCustomBackgroundStore = create<CustomBackgroundState>()(
  persist(
    (set, get) => {
      const applyRecord = (record: BackgroundMediaRecord, token: number) => {
        const media = toMediaInfo(record);
        const url = media ? createObjectUrl(record.blob) : null;
        if (token !== mediaToken) {
          revokeLater(url);
          return;
        }
        const previous = get().mediaUrl;
        set({ media, mediaUrl: url });
        if (previous !== url) revokeLater(previous);
      };

      return {
        ...DEFAULT_CUSTOM_BACKGROUND,
        mediaUrl: null,

        setBlur: (blur) => set({ blur: clampBlur(blur) }),
        setDim: (dim) => set({ dim: clampDim(dim) }),
        setPanelTransparency: (value) =>
          set({ panelTransparency: clampPanelTransparency(value) }),
        setUseCoversOnPages: (value) =>
          set({ useCoversOnPages: Boolean(value) }),

        setMediaFile: async (file) => {
          const result = validateBackgroundFile(file);
          if ("error" in result) return result.error;
          const token = ++mediaToken;
          // keep the resolved type so files without one still play back
          const blob =
            file.type === result.type
              ? file
              : file.slice(0, file.size, result.type);
          try {
            const record = await saveBackgroundMedia(blob, file.name);
            applyRecord(record, token);
            return null;
          } catch {
            return "save";
          }
        },

        removeMedia: async () => {
          // also stops a startup load that is still in flight
          mediaToken++;
          try {
            await deleteBackgroundMedia();
          } catch {
            return false;
          }
          const previous = get().mediaUrl;
          set({ media: null, mediaUrl: null });
          revokeLater(previous);
          return true;
        },

        loadMedia: async () => {
          if (get().mediaUrl) return;
          const token = ++mediaToken;
          const record = await loadBackgroundMedia();
          if (token !== mediaToken) return;
          if (record) {
            applyRecord(record, token);
            return;
          }
          if (get().media) {
            // settings survived but the file is gone (profile reset, cleared site data)
            set({ media: null });
            return;
          }
          if (get().legacyChecked) return;

          const legacy = await readLegacyWallpaper();
          if (token !== mediaToken) return;
          if (
            legacy &&
            "kind" in
              validateBackgroundFile({
                type: legacy.type,
                name: "",
                size: legacy.size,
              })
          ) {
            try {
              const saved = await saveBackgroundMedia(legacy, "wallpaper");
              set(readLegacySettings());
              applyRecord(saved, token);
            } catch {
              return;
            }
          }
          dropLegacyWallpaper();
          try {
            localStorage.removeItem(LEGACY_SETTINGS_KEY);
          } catch {}
          set({ legacyChecked: true });
        },
      };
    },
    {
      name: "liner_custom_background_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state): CustomBackgroundSettings => ({
        blur: state.blur,
        dim: state.dim,
        panelTransparency: state.panelTransparency,
        useCoversOnPages: state.useCoversOnPages,
        media: state.media,
        legacyChecked: state.legacyChecked,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeBackgroundSettings(persisted),
      }),
    },
  ),
);
