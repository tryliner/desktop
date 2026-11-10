import { useTranslation } from "@/languages";
import { formatPlaylistMeta } from "../../lib/formatProfileStats";
import type { ProfilePlaylist } from "../../model/types";
import { ModuleCard } from "./ModuleCard";
import PinSolidIcon from "~icons/basil/pin-solid";

function PlaylistTile({ playlist }: { playlist: ProfilePlaylist }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="relative aspect-square min-w-0 cursor-pointer overflow-hidden rounded-control border-0 p-0 text-left text-white transition-transform duration-150 active:scale-[0.98]"
    >
      <img
        src={playlist.coverUrl}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-cover select-none"
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/60 to-transparent px-2.5 pt-7 pb-2.5 backdrop-blur-[18px] [mask-image:linear-gradient(to_bottom,transparent,#000_40%)]">
        <span className="truncate text-lg font-[500]">{playlist.title}</span>
        <span className="truncate text-body font-[500] text-white/70">
          {formatPlaylistMeta(playlist.trackCount, playlist.durationMs, t)}
        </span>
      </div>
      <span className="absolute top-1 left-1 flex size-8 items-center justify-center rounded-control bg-black/20 text-white/90 backdrop-blur-md">
        <PinSolidIcon width={18} height={18} />
      </span>
    </button>
  );
}

export function PinnedPlaylistsModule({
  playlists,
}: {
  playlists: ProfilePlaylist[];
}) {
  return (
    <ModuleCard className="grid grid-cols-2 gap-3 p-2">
      {playlists.slice(0, 2).map((playlist) => (
        <PlaylistTile key={playlist.title} playlist={playlist} />
      ))}
    </ModuleCard>
  );
}
