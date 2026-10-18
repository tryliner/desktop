import type { Track } from "@/shared/types";

export interface LocalHistoryEntry {
  trackId: string;
  title: string;
  artist: string;
  coverUrl?: string;
  durationMs: number;
  playedDurationMs: number;
  completed: boolean;
  loopCount: number;
  timestamp: number;
}

const STORAGE_KEY = "liner_local_listening_history";
const MAX_HISTORY_ITEMS = 200;

export function recordLocalListening(
  track: Track,
  playedDurationMs: number,
  completed: boolean,
  loopCount: number = 0
): void {
  try {
    const existing = getLocalListeningHistory();
    const prev = existing.find((e) => e.trackId === track.id);
    const entry: LocalHistoryEntry = {
      trackId: track.id,
      title: track.title,
      artist: track.artists,
      coverUrl: track.coverUrl,
      durationMs: track.durationMs,
      playedDurationMs: (prev?.playedDurationMs || 0) + playedDurationMs,
      completed: completed || (prev?.completed ?? false),
      loopCount: (prev?.loopCount || 0) + loopCount,
      timestamp: Date.now(),
    };

    const updated = [entry, ...existing.filter((e) => e.trackId !== track.id)].slice(
      0,
      MAX_HISTORY_ITEMS
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function getLocalListeningHistory(): LocalHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalHistoryEntry[]) : [];
  } catch {
    return [];
  }
}
