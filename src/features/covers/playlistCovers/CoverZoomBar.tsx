import {
  RefreshAnticlockwise1Line,
  ZoomInLine,
  ZoomOutLine,
} from "@mingcute/react";
import { Slider } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { MAX_ZOOM, MIN_ZOOM } from "./coverCrop";
import {
  CENTER,
  sliderToZoom,
  zoomToSlider,
  type CropState,
} from "./useCropState";

const ZOOM_STEP = 1.25;
const ICON_BUTTON =
  "flex h-[28px] w-[28px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";

interface CoverZoomBarProps {
  crop: CropState;
  onChange: () => void;
}

export function CoverZoomBar({ crop, onChange }: CoverZoomBarProps) {
  const { t } = useTranslation();
  const percent = Math.round(crop.zoom * 100);
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex h-[40px] items-center gap-[2px] rounded-full bg-fill px-[6px]">
        <button
          type="button"
          aria-label={t("playlist_cover.zoom_out")}
          title={t("playlist_cover.zoom_out")}
          disabled={crop.zoom <= MIN_ZOOM + 0.001}
          onClick={() => crop.zoomAt(crop.zoom / ZOOM_STEP, CENTER)}
          className={ICON_BUTTON}
        >
          <ZoomOutLine size={16} />
        </button>
        <div className="min-w-0 flex-1 px-[2px]">
          <Slider
            ariaLabel={t("playlist_cover.zoom")}
            value={zoomToSlider(crop.zoom)}
            min={0}
            max={1}
            step={0.01}
            showValue={false}
            onChange={(value) => crop.zoomAt(sliderToZoom(value), CENTER)}
          />
        </div>
        <button
          type="button"
          aria-label={t("playlist_cover.zoom_in")}
          title={t("playlist_cover.zoom_in")}
          disabled={crop.zoom >= MAX_ZOOM - 0.001}
          onClick={() => crop.zoomAt(crop.zoom * ZOOM_STEP, CENTER)}
          className={ICON_BUTTON}
        >
          <ZoomInLine size={16} />
        </button>
        <span className="w-[42px] shrink-0 pr-[6px] text-right text-caption font-[500] tabular-nums text-text-secondary">
          {percent}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-[8px] px-[4px]">
        <span className="min-w-0 truncate text-caption text-text-tertiary">
          {t("playlist_cover.drag_hint")}
        </span>
        <div className="flex shrink-0 items-center gap-[6px]">
          {crop.changed && (
            <button
              type="button"
              onClick={crop.reset}
              className="flex cursor-pointer items-center gap-[4px] rounded-control border-none bg-transparent px-[8px] py-[5px] text-caption font-[500] text-text-secondary hover:bg-fill-hover hover:text-text-primary"
            >
              <RefreshAnticlockwise1Line size={13} />
              {t("playlist_cover.reset")}
            </button>
          )}
          <button
            type="button"
            onClick={onChange}
            className="shrink-0 cursor-pointer rounded-control border-none bg-fill px-[10px] py-[5px] text-caption font-[500] text-text-primary hover:bg-fill-hover"
          >
            {t("playlist_cover.change")}
          </button>
        </div>
      </div>
    </div>
  );
}
