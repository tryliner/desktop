import { useTranslation } from "@/languages";
import { formatPlayedAgo } from "../../lib/formatProfileStats";
import type { ProfileRecentTrack } from "../../model/types";
import { ModuleCard, ModuleGlow, TrackCover, TrackText } from "./ModuleCard";

function TrackRow({ track }: { track: ProfileRecentTrack }) {
  const { t } = useTranslation();

  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <TrackCover src={track.coverUrl} />
      <TrackText title={track.title} artist={track.artist} className="flex-1" />
      <span className="shrink-0 text-body text-text-tertiary">
        {formatPlayedAgo(track.playedAt, t)}
      </span>
    </li>
  );
}

interface RecentModuleProps {
  tracks: ProfileRecentTrack[];
  onShowMore?: () => void;
}

export function RecentModule({ tracks, onShowMore }: RecentModuleProps) {
  const { t } = useTranslation();
  const glow = tracks[0]?.coverUrl;

  return (
    <ModuleCard
      title={t("profile.recent")}
      action={
        <button
          type="button"
          onClick={onShowMore}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-title text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          {t("profile.show_more")}
        </button>
      }
      glow={glow ? <ModuleGlow src={glow} className="opacity-35" /> : null}
    >
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {tracks.slice(0, 5).map((track, index) => (
          <TrackRow key={index} track={track} />
        ))}
      </ol>
    </ModuleCard>
  );
}
