import type { Track } from "@/shared/types";
import { getAuthSession } from "@/shared/api";

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

function getStorageKey(): string {
  const userId = getAuthSession()?.user?.id;
  return userId
    ? `liner_local_listening_history_${userId}`
    : "liner_local_listening_history_guest";
}

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
    localStorage.setItem(getStorageKey(), JSON.stringify(updated));
  } catch {}
}

export function getLocalListeningHistory(): LocalHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? (JSON.parse(raw) as LocalHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearLocalListeningHistory(userId?: string): void {
  try {
    const key = userId
      ? `liner_local_listening_history_${userId}`
      : getStorageKey();
    localStorage.removeItem(key);
  } catch {}
}
