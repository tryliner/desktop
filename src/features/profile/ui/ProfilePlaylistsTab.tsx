import PlaylistCard from "@/features/library/ui/PlaylistCard";
import { useModalStore } from "@/features/library";
import type { ProfilePlaylistItem } from "../hooks/useProfileViewModel";
import { PlaylistFill, AddLine } from "@mingcute/react";

interface ProfilePlaylistsTabProps {
  playlists: ProfilePlaylistItem[];
  isOwner: boolean;
  isGuest: boolean;
  ownerDisplayName?: string;
}

export function ProfilePlaylistsTab({
  playlists,
  isOwner,
  isGuest,
  ownerDisplayName,
}: ProfilePlaylistsTabProps) {
  const openCreatePlaylist = useModalStore((s) => s.openCreatePlaylist);
  const openSpotifyPlaylists = useModalStore((s) => s.openSpotifyPlaylists);

  if (playlists.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-secondary/60 mb-4 border border-border-subtle">
          <PlaylistFill size={28} />
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">
          No playlists yet
        </h3>
        <p className="text-xs text-text-secondary max-w-sm mb-6">
          {isOwner
            ? "Create your first playlist or import your collections from Spotify to showcase your music taste."
            : "This listener hasn't created or shared any public playlists yet."}
        </p>

        {isOwner && !isGuest && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openCreatePlaylist()}
              className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <AddLine size={16} />
              <span>Create Playlist</span>
            </button>
            <button
              type="button"
              onClick={() => openSpotifyPlaylists?.()}
              className="px-4 py-2 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover text-text-primary text-xs font-medium active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>Import from Spotify</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-6">
      {isOwner && !isGuest && (
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Created & Imported Playlists ({playlists.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openCreatePlaylist()}
              className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover text-text-primary text-xs font-medium active:scale-95 transition-all flex items-center gap-1"
            >
              <AddLine size={14} />
              <span>New Playlist</span>
            </button>
            <button
              type="button"
              onClick={() => openSpotifyPlaylists?.()}
              className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover text-text-primary text-xs font-medium active:scale-95 transition-all flex items-center gap-1"
            >
              <span>Import Spotify</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {playlists.map((playlist) => {
          const isSpotify = playlist.source === "spotify";
          return (
            <div key={playlist.id} className="relative group">
              <PlaylistCard
                title={playlist.title}
                author={ownerDisplayName || "You"}
                imageUrl={playlist.coverUrl || ""}
                coverUrls={playlist.coverUrls}
                variant="playlist"
                href={`/library/playlist?id=${encodeURIComponent(playlist.id)}`}
              />
              {isSpotify && (
                <div
                  className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1DB954] text-black shadow-md z-10 pointer-events-none uppercase tracking-wider"
                  title="Imported from Spotify"
                >
                  Spotify
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProfilePlaylistsTab;
