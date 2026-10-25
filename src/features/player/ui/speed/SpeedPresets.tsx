import { motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";

export interface SpeedPresetsProps {
  rate: number;
  onSelect: (rate: number) => void;
}

export function SpeedPresets({ rate, onSelect }: SpeedPresetsProps) {
  const { t } = useTranslation();
  const presets = [
    { label: "x0.8", rate: 0.8, title: t("player.preset_slowed") },
    { label: "x0.9", rate: 0.9, title: "x0.9" },
    { label: "x1.0", rate: 1.0, title: t("player.preset_normal") },
    { label: "x1.15", rate: 1.15, title: "x1.15" },
    { label: "x1.25", rate: 1.25, title: t("player.preset_speedup") },
    { label: "x1.35", rate: 1.35, title: t("player.preset_nightcore") },
  ];

  return (
    <div className="grid grid-cols-6 gap-[4px]">
      {presets.map((preset) => {
        const active = Math.abs(rate - preset.rate) < 0.02;
        return (
          <button
            key={preset.rate}
            type="button"
            title={preset.title}
            onClick={() => onSelect(preset.rate)}
            className={cn(
              "relative flex h-[26px] items-center justify-center rounded-[6px] border-0 text-[11px] font-[600] transition-colors",
              active
                ? "text-bg-primary"
                : "bg-black/[0.06] text-text-secondary hover:text-text-primary dark:bg-white/[0.06]",
            )}
          >
            {active && (
              <motion.span
                layoutId="active-speed-preset"
                className="absolute inset-0 rounded-[6px] bg-text-primary/80"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
