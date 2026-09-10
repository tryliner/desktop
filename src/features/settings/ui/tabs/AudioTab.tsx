import { useTranslation } from "@/languages";
import { usePlayerStore } from "@/features/player";
import { ToggleSwitch } from "@/shared/ui";

export function AudioTab() {
  const { t } = useTranslation();
  const pauseOnDeviceChange = usePlayerStore(
    (state) => state.pauseOnDeviceChange,
  );
  const setPauseOnDeviceChange = usePlayerStore(
    (state) => state.setPauseOnDeviceChange,
  );

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.audio.pause_on_device_change.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.audio.pause_on_device_change.description")}
          </p>
        </div>

        <ToggleSwitch
          checked={pauseOnDeviceChange}
          onChange={setPauseOnDeviceChange}
        />
      </div>
    </div>
  );
}
