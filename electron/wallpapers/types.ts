export interface WallpaperView {
  /** 20-hex key; served as liner-local://wallpaper/<key> */
  key: string;
  kind: "image" | "video";
  mimeType: string;
  byteSize: number;
  /** epoch ms */
  addedAt: number;
}

export type WallpaperAddResult =
  | { ok: true; wallpaper: WallpaperView }
  | {
      ok: false;
      reason:
        "invalid" | "unsupported-type" | "too-large" | "empty" | "write-failed";
    };
