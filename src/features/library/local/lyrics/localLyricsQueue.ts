import { api, ApiError, getAuthSession } from "@/shared/api";
import type { LyricsCandidate } from "@/shared/contracts/lyrics";
import { linerDb } from "@/shared/storage/linerDb";
import { log } from "@/shared/utils/logger";
import {
  toLocalTrackId,
  type LocalLyricsState,
  type LocalTrackRecord,
} from "@/shared/media/local";

export const LOCAL_LYRICS_UPDATED = "local-lyrics:updated";
export const RATE_LIMIT_BACKOFF_MS = 10 * 60_000;

type Outcome =
  | { kind: "done"; state: LocalLyricsState; candidate?: LyricsCandidate }
  | { kind: "wait"; ms: number }
  | { kind: "later"; reason: string };

export interface LocalLyricsQueueDeps {
  readLegacy: (trackId: string) => Promise<LyricsCandidate | null>;
  dropLegacy: (trackId: string) => Promise<void>;
  search: (hint: {
    title: string;
    artist: string;
    durationMs?: number;
  }) => Promise<{ candidate: LyricsCandidate } | null>;
  isSignedIn: () => boolean;
  save: (
    fileId: string,
    state: LocalLyricsState,
    candidate?: LyricsCandidate,
  ) => Promise<boolean>;
  onSaved: (fileId: string, state: LocalLyricsState) => void;
  sleep: (ms: number) => Promise<void>;
}

export function createLocalLyricsQueue(deps: LocalLyricsQueueDeps) {
  const waiting: LocalTrackRecord[] = [];
  const queued = new Set<string>();
  const settled = new Set<string>();
  const importKey = (record: LocalTrackRecord) =>
    `${record.id}:${record.addedAt}`;
  let running: Promise<void> | null = null;

  const resolve = async (record: LocalTrackRecord): Promise<Outcome> => {
    const trackId = toLocalTrackId(record.id);
    const legacy = await deps.readLegacy(trackId).catch(() => null);
    if (legacy) return { kind: "done", state: "found", candidate: legacy };
    const title = record.title.trim();
    const artist = record.artist.trim();
    if (!title || !artist) return { kind: "done", state: "untagged" };
    if (!deps.isSignedIn()) return { kind: "later", reason: "not signed in" };
    log("cyan", "lyrics", `searching for local "${title}" by ${artist}`);
    try {
      const result = await deps.search({
        title,
        artist,
        durationMs: record.durationMs,
      });
      return result
        ? { kind: "done", state: "found", candidate: result.candidate }
        : { kind: "done", state: "missing" };
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        return { kind: "wait", ms: RATE_LIMIT_BACKOFF_MS };
      }
      const detail =
        error instanceof ApiError
          ? `${error.status} ${error.code ?? error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      return { kind: "later", reason: `search failed: ${detail}` };
    }
  };

  const drain = async () => {
    while (waiting.length > 0) {
      const record = waiting[0];
      const outcome = await resolve(record);
      if (outcome.kind === "later") {
        log(
          "yellow",
          "lyrics",
          `local lyrics paused (${outcome.reason}), ${waiting.length} waiting`,
        );
        return;
      }
      if (outcome.kind === "wait") {
        log(
          "yellow",
          "lyrics",
          `lyrics search limit reached, retrying in ${Math.round(outcome.ms / 60_000)} min`,
        );
        await deps.sleep(outcome.ms);
        continue;
      }
      const saved = await deps
        .save(record.id, outcome.state, outcome.candidate)
        .catch(() => false);
      waiting.shift();
      queued.delete(record.id);
      settled.add(importKey(record));
      if (!saved) {
        log(
          "red",
          "lyrics",
          `could not store lyrics state for "${record.title}"`,
        );
        continue;
      }
      log(
        outcome.state === "found" ? "green" : "cyan",
        "lyrics",
        `local "${record.title}": ${outcome.state}`,
      );
      if (outcome.candidate) {
        await deps.dropLegacy(toLocalTrackId(record.id)).catch(() => undefined);
      }
      deps.onSaved(record.id, outcome.state);
    }
  };

  const run = (): Promise<void> => {
    running ??= drain().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    enqueue(records: LocalTrackRecord[]): Promise<void> {
      for (const record of records) {
        if (
          record.lyrics ||
          queued.has(record.id) ||
          settled.has(importKey(record))
        ) {
          continue;
        }
        queued.add(record.id);
        waiting.push(record);
      }
      return run();
    },
    forget(fileIds: string[]) {
      const gone = new Set(fileIds);
      for (let i = waiting.length - 1; i > 0; i--) {
        if (gone.has(waiting[i].id)) {
          queued.delete(waiting[i].id);
          waiting.splice(i, 1);
        }
      }
    },
    retry: run,
  };
}

export function isLyricsCandidate(value: unknown): value is LyricsCandidate {
  const lyrics = (value as { lyrics?: { content?: unknown } } | null)?.lyrics;
  return typeof lyrics?.content === "string" && lyrics.content.length > 0;
}

export async function readStoredLocalLyrics(
  fileId: string,
): Promise<LyricsCandidate | null> {
  const stored = await window.linerElectron
    ?.localTracksGetLyrics(fileId)
    .catch(() => null);
  return isLyricsCandidate(stored) ? stored : null;
}

export function createAppLocalLyricsQueue(
  onSaved: (fileId: string, state: LocalLyricsState) => void,
) {
  return createLocalLyricsQueue({
    readLegacy: async (trackId) => {
      const record = await linerDb.getLyrics(trackId);
      return record?.candidate ?? null;
    },
    dropLegacy: (trackId) => linerDb.deleteLyrics([trackId]),
    search: (hint) => api.searchLyrics(hint),
    isSignedIn: () => Boolean(getAuthSession()),
    save: async (fileId, state, candidate) =>
      Boolean(
        await window.linerElectron?.localTracksSetLyrics(
          fileId,
          state,
          candidate,
        ),
      ),
    onSaved: (fileId, state) => {
      onSaved(fileId, state);
      window.dispatchEvent(
        new CustomEvent(LOCAL_LYRICS_UPDATED, {
          detail: { trackId: toLocalTrackId(fileId) },
        }),
      );
    },
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  });
}
