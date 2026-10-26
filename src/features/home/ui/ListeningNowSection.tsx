import { memo, type ReactNode } from "react";
import { playerEngine } from "@/features/player";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import type { Track } from "@/shared/types";
import SectionHeading from "./SectionHeading";

export interface ListeningNowSectionProps {
  title: string;
  icon?: ReactNode;
  tracks: Track[];
  headingMarginTop?: string;
}

function formatDuration(durationMs: number | undefined): string | undefined {
  if (!durationMs) return undefined;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ListeningNowSection({
  title,
  icon,
  tracks,
  headingMarginTop,
}: ListeningNowSectionProps) {
  return (
    <section className="flex flex-col">
      <SectionHeading title={title} icon={icon} marginTop={headingMarginTop} />

      <div className="mx-3 mt-[12px] grid grid-flow-col grid-cols-2 grid-rows-5 gap-x-[8px] rounded-[14px] bg-black/[0.03] p-[8px] dark:bg-white/[0.04]">
        {tracks.map((track) => (
          <SongCardWithMenu
            key={track.id}
            id={track.id}
            title={track.title}
            artists={track.artists}
            artistId={track.artistId}
            artistList={track.artistList}
            coverUrl={track.coverUrl}
            duration={formatDuration(track.durationMs)}
            durationMs={track.durationMs}
            explicit={track.explicit}
            onPlay={() =>
              void playerEngine.playTrack(track, tracks, title, track.coverUrl)
            }
          />
        ))}
      </div>
    </section>
  );
}

export default memo(ListeningNowSection);
