import type { SavedLyricsState, SavedTrackRecord } from "@/shared/media/saved";
import type { Track } from "@/shared/types";

export const START_DELAY_MS = 45_000;
export const LINER_GAP_MS = 1_500;
export const NETWORK_GAP_MIN_MS = 4_000;
export const NETWORK_GAP_MAX_MS = 10_000;
export const NETWORK_DAILY_CAP = 150;
export const RATE_LIMIT_PAUSE_MS = 10 * 60_000;
export const BLOCKED_PAUSE_MS = 60 * 60_000;
export const RETRY_GAP_MS = 5_000;
export const BUSY_POLL_MS = 2_000;
export const MAX_ATTEMPTS = 5;
export const GIVE_UP_FOR_MS = 7 * 24 * 60 * 60_000;
export const MIN_FREE_BYTES = 1024 * 1024 * 1024;
export const LYRICS_GAP_MS = 1_500;
export const DAY_MS = 24 * 60 * 60_000;

export type SavedAudioSource = "cache" | "liner" | "network";

export type SyncPhase =
  | "starting"
  | "idle"
  | "saving"
  | "waiting"
  | "offline"
  | "limit"
  | "disk"
  | "disabled";

export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  resumeAt?: number;
}

export type FailureKind =
  | { kind: "offline" }
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "blocked" }
  | { kind: "failed"; reason: string };

export interface SavedSyncMemory {
  attempts: Record<string, number>;
  givenUp: Record<string, number>;
  networkDay: number;
  networkCount: number;
}

export interface SavedTrackSyncDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  isOnline: () => boolean;
  waitForOnline: () => Promise<void>;
  isPlayerBusy: () => boolean;
  currentTrackId: () => string | null;
  isEnabled: () => boolean;
  limitBytes: () => number;
  usage: () => Promise<{ bytes: number; freeBytes: number | null }>;
  saveTrack: (track: Track) => Promise<{
    record: SavedTrackRecord;
    source: SavedAudioSource;
  } | null>;
  saveLyrics: (record: SavedTrackRecord) => Promise<SavedLyricsState | "later">;
  remove: (trackIds: string[]) => Promise<void>;
  classify: (error: unknown) => FailureKind;
  readMemory: () => SavedSyncMemory;
  writeMemory: (memory: SavedSyncMemory) => void;
  onStatus: (status: SyncStatus) => void;
  onRecords: (records: SavedTrackRecord[]) => void;
  log: (message: string) => void;
}

export const emptySyncMemory = (): SavedSyncMemory => ({
  attempts: {},
  givenUp: {},
  networkDay: 0,
  networkCount: 0,
});

export function wantedForSaving(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!track.id || !track.title || track.id.startsWith("local:"))
      return false;
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

