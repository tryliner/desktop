import type { SavedTrackRecord } from "@/shared/media/saved";
import type { Track } from "@/shared/types";
import {
  createSavedTrackSync,
  emptySyncMemory,
  type FailureKind,
  type SavedAudioSource,
  type SavedSyncMemory,
  type SavedTrackSyncDeps,
  type StoredClaims,
  type SyncStatus,
} from "./savedTrackSync";

export const track = (id: string): Track => ({
  id,
  title: `song ${id}`,
  artists: "artist",
  coverUrl: "",
  durationMs: 1000,
  playCount: 0,
});

export const record = (trackId: string): SavedTrackRecord => ({
  trackId,
  key: trackId.padEnd(20, "0"),
  title: `song ${trackId}`,
  artists: "artist",
  durationMs: 1000,
  audioFile: `${trackId}.webm`,
  mimeType: "audio/webm",
  byteSize: 10,
  savedAt: 1,
  lyrics: "found",
});

export class Failure extends Error {
  constructor(readonly failure: FailureKind) {
    super(failure.kind);
  }
}

export function setup(overrides: Partial<SavedTrackSyncDeps> = {}) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const statuses: SyncStatus[] = [];
  const saved: string[] = [];
  const removed: string[][] = [];
  let memory: SavedSyncMemory = emptySyncMemory();
  let source: SavedAudioSource = "liner";
  let failNext: FailureKind[] = [];
  let account: string | null = "u1";
  let claimsStore: { accountId: string | null; trackIds: string[] } | null =
    null;
  let wipes = 0;
  let visible: string[] = [];
  const deps: SavedTrackSyncDeps = {
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    random: () => 0,
    isOnline: () => true,
    waitForOnline: async () => {},
    isPlayerBusy: () => false,
    currentTrackId: () => null,
    isEnabled: () => true,
    limitBytes: () => 0,
    usage: async () => ({ bytes: 0, freeBytes: null }),
    saveTrack: async (input) => {
      const failure = failNext.shift();
      if (failure) throw new Failure(failure);
      saved.push(input.id);
      return { record: record(input.id), source };
    },
    saveLyrics: async () => "found",
    remove: async (ids) => {
      removed.push(ids);
    },
    removeAll: async () => {
      wipes += 1;
    },
    accountId: () => account,
    readClaims: (accountId): StoredClaims => {
      if (!claimsStore) return accountId ? "all" : [];
      return claimsStore.accountId === accountId ? claimsStore.trackIds : [];
    },
    writeClaims: (accountId, trackIds) => {
      claimsStore = { accountId, trackIds };
    },
    classify: (error) =>
      error instanceof Failure
        ? error.failure
        : { kind: "failed", reason: String(error) },
    readMemory: () => memory,
    writeMemory: (next) => {
      memory = next;
    },
    onStatus: (status) => statuses.push(status),
    onRecords: (claimed) => {
      visible = claimed.map((entry) => entry.trackId);
    },
    log: () => {},
    ...overrides,
  };
  const sync = createSavedTrackSync(deps);
  return {
    sync,
    sleeps,
    statuses,
    saved,
    removed,
    memory: () => memory,
    setSource: (next: SavedAudioSource) => {
      source = next;
    },
    failWith: (...failures: FailureKind[]) => {
      failNext = failures;
    },
    signInAs: (next: string | null) => {
      account = next;
    },
    claims: () => claimsStore,
    setClaims: (accountId: string | null, trackIds: string[]) => {
      claimsStore = { accountId, trackIds };
    },
    wipes: () => wipes,
    visible: () => visible,
  };
}
