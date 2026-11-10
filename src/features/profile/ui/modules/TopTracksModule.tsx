import { useTranslation } from "@/languages";
import { formatListenedTime } from "../../lib/formatProfileStats";
import type { ProfileTrack } from "../../model/types";
import { ModuleCard, ModuleGlow, TrackCover, TrackText } from "./ModuleCard";

interface TopTracksModuleProps {
  tracks: ProfileTrack[];
  listenedMs: number;
}

function TrackChip({ track, rank }: { track: ProfileTrack; rank: number }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5 rounded-item bg-fill px-2 py-2">
      <span className="w-3.5 shrink-0 text-center text-heading text-text-primary tabular-nums">
        {rank}
      </span>
      <TrackCover src={track.coverUrl} className="size-7" />
      <TrackText
        title={track.title}
        artist={track.artist}
        titleClassName="text-body"
      />
    </li>
  );
}

export function TopTracksModule({ tracks, listenedMs }: TopTracksModuleProps) {
  const { t } = useTranslation();
  const glow = tracks[0]?.coverUrl;

  return (
    <ModuleCard
      title={t("profile.top_tracks")}
      action={
        <span className="shrink-0 text-xl font-[600] tracking-[-0.04em] text-text-primary/80">
          {formatListenedTime(listenedMs, t)}
        </span>
      }
      glow={glow ? <ModuleGlow src={glow} className="opacity-15" /> : null}
    >
      <ol className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
        {tracks.slice(0, 5).map((track, index) => (
          <TrackChip key={index} track={track} rank={index + 1} />
        ))}
      </ol>
    </ModuleCard>
  );
}
