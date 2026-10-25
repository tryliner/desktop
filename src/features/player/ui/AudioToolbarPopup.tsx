import { useShallow } from "zustand/react/shallow";
import { Tuning2 } from "@solar-icons/react";
import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui";
import { EQUALIZER_BANDS } from "../store/audioSettings";
import { usePlayerStore } from "../store/playerStore";
import { EqualizerControls } from "./EqualizerControls";
import { VolumeColumn } from "./VolumeColumn";

export function AudioToolbarPopup({
  onVolumeDraggingChange,
}: {
  onVolumeDraggingChange: (dragging: boolean) => void;
}) {
  const { t } = useTranslation();
  const state = usePlayerStore(
    useShallow((state) => ({
      isEqualizerEnabled: state.isEqualizerEnabled,
      setIsEqualizerEnabled: state.setIsEqualizerEnabled,
      setEqualizerBand: state.setEqualizerBand,
    })),
  );

  const resetEqualizer = () => {
    for (const band of EQUALIZER_BANDS) {
      state.setEqualizerBand(band.id, 0);
    }
  };

  return (
    <div className="flex min-w-0 items-stretch gap-[16px]">
      <div className="flex shrink-0 flex-col items-center gap-[7px] pt-[1px]">
        <span className="text-[10px] font-medium text-text-secondary">
          {t("player.volume")}
        </span>
        <VolumeColumn onDraggingChange={onVolumeDraggingChange} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-[10px] flex items-center justify-between gap-[12px]">
          <div className="flex min-w-0 items-center gap-[8px]">
            <Tuning2 size={17} weight="Outline" className="shrink-0" />
            <span className="truncate text-[13px] font-semibold text-text-primary">
              {t("settings.audio.equalizer.title")}
            </span>
            <span className="shrink-0 text-[10px] text-text-tertiary">
              ±12 dB
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-[10px]">
            <button
              type="button"
              className="border-0 bg-transparent p-0 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
              onClick={resetEqualizer}
            >
              {t("settings.audio.equalizer.flat")}
            </button>
            <ToggleSwitch
              ariaLabel={t("settings.audio.equalizer.title")}
              checked={state.isEqualizerEnabled}
              onChange={state.setIsEqualizerEnabled}
            />
          </div>
        </div>
        <EqualizerControls compact />
      </div>
    </div>
  );
}
