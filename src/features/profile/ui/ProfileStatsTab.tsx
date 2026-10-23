import { formatListeningHours } from "../stats";
import type { UserListeningStats } from "../types";
import { TimeLine, Music2Fill, User3Fill } from "@mingcute/react";

interface ProfileStatsTabProps {
  stats: UserListeningStats;
}

function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ProfileStatsTab({ stats }: ProfileStatsTabProps) {
  const hasStats = stats.totalTracksPlayed > 0;

  if (!hasStats) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-secondary/60 mb-4 border border-border-subtle">
          <TimeLine size={28} />
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">
          No listening activity yet
        </h3>
        <p className="text-xs text-text-secondary max-w-sm">
          Play music in Liner to generate your listening statistics, top tracks, and favorite artists.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-bg-tertiary border border-border-subtle flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <TimeLine size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Total Time Listened
            </p>
            <h4 className="text-2xl font-bold text-text-primary mt-0.5">
              {formatListeningHours(stats.totalHoursListened)}
            </h4>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-bg-tertiary border border-border-subtle flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Music2Fill size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Total Tracks Played
            </p>
            <h4 className="text-2xl font-bold text-text-primary mt-0.5">
              {stats.totalTracksPlayed}
            </h4>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-bg-tertiary border border-border-subtle flex items-center gap-4 sm:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <User3Fill size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Top Artists Count
            </p>
            <h4 className="text-2xl font-bold text-text-primary mt-0.5">
              {stats.topArtists.length}
            </h4>
          </div>
        </div>
      </div>

      {/* Top Tracks & Artists Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Tracks */}
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Music2Fill size={16} />
            <span>Top Tracks</span>
          </h3>

          <div className="space-y-2">
            {stats.topTracks.slice(0, 10).map((item, index) => (
              <div
                key={item.track.id || `${item.track.title}-${index}`}
                className="flex items-center gap-3.5 p-3 rounded-xl bg-bg-tertiary/60 border border-border-subtle hover:bg-bg-hover/80 transition-colors"
              >
                <span className="w-6 text-center text-xs font-bold text-text-secondary/70">
                  {index + 1}
                </span>

                {item.track.coverUrl ? (
                  <img
                    src={item.track.coverUrl}
                    alt={item.track.title}
                    className="w-10 h-10 rounded-lg object-cover bg-bg-secondary shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-text-secondary/40 shrink-0">
                    <Music2Fill size={18} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-text-primary truncate">
                    {item.track.title}
                  </h4>
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {typeof item.track.artists === "string"
                      ? item.track.artists
                      : "Unknown Artist"}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-text-primary block">
                    {item.playCount} {item.playCount === 1 ? "play" : "plays"}
                  </span>
                  {item.totalPlayedMs > 0 && (
                    <span className="text-[11px] text-text-secondary block mt-0.5 font-mono">
                      {formatDurationMs(item.totalPlayedMs)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Artists */}
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
            <User3Fill size={16} />
            <span>Top Artists</span>
          </h3>

          <div className="space-y-2">
            {stats.topArtists.slice(0, 10).map((artist, index) => (
              <div
                key={`${artist.artistName}-${index}`}
                className="flex items-center gap-3.5 p-3 rounded-xl bg-bg-tertiary/60 border border-border-subtle hover:bg-bg-hover/80 transition-colors"
              >
                <span className="w-6 text-center text-xs font-bold text-text-secondary/70">
                  {index + 1}
                </span>

                <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-sm shrink-0">
                  {artist.artistName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-text-primary truncate">
                    {artist.artistName}
                  </h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Featured Artist
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-text-primary">
                    {artist.playCount} {artist.playCount === 1 ? "play" : "plays"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileStatsTab;
