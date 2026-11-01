import { create } from "zustand";
import {
  savedRecordToTrack,
  setSavedTrackIndex,
  type SavedTrackRecord,
} from "@/shared/media/saved";
import type { Track } from "@/shared/types";
import { log } from "@/shared/utils/logger";
import {
  isOfflineMode,
  useOfflineModeStore,
} from "@/features/connectivity/store/offlineModeStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { playerEngine } from "@/features/player/engine/playerEngine";
import {
  likedTracksSnapshot,
  loadLikedTracks,
  subscribeLikedTracks,
} from "../../hooks/useLikedTracks";
import {
  createSavedTrackSync,
  emptySyncMemory,
  type SavedSyncMemory,
  type SyncStatus,
} from "../engine/savedTrackSync";
import {
  classifySaveFailure,
  saveLyricsToDevice,
  saveTrackToDevice,
} from "../engine/savedTrackFetcher";

export const SAVE_LIKED_ENABLED_KEY = "liner_save_liked_enabled";
export const SAVED_LIMIT_KEY = "liner_saved_limit_bytes";
export const SAVED_SYNC_MEMORY_KEY = "liner_saved_sync_v1";
export const DEFAULT_SAVED_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const RECONCILE_DEBOUNCE_MS = 4_000;

type LoadState = "idle" | "loading" | "ready" | "unavailable";

interface SavedTracksState {
  records: SavedTrackRecord[];
  tracks: Track[];
  loadState: LoadState;
  enabled: boolean;
  limitBytes: number;
  status: SyncStatus;
  load: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setLimitBytes: (bytes: number) => void;
  removeAll: () => Promise<number>;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function readEnabled(): boolean {
  return readStorage(SAVE_LIKED_ENABLED_KEY) !== "0";
}

function readLimit(): number {
  const parsed = Number(readStorage(SAVED_LIMIT_KEY));
  return readStorage(SAVED_LIMIT_KEY) !== null && Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : DEFAULT_SAVED_LIMIT_BYTES;
}

function readMemory(): SavedSyncMemory {
  try {
    const parsed = JSON.parse(readStorage(SAVED_SYNC_MEMORY_KEY) ?? "null");
    return parsed && typeof parsed === "object"
      ? { ...emptySyncMemory(), ...parsed }
      : emptySyncMemory();
  } catch {
    return emptySyncMemory();
  }
}

const newestFirst = (records: SavedTrackRecord[]) =>
  [...records].sort((a, b) => b.savedAt - a.savedAt);

const withTracks = (records: SavedTrackRecord[]) => {
  const sorted = newestFirst(records);
  setSavedTrackIndex(sorted);
  return { records: sorted, tracks: sorted.map(savedRecordToTrack) };
};

const canDownload = () => navigator.onLine && !isOfflineMode();

const waitForOnline = () =>
  new Promise<void>((resolve) => {
    if (canDownload()) {
      resolve();
      return;
    }
    const finish = () => {
      if (!canDownload()) return;
      window.removeEventListener("online", finish);
      unsubscribe();
      resolve();
    };
    const unsubscribe = useOfflineModeStore.subscribe(finish);
    window.addEventListener("online", finish);
  });

const sync = createSavedTrackSync({
  now: () => Date.now(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  random: () => Math.random(),
  isOnline: canDownload,
  waitForOnline,
  isPlayerBusy: () => usePlayerStore.getState().status === "loading",
  currentTrackId: () => usePlayerStore.getState().currentTrack?.id ?? null,
  isEnabled: () => useSavedTracksStore.getState().enabled,
  limitBytes: () => useSavedTracksStore.getState().limitBytes,
  usage: async () => {
    const usage = await window.linerElectron?.savedTracksUsage();
    return usage ?? { bytes: 0, freeBytes: null };
  },
  saveTrack: (track) =>
    saveTrackToDevice(track, AbortSignal.timeout(5 * 60_000)),
  saveLyrics: saveLyricsToDevice,
  remove: async (trackIds) => {
    await window.linerElectron?.savedTracksRemove(trackIds);
  },
  classify: classifySaveFailure,
  readMemory,
  writeMemory: (memory) =>
    writeStorage(SAVED_SYNC_MEMORY_KEY, JSON.stringify(memory)),
  onStatus: (status) => useSavedTracksStore.setState({ status }),
  onRecords: (records) => useSavedTracksStore.setState(withTracks(records)),
  log: (message) => log("cyan", "saved", message),
});

export const useSavedTracksStore = create<SavedTracksState>((set, get) => ({
  records: [],
  tracks: [],
  loadState: "idle",
  enabled: readEnabled(),
  limitBytes: readLimit(),
  status: { phase: "starting", pending: 0 },

  load: async () => {
    const bridge = window.linerElectron;
    if (!bridge?.savedTracksList) {
      set({ loadState: "unavailable" });
      return;
    }
    if (get().loadState === "loading" || get().loadState === "ready") return;
    set({ loadState: "loading" });
    try {
      const records = await bridge.savedTracksList();
      set({ ...withTracks(records), loadState: "ready" });
      sync.setRecords(records);
    } catch {
      set({ loadState: "ready" });
    }
  },

  setEnabled: (enabled) => {
    writeStorage(SAVE_LIKED_ENABLED_KEY, enabled ? "1" : "0");
    set({ enabled });
    if (enabled) sync.forgetFailures();
    scheduleReconcile(0, enabled);
  },

  setLimitBytes: (bytes) => {
    writeStorage(SAVED_LIMIT_KEY, String(bytes));
    set({ limitBytes: bytes });
    void sync.resume();
  },

  removeAll: async () => {
    const bridge = window.linerElectron;
    if (!bridge) return 0;
    const current = usePlayerStore.getState().currentTrack?.id;
    const removing = get().records.map((record) => record.trackId);
    writeStorage(SAVE_LIKED_ENABLED_KEY, "0");
    set({ enabled: false, ...withTracks([]) });
    sync.setRecords([]);
    if (current && removing.includes(current))
      await playerEngine.stopAndClear().catch(() => {});
    if (removing.length === 0) return 0;
    return bridge.savedTracksRemove(removing);
  },
}));

let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
let resumeAfterReconcile = false;

function scheduleReconcile(delay = RECONCILE_DEBOUNCE_MS, resumeNow = false) {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  resumeAfterReconcile = resumeAfterReconcile || resumeNow;
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    const resume = resumeAfterReconcile;
    resumeAfterReconcile = false;
    const { tracks: liked, fromServer } = likedTracksSnapshot();
    void sync.reconcile(liked, fromServer).then(() => {
      if (resume) void sync.resume();
    });
  }, delay);
}

let started = false;

export function initSavedTracks() {
  if (started || typeof window === "undefined") return;
  if (!window.linerElectron?.savedTracksList) return;
  started = true;
  void useSavedTracksStore
    .getState()
    .load()
    .then(() => {
      subscribeLikedTracks(() => scheduleReconcile());
      void loadLikedTracks();
      scheduleReconcile(0);
    });
  let lastTrackId = usePlayerStore.getState().currentTrack?.id ?? null;
  usePlayerStore.subscribe((state) => {
    const id = state.currentTrack?.id ?? null;
    if (id === lastTrackId) return;
    lastTrackId = id;
    void sync.trackChanged();
  });
}
