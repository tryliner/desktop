import { useState } from "react";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { TimelineSlider, formatPlaybackTime } from "./TimelineSlider";

export function FullscreenTimeline() {
  const player = usePlayerState();
  const [scrubMs, setScrubMs] = useState<number | null>(null);

  return (
    <div className="flex w-full flex-col gap-[4px]">
      <TimelineSlider
        positionMs={player.positionMs}
        durationMs={player.durationMs}
        onScrub={setScrubMs}
        onSeek={(pos) => {
          setScrubMs(null);
          playerEngine.seek(pos);
        }}
        size="md"
        className="w-full"
      />
      <div className="flex items-center justify-between font-montserrat text-[12px] font-[500] tabular-nums text-white/70">
        <span>{formatPlaybackTime(scrubMs ?? player.positionMs)}</span>
        <span>{formatPlaybackTime(player.durationMs)}</span>
      </div>
    </div>
  );
}
