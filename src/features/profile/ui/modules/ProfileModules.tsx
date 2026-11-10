import type { ProfileModule } from "../../model/types";
import { OnRepeatModule } from "./OnRepeatModule";
import { PinnedPlaylistsModule } from "./PinnedPlaylistsModule";
import { RecentModule } from "./RecentModule";
import { TopArtistsModule } from "./TopArtistsModule";
import { TopTracksModule } from "./TopTracksModule";

function ProfileModuleView({ module }: { module: ProfileModule }) {
  switch (module.kind) {
    case "top-tracks":
      return (
        <TopTracksModule
          tracks={module.tracks}
          listenedMs={module.listenedMs}
        />
      );
    case "top-artists":
      return <TopArtistsModule artists={module.artists} />;
    case "pinned-playlists":
      return <PinnedPlaylistsModule playlists={module.playlists} />;
    case "recent":
      return <RecentModule tracks={module.tracks} />;
    case "on-repeat":
      return (
        <OnRepeatModule
          track={module.track}
          playCount={module.playCount}
          dailyPlays={module.dailyPlays}
        />
      );
  }
}

export function ProfileModules({ modules }: { modules: ProfileModule[] }) {
  return (
    <div className="grid grid-cols-2 items-start gap-3">
      {modules.map((module, index) => (
        <ProfileModuleView key={`${module.kind}-${index}`} module={module} />
      ))}
    </div>
  );
}