export function createSavedTrackSync(deps: SavedTrackSyncDeps) {
  let records: SavedTrackRecord[] = [];
  let queue: Track[] = [];
  let liked: Track[] = [];
  let authoritative = false;
  let startAt = deps.now() + START_DELAY_MS;
  let pausedUntil = 0;
  let pendingRemovals = new Set<string>();
  let running: Promise<void> | null = null;
  let wake = false;
  let memory = deps.readMemory();

  const status = (phase: SyncPhase, resumeAt?: number) =>
    deps.onStatus({
      phase,
      pending: queue.length,
      ...(resumeAt ? { resumeAt } : {}),
    });

  const remember = () => deps.writeMemory(memory);

  const savedIds = () => new Set(records.map((record) => record.trackId));

  const isGivenUp = (trackId: string) => {
    const since = memory.givenUp[trackId];
    return since !== undefined && deps.now() - since < GIVE_UP_FOR_MS;
  };

  const networkCountToday = () => {
    const day = Math.floor(deps.now() / DAY_MS);
    if (memory.networkDay !== day) {
      memory = { ...memory, networkDay: day, networkCount: 0 };
    }
    return memory.networkCount;
  };

  const setRecords = (next: SavedTrackRecord[]) => {
    records = next;
    deps.onRecords(records);
  };

  const rebuildQueue = () => {
    const saved = savedIds();
    queue = wantedForSaving(liked).filter(
      (track) => !saved.has(track.id) && !isGivenUp(track.id),
    );
  };

  const applyRemovals = async () => {
    if (!authoritative || records.length === 0) return;
    const wanted = new Set(wantedForSaving(liked).map((track) => track.id));
    const playing = deps.currentTrackId();
    const removing = records
      .map((record) => record.trackId)
      .filter((trackId) => !wanted.has(trackId) && trackId !== playing);
    pendingRemovals = new Set(
      records
        .map((record) => record.trackId)
        .filter((trackId) => !wanted.has(trackId) && trackId === playing),
    );
    if (removing.length === 0) return;
    const gone = new Set(removing);
    setRecords(records.filter((record) => !gone.has(record.trackId)));
    await deps.remove(removing);
    deps.log(
      `removed ${removing.length} songs that are no longer liked or in a saved playlist`,
    );
  };

  const backfillLyrics = async (): Promise<boolean> => {
    for (const record of records.filter((entry) => !entry.lyrics)) {
      if (!deps.isEnabled() || queue.length > 0) return false;
      if (!deps.isOnline() || deps.now() < startAt) return false;
      const outcome = await deps
        .saveLyrics(record)
        .catch(() => "later" as const);
      if (outcome === "later") return false;
      setRecords(
        records.map((entry) =>
          entry.trackId === record.trackId
            ? { ...entry, lyrics: outcome }
            : entry,
        ),
      );
      await deps.sleep(LYRICS_GAP_MS);
    }
    return true;
  };

  const drain = async () => {
    for (;;) {
      if (queue.length === 0) {
        if (!deps.isEnabled()) break;
        await backfillLyrics();
        if (queue.length === 0) break;
      }
      if (!deps.isEnabled()) {
        status("disabled");
        return;
      }
      const now = deps.now();
      if (now < startAt) {
        status("starting", startAt);
        await deps.sleep(startAt - now);
        continue;
      }
      if (!deps.isOnline()) {
        status("offline");
        await deps.waitForOnline();
        continue;
      }
      if (now < pausedUntil) {
        status("waiting", pausedUntil);
        await deps.sleep(pausedUntil - now);
        continue;
      }
      if (networkCountToday() >= NETWORK_DAILY_CAP) {
        const tomorrow = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
        pausedUntil = tomorrow;
        continue;
      }
      if (deps.isPlayerBusy()) {
        await deps.sleep(BUSY_POLL_MS);
        continue;
      }
      const usage = await deps.usage().catch(() => null);
      const limit = deps.limitBytes();
      if (usage && limit > 0 && usage.bytes >= limit) {
        status("limit");
        return;
      }
      if (usage?.freeBytes != null && usage.freeBytes < MIN_FREE_BYTES) {
        status("disk");
        return;
      }

      const track = queue[0];
      status("saving");
      try {
        const saved = await deps.saveTrack(track);
        queue = queue.filter((entry) => entry.id !== track.id);
        const { [track.id]: _dropped, ...attempts } = memory.attempts;
        memory = { ...memory, attempts };
        if (!saved) {
          memory = {
            ...memory,
            givenUp: { ...memory.givenUp, [track.id]: deps.now() },
          };
          remember();
          continue;
        }
        setRecords([
          ...records.filter((record) => record.trackId !== track.id),
          saved.record,
        ]);
        if (saved.source === "network") {
          networkCountToday();
          memory = { ...memory, networkCount: memory.networkCount + 1 };
        }
        remember();
        deps.log(`saved "${track.title}" from ${saved.source}`);
        if (saved.source === "network") {
          const spread = NETWORK_GAP_MAX_MS - NETWORK_GAP_MIN_MS;
          await deps.sleep(NETWORK_GAP_MIN_MS + deps.random() * spread);
        } else if (saved.source === "liner") {
          await deps.sleep(LINER_GAP_MS);
        }
      } catch (error) {
        const failure = deps.classify(error);
        if (failure.kind === "offline") continue;
        if (failure.kind === "rate_limited") {
          pausedUntil =
            deps.now() + (failure.retryAfterMs ?? RATE_LIMIT_PAUSE_MS);
          deps.log("save paused, rate limited");
          continue;
        }
        if (failure.kind === "blocked") {
          pausedUntil = deps.now() + BLOCKED_PAUSE_MS;
          deps.log("save paused, youtube asked for a bot check");
          continue;
        }
        const attempts = (memory.attempts[track.id] ?? 0) + 1;
        queue = queue.filter((entry) => entry.id !== track.id);
        if (attempts >= MAX_ATTEMPTS) {
          const { [track.id]: _dropped, ...rest } = memory.attempts;
          memory = {
            ...memory,
            attempts: rest,
            givenUp: { ...memory.givenUp, [track.id]: deps.now() },
          };
          deps.log(`gave up on "${track.title}": ${failure.reason}`);
        } else {
          memory = {
            ...memory,
            attempts: { ...memory.attempts, [track.id]: attempts },
          };
          queue.push(track);
          deps.log(`could not save "${track.title}": ${failure.reason}`);
          await deps.sleep(RETRY_GAP_MS);
        }
        remember();
      }
    }
    status(deps.isEnabled() ? "idle" : "disabled");
  };

  const run = (): Promise<void> => {
    wake = true;
    if (running) return running;
    running = (async () => {
      try {
        do {
          wake = false;
          await drain();
        } while (wake);
      } finally {
        running = null;
      }
    })();
    return running;
  };

  return {
    setRecords(next: SavedTrackRecord[]) {
      records = next;
    },
    records: () => records,
    async reconcile(nextLiked: Track[], isAuthoritative: boolean) {
      liked = nextLiked;
      authoritative = isAuthoritative;
      await applyRemovals();
      rebuildQueue();
      if (!deps.isEnabled()) {
        status("disabled");
        return;
      }
      void run();
    },
    async trackChanged() {
      if (pendingRemovals.size === 0) return;
      await applyRemovals();
    },
    resume() {
      startAt = Math.min(startAt, deps.now());
      rebuildQueue();
      return run();
    },
    forgetFailures() {
      memory = { ...memory, attempts: {}, givenUp: {} };
      remember();
    },
    idle: () => running ?? Promise.resolve(),
  };
}
