import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import type { Track } from "@/shared/types";

export interface TrackStat {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  plays: number;
  listenedMs: number;
  lastPlayedAt: number;
}

interface StatsState {
  totalMs: number;
  totalPlays: number;
  tracks: Record<string, TrackStat>;
  daily: Record<string, number>;
  recordListen: (track: Track) => void;
  addListening: (track: Track, ms: number) => void;
  clear: () => void;
}

const MAX_TRACKS = 1000;
const MAX_DAYS = 365;

function dayKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function withTrack(
  tracks: Record<string, TrackStat>,
  track: Track,
): Record<string, TrackStat> {
  const id = track.id;
  const existing = tracks[id];
  return {
    ...tracks,
    [id]: {
      id,
      title: track.title,
      artist: track.artists,
      coverUrl: track.coverUrl,
      plays: existing?.plays ?? 0,
      listenedMs: existing?.listenedMs ?? 0,
      lastPlayedAt: Date.now(),
    },
  };
}

function capTracks(tracks: Record<string, TrackStat>) {
  const entries = Object.entries(tracks);
  if (entries.length <= MAX_TRACKS) return tracks;
  entries.sort((a, b) => b[1].lastPlayedAt - a[1].lastPlayedAt);
  return Object.fromEntries(entries.slice(0, MAX_TRACKS));
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      totalMs: 0,
      totalPlays: 0,
      tracks: {},
      daily: {},
      recordListen: (track) =>
        set((state) => {
          const tracks = withTrack(state.tracks, track);
          tracks[track.id].plays += 1;
          return {
            tracks: capTracks(tracks),
            totalPlays: state.totalPlays + 1,
          };
        }),
      addListening: (track, ms) =>
        set((state) => {
          const tracks = withTrack(state.tracks, track);
          tracks[track.id].listenedMs += ms;
          const key = dayKey();
          const daily = { ...state.daily, [key]: (state.daily[key] ?? 0) + ms };
          const days = Object.keys(daily).sort();
          if (days.length > MAX_DAYS) {
            for (const day of days.slice(0, days.length - MAX_DAYS)) {
              delete daily[day];
            }
          }
          return {
            tracks: capTracks(tracks),
            daily,
            totalMs: state.totalMs + ms,
          };
        }),
      clear: () => set({ totalMs: 0, totalPlays: 0, tracks: {}, daily: {} }),
    }),
    {
      name: "liner_listening_stats_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        totalMs: state.totalMs,
        totalPlays: state.totalPlays,
        tracks: state.tracks,
        daily: state.daily,
      }),
    },
  ),
);
