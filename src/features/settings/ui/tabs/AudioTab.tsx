import { useTranslation } from "@/languages";
import { usePlayerStore } from "@/features/player";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import { ToggleSwitch } from "@/shared/ui";
import { CheckFill } from "@mingcute/react";

const CheckIcon = () => <CheckFill size={16} className="text-text-primary" />;
const EmptyIcon = () => <div style={{ width: 16, height: 16 }} />;

export function AudioTab() {
  const { t } = useTranslation();
  const audioQuality = usePlayerStore((state) => state.audioQuality);
  const setAudioQuality = usePlayerStore((state) => state.setAudioQuality);
  const pauseOnDeviceChange = usePlayerStore(
    (state) => state.pauseOnDeviceChange,
  );
  const setPauseOnDeviceChange = usePlayerStore(
    (state) => state.setPauseOnDeviceChange,
  );

  const qualityLabels: Record<string, string> = {
    low: t("settings.audio.low"),
    standard: t("settings.audio.standard"),
    high: t("settings.audio.high"),
    lossless: t("settings.audio.lossless"),
  };

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.audio.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.audio.description")}
          </p>
        </div>

        <DropdownMenu
          items={[
            {
              id: "Low",
              label: qualityLabels.low,
              icon:
                audioQuality === "low" ? <CheckIcon /> : <EmptyIcon />,
              onClick: () => setAudioQuality("low"),
            },
            {
              id: "Standard",
              label: qualityLabels.standard,
              icon:
                audioQuality === "standard" ? (
                  <CheckIcon />
                ) : (
                  <EmptyIcon />
                ),
              onClick: () => setAudioQuality("standard"),
            },
            {
              id: "High",
              label: qualityLabels.high,
              icon:
                audioQuality === "high" ? <CheckIcon /> : <EmptyIcon />,
              onClick: () => setAudioQuality("high"),
            },
            {
              id: "Lossless",
              label: qualityLabels.lossless,
              icon:
                audioQuality === "lossless" ? (
                  <CheckIcon />
                ) : (
                  <EmptyIcon />
                ),
              onClick: () => setAudioQuality("lossless"),
            },
          ]}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-[8px] rounded-lg border border-border-primary bg-bg-elevated px-[14px] py-[8px] text-[13px] text-text-primary hover:border-border-primary/80 transition-colors cursor-pointer"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              <span>{qualityLabels[audioQuality] || audioQuality}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-60"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          }
        />
      </div>

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
