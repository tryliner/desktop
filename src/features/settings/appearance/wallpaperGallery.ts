import { useCallback, useEffect, useState } from "react";

export interface GalleryWallpaper {
  key: string;
  kind: "image" | "video";
  mimeType: string;
  byteSize: number;
  addedAt: number;
}

export class WallpaperError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

const bridge = () =>
  typeof window !== "undefined" && window.linerElectron?.wallpapersAdd
    ? window.linerElectron
    : null;

/** wallpapers are kept on disk by the desktop app (not in IndexedDB, which "clear cache" wipes) */
export function canUseWallpapers(): boolean {
  return Boolean(bridge());
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

export async function addWallpaper(file: Blob): Promise<GalleryWallpaper> {
  const api = bridge();
  if (!api) throw new WallpaperError("unavailable");
  const result = await api.wallpapersAdd(
    new Uint8Array(await file.arrayBuffer()),
  );
  if (!result.ok) throw new WallpaperError(result.reason);
  changed();
  return result.wallpaper;
}

export async function removeWallpaper(key: string): Promise<void> {
  await bridge()?.wallpapersRemove(key);
  changed();
}

export function useWallpaperGallery() {
  const [items, setItems] = useState<GalleryWallpaper[]>([]);
  const refresh = useCallback(() => {
    void bridge()
      ?.wallpapersList()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);
  return items;
}
