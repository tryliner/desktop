import { useState } from "react";
import { MoonLine } from "@mingcute/react";
import { useSleepTimer, formatRemainingTime } from "../hooks/useSleepTimer";
import { SleepTimerModal } from "./SleepTimerModal";

export function SleepTimerButton({ className = "" }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { isActive, remainingSeconds, isFadingOut } = useSleepTimer();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title={isActive ? `Sleep Timer: ${formatRemainingTime(remainingSeconds)} remaining` : "Sleep Timer"}
        className={`relative flex shrink-0 items-center justify-center transition-colors ${
          isActive
            ? "text-text-primary bg-white/15 dark:bg-white/20 hover:bg-white/25"
            : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
        } ${className}`}
      >
        <MoonLine size={18} className={isFadingOut ? "animate-bounce text-amber-400" : ""} />
        {isActive && (
          <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-white/20 text-white text-[9px] font-bold rounded-full min-w-[14px] text-center leading-tight shadow border border-white/20 backdrop-blur-md">
            {Math.ceil(remainingSeconds / 60)}m
          </span>
        )}
      </button>

      <SleepTimerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
