import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import type { ProfileArtist } from "../../model/types";
import { ModuleCard, ModuleGlow } from "./ModuleCard";

const RANK_TEXT = ["text-2xl", "text-xl", "text-xl", "text-lg", "text-base"];

function ArtistBubble({
  artist,
  size,
}: {
  artist: ProfileArtist;
  size: string;
}) {
  return (
    <img
      src={artist.imageUrl}
      alt=""
      draggable={false}
      className={cn("shrink-0 rounded-full object-cover select-none", size)}
    />
  );
}

/** Three bubbles on top, two below sitting in the gaps, fading to the right. */
function ArtistCluster({ artists }: { artists: ProfileArtist[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-2 -right-12 flex flex-col items-start [mask-image:linear-gradient(to_right,#000_15%,rgb(0_0_0/0.3))]"
    >
      <div className="flex gap-3">
        {artists.slice(0, 3).map((artist) => (
          <ArtistBubble key={artist.name} artist={artist} size="size-[84px]" />
        ))}
      </div>
      <div className="-mt-2.5 ml-11 flex gap-3">
        {artists.slice(3, 5).map((artist) => (
          <ArtistBubble key={artist.name} artist={artist} size="size-[92px]" />
        ))}
      </div>
    </div>
  );
}

export function TopArtistsModule({ artists }: { artists: ProfileArtist[] }) {
  const { t } = useTranslation();
  const top = artists.slice(0, 5);

  return (
    <ModuleCard
      title={t("profile.top_artists")}
      glow={
        <ModuleGlow color="#24374a" className="top-14 bottom-auto opacity-50" />
      }
      className="min-h-48"
    >
      <ArtistCluster artists={top} />
      <ol className="relative m-0 max-w-[55%] list-none p-0 leading-[1.1] font-[500] text-text-primary">
        {top.map((artist, index) => (
          <li key={artist.name} className={cn("truncate", RANK_TEXT[index])}>
            {index + 1}. {artist.name}
          </li>
        ))}
      </ol>
    </ModuleCard>
  );
}
