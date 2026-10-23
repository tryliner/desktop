import type { PlaybackHistoryItem } from "@/shared/contracts/history";
import { TimeLine, Music2Fill, CheckLine } from "@mingcute/react";

interface ProfileHistoryTabProps {
  history: PlaybackHistoryItem[];
}

function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ProfileHistoryTab({ history }: ProfileHistoryTabProps) {
  if (history.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-secondary/60 mb-4 border border-border-subtle">
          <TimeLine size={28} />
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">
          No playback history
        </h3>
        <p className="text-xs text-text-secondary max-w-sm">
          Tracks you listen to will appear here in chronological order.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="space-y-2">
        {history.map((item, index) => {
          const track = item.track;
          const artistName =
            typeof track?.artists === "string"
              ? track.artists
              : Array.isArray(track?.artists)
              ? (track.artists as any[]).map((a) => (typeof a === "string" ? a : a.name)).join(", ")
              : "Unknown Artist";

          return (
            <div
              key={item.id || `${item.listeningSessionId}-${index}`}
              className="flex items-center gap-3.5 p-3 rounded-xl bg-bg-tertiary/60 border border-border-subtle hover:bg-bg-hover/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-secondary shrink-0 relative flex items-center justify-center">
                {(track as any)?.coverUrl ? (
                  <img
                    src={(track as any).coverUrl}
                    alt={track?.title || "Track cover"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music2Fill size={18} className="text-text-secondary/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-text-primary truncate">
                  {track?.title || "Untitled Track"}
                </h4>
                <p className="text-xs text-text-secondary truncate mt-0.5">
                  {artistName}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-right">
                {item.completed && (
                  <span
                    className="p-1 rounded-full bg-emerald-500/15 text-emerald-400"
                    title="Completed playback"
                  >
                    <CheckLine size={12} />
                  </span>
                )}

                <div className="text-right">
                  <span className="text-xs font-mono text-text-primary block">
                    {formatDurationMs(item.playedDurationMs)}
                  </span>
                  <span className="text-[11px] text-text-secondary block mt-0.5">
                    {formatDate(item.listenedAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProfileHistoryTab;
