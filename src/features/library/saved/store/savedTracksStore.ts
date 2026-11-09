import { create } from "zustand";
import {
  savedRecordToTrack,
  setSavedTrackIndex,
  type SavedTrackRecord,
} from "@/shared/media/saved";
import type { Track } from "@/shared/types";
import { getAuthSession, registerSignOutTask } from "@/shared/api";
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
  type StoredClaims,
  type SyncStatus,
} from "../engine/savedTrackSync";
import {
  classifySaveFailure,
  saveLyricsToDevice,
  saveTrackToDevice,
} from "../engine/savedTrackFetcher";
import {
  parseSignOutChoice,
  resolveKeepOnSignOut,
  type SignOutChoice,
} from "../engine/signOutChoice";

export const SAVE_LIKED_ENABLED_KEY = "liner_save_liked_enabled";
export const SAVED_LIMIT_KEY = "liner_saved_limit_bytes";
export const SAVED_SYNC_MEMORY_KEY = "liner_saved_sync_v1";
export const SAVED_CLAIMS_KEY = "liner_saved_claims_v1";
export const SIGN_OUT_CHOICE_KEY = "liner_saved_sign_out_choice";

export const DEFAULT_SAVED_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const RECONCILE_DEBOUNCE_MS = 4_000;

type LoadState = "idle" | "loading" | "ready" | "unavailable";

interface SavedTracksState {
  records: SavedTrackRecord[];
  tracks: Track[];
  sharedCount: number;
  loadState: LoadState;
  enabled: boolean;
  signOutChoice: SignOutChoice;
  signOutAnswer: boolean | null;
  limitBytes: number;
  status: SyncStatus;
  load: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setSignOutChoice: (choice: SignOutChoice) => void;
  answerSignOut: (keep: boolean, remember: boolean) => void;
  setLimitBytes: (bytes: number) => void;
  removeAll: () => Promise<number>;
  removeShared: () => Promise<number>;
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

function readSignOutChoice(): SignOutChoice {
  return parseSignOutChoice(readStorage(SIGN_OUT_CHOICE_KEY));
}

export function readClaims(accountId: string | null): StoredClaims {
  const raw = readStorage(SAVED_CLAIMS_KEY);
  if (raw === null) return accountId ? "all" : [];
  try {
    const parsed = JSON.parse(raw) as {
      accountId?: unknown;
      trackIds?: unknown;
    } | null;
    if (!parsed || parsed.accountId !== accountId) return [];
    return Array.isArray(parsed.trackIds)
      ? parsed.trackIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

export function writeClaims(accountId: string | null, trackIds: string[]) {
  writeStorage(SAVED_CLAIMS_KEY, JSON.stringify({ accountId, trackIds }));
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

const withTracks = (records: SavedTrackRecord[], sharedCount = 0) => {
  const sorted = newestFirst(records);
  setSavedTrackIndex(sorted);
  return {
    records: sorted,
    tracks: sorted.map(savedRecordToTrack),
    sharedCount,
  };
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
  removeAll: async () => {
    await window.linerElectron?.savedTracksRemoveAll();
  },
  accountId: () => getAuthSession()?.user?.id ?? null,
  readClaims,
  writeClaims,
  classify: classifySaveFailure,
  readMemory,
  writeMemory: (memory) =>
    writeStorage(SAVED_SYNC_MEMORY_KEY, JSON.stringify(memory)),
  onStatus: (status) => useSavedTracksStore.setState({ status }),
  onRecords: (claimed, all) =>
    useSavedTracksStore.setState(
      withTracks(claimed, all.length - claimed.length),
    ),
  log: (message) => log("cyan", "saved", message),
});

export const useSavedTracksStore = create<SavedTracksState>((set, get) => ({
  records: [],
  tracks: [],
  sharedCount: 0,
  loadState: "idle",
  enabled: readEnabled(),
  signOutChoice: readSignOutChoice(),
  signOutAnswer: null,
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
      sync.setRecords(records);
      set({ loadState: "ready" });
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

  setSignOutChoice: (choice) => {
    writeStorage(SIGN_OUT_CHOICE_KEY, choice);
    set({ signOutChoice: choice });
  },

  answerSignOut: (keep, remember) => {
    set({ signOutAnswer: keep });
    if (remember) get().setSignOutChoice(keep ? "keep" : "remove");
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
    set({ enabled: false });
    if (current && removing.includes(current))
      await playerEngine.stopAndClear().catch(() => {});
    return sync.removeClaimed();
  },

  removeShared: async () => {
    if (!window.linerElectron) return 0;
    return sync.removeShared();
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
  registerSignOutTask(async () => {
    const { signOutChoice, signOutAnswer } = useSavedTracksStore.getState();
    useSavedTracksStore.setState({ signOutAnswer: null });
    await sync.signOut(resolveKeepOnSignOut(signOutChoice, signOutAnswer));
  });
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
