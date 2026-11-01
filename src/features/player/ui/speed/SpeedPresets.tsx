import { useTranslation } from "@/languages";
import { PresetPills } from "@/shared/ui/PresetPills";

export interface SpeedPresetsProps {
  rate: number;
  onSelect: (rate: number) => void;
}

export function SpeedPresets({ rate, onSelect }: SpeedPresetsProps) {
  const { t } = useTranslation();
  const presets = [
    { label: "x0.8", value: 0.8, title: t("player.preset_slowed") },
    { label: "x0.9", value: 0.9, title: "x0.9" },
    { label: "x1.0", value: 1.0, title: t("player.preset_normal") },
    { label: "x1.15", value: 1.15, title: "x1.15" },
    { label: "x1.25", value: 1.25, title: t("player.preset_speedup") },
    { label: "x1.35", value: 1.35, title: t("player.preset_nightcore") },
  ];

  return (
    <PresetPills
      options={presets}
      value={rate}
      onChange={onSelect}
      isActive={(option, current) => Math.abs(current - option) < 0.02}
    />
  );
}
