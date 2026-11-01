import { useState } from "react";
import { Dialog } from "@/shared/ui";
import { CloseLine, TimeLine, MoonLine } from "@mingcute/react";
import { useSleepTimerStore, type SleepTimerMode } from "../store/sleepTimerStore";
import { formatRemainingTime } from "../hooks/useSleepTimer";
import { usePlayerStore } from "@/features/player/store/playerStore";

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SleepTimerModal({ isOpen, onClose }: SleepTimerModalProps) {
  const mode = useSleepTimerStore((s) => s.mode);
  const isActive = useSleepTimerStore((s) => s.isActive);
  const remainingSeconds = useSleepTimerStore((s) => s.remainingSeconds);
  const isFadingOut = useSleepTimerStore((s) => s.isFadingOut);
  const startTimer = useSleepTimerStore((s) => s.startTimer);
  const cancelTimer = useSleepTimerStore((s) => s.cancelTimer);

  const [customInput, setCustomInput] = useState(25);
  const volume = usePlayerStore((s) => s.volume);

  const handleSelectPreset = (presetMode: Exclude<SleepTimerMode, "off" | "custom">) => {
    startTimer(presetMode, undefined, volume);
    onClose();
  };

  const handleStartCustom = () => {
    startTimer("custom", customInput, volume);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      maxWidth={380}
      className="p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <MoonLine className="text-text-primary text-lg" />
          <h3 className="font-semibold text-base text-text-primary m-0">Sleep Timer</h3>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="p-1 rounded-full text-text-tertiary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <CloseLine className="text-lg" />
        </button>
      </div>

      {/* Active status banner */}
      {isActive && (
        <div className="mt-4 p-3 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TimeLine className="text-text-primary animate-pulse text-lg shrink-0" />
            <div>
              <div className="text-xs text-text-secondary">
                {mode === "end_of_track" ? "End of current track" : "Time remaining"}
              </div>
              <div className="text-sm font-bold text-text-primary">
                {formatRemainingTime(remainingSeconds)}
                {isFadingOut && (
                  <span className="ml-2 text-xs font-normal text-amber-500 dark:text-amber-300">
                    (Fading out)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={cancelTimer}
            type="button"
            className="px-2.5 py-1 text-xs rounded-lg bg-black/10 dark:bg-white/10 hover:bg-red-500/30 text-text-primary hover:text-red-400 transition-colors cursor-pointer"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Preset Buttons */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "15 min", mode: "15" as const },
          { label: "30 min", mode: "30" as const },
          { label: "45 min", mode: "45" as const },
          { label: "60 min", mode: "60" as const },
        ].map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => handleSelectPreset(item.mode)}
            className={`py-2 px-3 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
              isActive && mode === item.mode
                ? "bg-white/20 text-white border border-white/30 shadow-md"
                : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-primary border border-transparent"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* End of Track option */}
      <button
        type="button"
        onClick={() => handleSelectPreset("end_of_track")}
        className={`mt-2 w-full py-2.5 px-3 rounded-xl text-sm font-medium transition-all text-left flex items-center justify-between cursor-pointer ${
          isActive && mode === "end_of_track"
            ? "bg-white/20 text-white border border-white/30 shadow-md"
            : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-primary border border-transparent"
        }`}
      >
        <span>End of current track</span>
        <span className="text-xs text-text-tertiary">Smart Fade-Out</span>
      </button>

      {/* Custom Duration */}
      <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
        <div className="text-xs text-text-secondary mb-2">Custom minutes:</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={480}
            value={customInput}
            onChange={(e) => setCustomInput(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm text-center text-text-primary focus:outline-none focus:border-white/30"
          />
          <span className="text-sm text-text-secondary">min</span>
          <button
            type="button"
            onClick={handleStartCustom}
            className="ml-auto px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors cursor-pointer border border-white/15 shadow-sm"
          >
            Set Timer
          </button>
        </div>
      </div>
    </Dialog>
  );
}
