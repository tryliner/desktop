import { useRef, useState } from "react";
import { AddLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { useAppearanceStore } from "../../../appearance/appearanceStore";
import {
  removeWallpaper,
  useWallpaperGallery,
} from "../../../appearance/wallpaperGallery";
import { TILE, WallpaperTile } from "./WallpaperTile";

const WALLPAPER_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm";

interface WallpaperGalleryProps {
  adding: boolean;
  onAdd: (file: File) => void;
}

export function WallpaperGallery({ adding, onAdd }: WallpaperGalleryProps) {
  const { t } = useTranslation();
  const selected = useAppearanceStore((s) => s.wallpaperKey);
  const set = useAppearanceStore((s) => s.set);
  const gallery = useWallpaperGallery();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const clear = () => set({ wallpaperKey: null, wallpaperKind: null });

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={WALLPAPER_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onAdd(file);
        }}
      />
      <div
        className="grid grid-cols-4 gap-[8px]"
        onDragOver={(e) => {
          if ([...e.dataTransfer.items].some((i) => i.kind === "file")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onAdd(file);
        }}
      >
        <button
          type="button"
          aria-pressed={!selected}
          onClick={clear}
          className={cn(
            TILE,
            "flex items-center justify-center bg-fill text-caption font-[500] text-text-secondary",
            !selected && "ring-2 ring-text-primary/70",
          )}
        >
          {t("customization.none")}
        </button>
        {gallery.map((item) => (
          <WallpaperTile
            key={item.key}
            wallpaperKey={item.key}
            kind={item.kind}
            active={selected === item.key}
            onSelect={() =>
              set({ wallpaperKey: item.key, wallpaperKind: item.kind })
            }
            onRemove={() => {
              if (selected === item.key) clear();
              void removeWallpaper(item.key);
            }}
          />
        ))}
        <button
          type="button"
          disabled={adding}
          onClick={() => fileInput.current?.click()}
          className={cn(
            TILE,
            "flex flex-col items-center justify-center gap-[4px] border-[1.5px] border-dashed border-border-alpha-33 bg-transparent text-caption text-text-secondary hover:text-text-primary disabled:opacity-50",
            dragOver && "border-text-primary text-text-primary",
          )}
        >
          {adding ? (
            <span className="h-[16px] w-[16px] animate-spin rounded-full border-[2px] border-current border-t-transparent" />
          ) : (
            <AddLine size={18} />
          )}
          {t("customization.add")}
        </button>
      </div>
      <p className="m-0 text-caption text-text-tertiary">
        {t("customization.add_hint")}
      </p>
    </>
  );
}
