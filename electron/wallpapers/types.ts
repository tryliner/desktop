export interface WallpaperView {
  key: string;
  kind: "image" | "video";
  mimeType: string;
  byteSize: number;
  addedAt: number;
}

export type WallpaperAddResult =
  | { ok: true; wallpaper: WallpaperView }
  | {
      ok: false;
      reason:
        "invalid" | "unsupported-type" | "too-large" | "empty" | "write-failed";
    };
