import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useAppearanceStore } from "../../../appearance/appearanceStore";
import {
  WallpaperError,
  addWallpaper,
} from "../../../appearance/wallpaperGallery";

function errorKey(error: unknown): string {
  const reason = error instanceof WallpaperError ? error.reason : "";
  if (reason === "too-large") return "customization.error_size";
  if (reason === "unsupported-type") return "customization.error_type";
  return "customization.error_add";
}

export function useWallpaperAdd(enabled: boolean) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const latest = useRef(0);

  const add = useCallback(
    async (file: File) => {
      const id = ++latest.current;
      const selectedAtStart = useAppearanceStore.getState().wallpaperKey;
      setAdding(true);
      try {
        const wallpaper = await addWallpaper(file);
        const state = useAppearanceStore.getState();
        if (id !== latest.current || state.wallpaperKey !== selectedAtStart) {
          return;
        }
        state.set({
          wallpaperKey: wallpaper.key,
          wallpaperKind: wallpaper.kind,
        });
      } catch (error) {
        showToast(t(errorKey(error)), "error");
      } finally {
        if (id === latest.current) setAdding(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (!file) return;
      event.preventDefault();
      void add(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enabled, add]);

  return { add, adding };
}
