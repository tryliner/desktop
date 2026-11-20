import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import type { LoadedImage } from "./useCoverImage";
import { VIEWPORT, type CropState } from "./useCropState";
import { useCropGestures } from "./useCropGestures";
import { BusyVeil, CoverPlaceholder, ThirdsGrid } from "./CoverCropParts";

interface CoverCropAreaProps {
  image: LoadedImage | null;
  crop: CropState;
  busy: boolean;
  currentCover: string | null;
  onChoose: () => void;
  onFile: (file: File) => void;
}

function CroppedImage({
  image,
  crop,
}: {
  image: LoadedImage;
  crop: CropState;
}) {
  const scale =
    (VIEWPORT / Math.min(image.size.width, image.size.height)) * crop.zoom;
  return (
    <img
      src={image.url}
      alt=""
      draggable={false}
      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
      style={{
        width: image.size.width * scale,
        height: image.size.height * scale,
        transform: `translate(calc(-50% + ${crop.offset.x}px), calc(-50% + ${crop.offset.y}px))`,
      }}
    />
  );
}

export function CoverCropArea({
  image,
  crop,
  busy,
  currentCover,
  onChoose,
  onFile,
}: CoverCropAreaProps) {
  const { t } = useTranslation();
  const croppable = Boolean(image && !image.animated);
  const gestures = useCropGestures(crop, croppable, onFile);
  return (
    <div
      className={cn(
        "relative mx-auto h-[280px] w-[280px] touch-none overflow-hidden rounded-[14px] bg-bg-elevated outline-none transition-shadow",
        gestures.dragOver && "ring-2 ring-text-primary/60",
        croppable && "cursor-grab active:cursor-grabbing",
      )}
      tabIndex={image ? 0 : -1}
      aria-label={image ? t("playlist_cover.drag_hint") : undefined}
      {...gestures.handlers}
    >
      {image && image.animated && (
        <img
          src={image.url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      )}
      {image && !image.animated && <CroppedImage image={image} crop={crop} />}
      {!image && (
        <CoverPlaceholder
          currentCover={currentCover}
          disabled={busy}
          onChoose={onChoose}
        />
      )}
      {croppable && <ThirdsGrid visible={gestures.dragging} />}
      {busy && <BusyVeil />}
    </div>
  );
}
