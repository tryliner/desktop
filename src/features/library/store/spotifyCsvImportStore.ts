// client-side import of spotify liked songs from an exportify csv. each row
// is searched against the catalog and the best confident match is liked.
// everything runs through the regular api client, already-liked tracks are
// skipped, and stopping is safe — a rerun picks up where the last one stopped.
import { create } from "zustand";
import { api, ApiError } from "@/shared/api";
import {
  parseSpotifyCsv,
  scoreMatch,
  isConfidentMatch,
  looksLikeStub,
  type SpotifyCsvRow,
  type MatchCandidate,
} from "../services/import/spotifyCsv";

export interface CsvImportProgress {
  total: number;
  done: number;
  liked: number;
  skipped: number;
  failed: number;
  current: string;
}

type CsvImportPhase = "idle" | "ready" | "running" | "done";

interface SpotifyCsvImportState {
  phase: CsvImportPhase;
  rows: SpotifyCsvRow[];
  fileName: string;
  progress: CsvImportProgress;
  stopRequested: boolean;
  loadFile: (file: File) => Promise<void>;
  run: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

// two workers pull rows while one shared scheduler spaces out request
// starts, so searches, likes and retries together stay under one pace
const WORKER_COUNT = 2;
const PACE_MS = 450;

const STOP = new Error("csv import stopped");

let nextRequestAt = 0;
// reserves slots on the shared schedule, waits for its turn and then runs the
// action — stopping during the wait cancels the action before it starts.
// `slots` covers calls that fan out into more than one backend request.
async function paced<T>(
  action: () => Promise<T>,
  shouldStop: () => boolean,
  slots = 1,
): Promise<T> {
  for (let i = 0; i < slots; i++) {
    const now = Date.now();
    const wait = Math.max(0, nextRequestAt - now);
    nextRequestAt = Math.max(now, nextRequestAt) + PACE_MS;
    if (wait > 0) await sleep(wait);
    if (shouldStop()) throw STOP;
  }
  return action();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchLikedIds(shouldStop: () => boolean): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await paced(() => api.listLikedTracks(100, cursor), shouldStop);
    for (const item of page.items ?? []) {
      if (item.track?.id) ids.add(item.track.id);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return ids;
}

async function withRetry<T>(action: () => Promise<T>, shouldStop?: () => boolean): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (err) {
      if (shouldStop?.()) throw err;
      const status = err instanceof ApiError ? err.status : 0;
      const transient = status === 429 || status >= 500 || status === 0;
      if (transient && attempt < 4) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

function searchCandidates(row: SpotifyCsvRow): Promise<MatchCandidate[]> {
  const primaryArtist = row.artist ? row.artist.split(/[,;]/)[0].trim() : "";
  const query = primaryArtist ? `${primaryArtist} ${row.title}` : row.title;
  return api.search(query, "track").then((res) =>
    ((res.items ?? []) as unknown as Record<string, unknown>[])
      .filter(
        (item) =>
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          item.artists !== undefined,
      )
      .map((item) => item as unknown as MatchCandidate)
      .filter((item) => !looksLikeStub(item)),
  );
}

// the best candidate is the best confident one — a higher raw score that
// fails the title/artist gates must not steal the match from a candidate
// that actually passes them
function bestMatch(row: SpotifyCsvRow, candidates: MatchCandidate[]): { candidate: MatchCandidate | null; confident: boolean } {
  let best: { candidate: MatchCandidate; score: ReturnType<typeof scoreMatch> } | null = null;
  const rowHasArtist = Boolean(row.artist);
  for (const candidate of candidates) {
    const score = scoreMatch(row, candidate);
    if (!isConfidentMatch(score, rowHasArtist)) continue;
    if (!best || score.overall > best.score.overall) {
      best = { candidate, score };
    }
  }
  return { candidate: best?.candidate ?? null, confident: best !== null };
}

export const useSpotifyCsvImportStore = create<SpotifyCsvImportState>((set, get) => ({
  phase: "idle",
  rows: [],
  fileName: "",
  progress: { total: 0, done: 0, liked: 0, skipped: 0, failed: 0, current: "" },
  stopRequested: false,

  loadFile: async (file) => {
    const text = await file.text();
    const rows = parseSpotifyCsv(text);
    if (rows.length === 0) {
      set({ phase: "idle", rows: [], fileName: file.name });
      return;
    }
    set({
      phase: "ready",
      rows,
      fileName: file.name,
      progress: { total: rows.length, done: 0, liked: 0, skipped: 0, failed: 0, current: "" },
    });
  },

  stop: () => set({ stopRequested: true }),

  reset: () =>
    set({
      phase: "idle",
      rows: [],
      fileName: "",
      stopRequested: false,
      progress: { total: 0, done: 0, liked: 0, skipped: 0, failed: 0, current: "" },
    }),

  run: async () => {
    const { rows, phase } = get();
    if ((phase !== "ready" && phase !== "done") || rows.length === 0) return;
    set({
      phase: "running",
      stopRequested: false,
      progress: { total: rows.length, done: 0, liked: 0, skipped: 0, failed: 0, current: "" },
    });

    const progress = { ...get().progress };

    try {
      const stopRequested = () => get().stopRequested;
      let likedIds: Set<string>;
      try {
        likedIds = await fetchLikedIds(stopRequested);
      } catch (err) {
        if (err === STOP) return;
        likedIds = new Set();
      }

      let nextIndex = 0;
      const worker = async () => {
        while (!get().stopRequested) {
          const index = nextIndex++;
          if (index >= rows.length) break;
          const row = rows[index];

          progress.current = `${row.artist ? `${row.artist} — ` : ""}${row.title}`;

          try {
            const { candidate, confident } = bestMatch(
              row,
              await withRetry(() => paced(() => searchCandidates(row), stopRequested), stopRequested),
            );
            if (stopRequested()) return;
            if (candidate && confident) {
              if (likedIds.has(candidate.id)) {
                progress.skipped++;
              } else {
                // one slot for the catalog snapshot the like resolves
                // internally, one for the put itself
                await withRetry(
                  () => paced(() => api.likeTrack(candidate.id), stopRequested, 2),
                  stopRequested,
                );
                likedIds.add(candidate.id);
                progress.liked++;
              }
            } else {
              progress.failed++;
            }
          } catch (err) {
            if (err !== STOP && !get().stopRequested) progress.failed++;
          }

          progress.done++;
          set({ progress: { ...progress } });
        }
      };

      await Promise.all(Array.from({ length: WORKER_COUNT }, () => worker()));
    } finally {
      set({ phase: "done" });
    }
  },
}));
