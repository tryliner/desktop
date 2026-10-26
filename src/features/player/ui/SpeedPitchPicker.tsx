import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SparklesFill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { RulerControl } from "./speed/RulerControl";
import { OptionToggle } from "./speed/OptionToggle";
import { SpeedPresets } from "./speed/SpeedPresets";

export interface SpeedPitchPickerProps {
  className?: string;
  onClose?: () => void;
}

const MIN_REVERB_ON_ENABLE = 0.1;
const DEFAULT_REVERB_LEVEL = 0.4;

const formatRate = (rate: number) => `x${rate.toFixed(2)}`;
const formatPitch = (pitch: number) =>
  `${pitch > 0 ? "+" : ""}${pitch.toFixed(1)} st`;
const formatPercent = (level: number) => `${Math.round(level * 100)}%`;

export const SpeedPitchPicker = memo(function SpeedPitchPicker({
  className,
}: SpeedPitchPickerProps) {
  const { t } = useTranslation();
  const player = usePlayerState();
  const playbackRate = player.playbackRate ?? 1;
  const pitchSemitones = player.pitchSemitones ?? 0;
  const isPitchLinked = player.isPitchLinked ?? true;
  const keepSpeedAcrossTracks = player.keepSpeedAcrossTracks ?? true;
  const isReverbEnabled = player.isReverbEnabled ?? false;
  const reverbLevel = player.reverbLevel ?? 0.35;

  const toggleReverb = (enabled: boolean) => {
    if (enabled && reverbLevel < MIN_REVERB_ON_ENABLE) {
      playerEngine.setReverbLevel(DEFAULT_REVERB_LEVEL);
    }
    playerEngine.setIsReverbEnabled(enabled);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-[14px] text-text-primary select-none",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <SpeedPresets
        rate={playbackRate}
        onSelect={(rate) => playerEngine.setPlaybackRate(rate)}
      />
      <RulerControl
        label={t("player.speed")}
        value={playbackRate}
        min={0.5}
        max={2}
        step={0.05}
        neutral={1}
        format={formatRate}
        onChange={(rate) => playerEngine.setPlaybackRate(rate)}
      />
      <RulerControl
        label={t("player.pitch")}
        value={pitchSemitones}
        min={-12}
        max={12}
        step={0.5}
        neutral={0}
        format={formatPitch}
        onChange={(pitch) => playerEngine.setPitchSemitones(pitch)}
      />
      <div className="flex flex-col gap-[12px] pt-[2px]">
        <OptionToggle
          title={t("player.link_speed_pitch")}
          hint={
            isPitchLinked
              ? t("player.link_speed_pitch_hint")
              : t("player.key_lock_hint")
          }
          checked={isPitchLinked}
          ariaLabel={t("player.link_speed_pitch")}
          onChange={(linked) => playerEngine.setIsPitchLinked(linked)}
        />
        <OptionToggle
          title={t("player.keep_speed_across_tracks")}
          hint={t("player.keep_speed_hint")}
          checked={keepSpeedAcrossTracks}
          ariaLabel={t("player.keep_speed_across_tracks")}
          onChange={(keep) => playerEngine.setKeepSpeedAcrossTracks(keep)}
        />
        <div>
          <OptionToggle
            title={
              <>
                {t("player.reverb")}
                <SparklesFill size={13} className="shrink-0 text-amber-400" />
              </>
            }
            hint={t("player.reverb_hint")}
            checked={isReverbEnabled}
            ariaLabel={t("player.reverb")}
            onChange={toggleReverb}
          />
          <AnimatePresence initial={false}>
            {isReverbEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-[12px]">
                  <RulerControl
                    label={t("player.reverb_amount")}
                    value={reverbLevel}
                    min={0.05}
                    max={1}
                    step={0.05}
                    format={formatPercent}
                    onChange={(level) => playerEngine.setReverbLevel(level)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

export default SpeedPitchPicker;
