import { CloseLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { wallpaperUrl } from "../../../appearance/appearanceStore";

export const TILE =
  "relative aspect-[16/10] overflow-hidden rounded-[10px] border-none p-0 cursor-pointer transition-[transform,box-shadow] duration-150 hover:scale-[1.02]";

interface WallpaperTileProps {
  wallpaperKey: string;
  kind: "image" | "video";
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function WallpaperTile({
  wallpaperKey,
  kind,
  active,
  onSelect,
  onRemove,
}: WallpaperTileProps) {
  const { t } = useTranslation();
  const url = wallpaperUrl(wallpaperKey);
  return (
    <div className="group relative">
      <button
        type="button"
        aria-pressed={active}
        onClick={onSelect}
        className={cn(
          TILE,
          "w-full bg-bg-elevated",
          active && "ring-2 ring-text-primary/70",
        )}
      >
        {kind === "video" ? (
          <video
            src={url}
            muted
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </button>
      <button
        type="button"
        aria-label={t("customization.remove_wallpaper")}
        title={t("customization.remove_wallpaper")}
        onClick={onRemove}
        className="absolute right-[4px] top-[4px] flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-black/60 p-0 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <CloseLine size={13} />
      </button>
    </div>
  );
}
