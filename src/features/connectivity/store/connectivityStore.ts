import { create } from "zustand";
import { DIAG_ENDPOINTS, runAllChecks, type DiagnosticsResult } from "../lib/diagnostics";
import { isPlaybackPath } from "../lib/failureKind";
import { buildOfflineDump, downloadDump, type SaveDumpResult } from "../lib/dump";
import { DEFAULT_PRIMARY_API, setApiBaseUrl } from "@/shared/api/baseUrl";

export const TRIP_COUNT = 3;
export const TRIP_WINDOW_MS = 60_000;
export const MAX_FAILURES = 20;
// successful answers in a row needed to leave offline mode, so a flapping server
// doesn't bounce the user between the wall and their downloads
export const RESTORE_SUCCESS_COUNT = 3;

export interface FailureEntry {
  at: number;
  method: string;
  path: string;
  status?: number;
  code?: string;
  latencyMs: number;
}

interface ConnectivityState {
  tripped: boolean;
  visible: boolean;
  running: boolean;
  checks: DiagnosticsResult["checks"];
  main: DiagnosticsResult["main"];
  failures: FailureEntry[];
  lastRunAt?: number;
  lastSavedDumpPath: string | null;
  // the user chose to keep listening to downloaded tracks while the server is unreachable:
  // failures are still recorded for the report, but the wall stays hidden until a retry succeeds.
  offlineMode: boolean;
  offlineSuccessStreak: number;
  // set when offline mode ended because the server answered again
  restoredAt?: number;
  recordFailure: (entry: Omit<FailureEntry, "at">) => void;
  runDiagnostics: () => Promise<void>;
  retry: () => Promise<void>;
  runAndSaveDump: () => Promise<SaveDumpResult>;
  reset: () => void;
  enterOfflineMode: () => void;
  exitOfflineMode: () => void;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  tripped: false,
  visible: false,
  running: false,
  checks: [],
  main: null,
  failures: [],
  lastRunAt: undefined,
  lastSavedDumpPath: null,
  offlineMode: false,
  offlineSuccessStreak: 0,

  recordFailure: (entry) => {
    if (isPlaybackPath(entry.path)) return;
    const at = Date.now();
    const failures = [...get().failures, { ...entry, at }].slice(-MAX_FAILURES);
    const recent = failures.filter((f) => at - f.at <= TRIP_WINDOW_MS).length;
    if (recent >= TRIP_COUNT) {
      if (get().offlineMode) {
        set({ failures, tripped: true, offlineSuccessStreak: 0 });
        return;
      }
      set({ failures, tripped: true, visible: true });
      void get().runDiagnostics();
    } else {
      set({ failures, offlineSuccessStreak: 0 });
    }
  },

  runDiagnostics: async () => {
    if (get().running) return;
    set({ running: true });
    try {
      const { checks, main } = await runAllChecks();
      set({ checks, main, lastRunAt: Date.now() });
      const apiOk = checks.some((c) => c.id === "api" && c.status === "ok");
      if (apiOk && (get().tripped || get().offlineMode)) {
        set({
          tripped: false,
          visible: false,
          failures: [],
          ...(get().offlineMode ? { offlineMode: false, offlineSuccessStreak: 0, restoredAt: Date.now() } : {}),
        });
      }
    } finally {
      set({ running: false });
    }
  },

  retry: async () => {
    await get().runDiagnostics();
    const apiOk = get().checks.some((c) => c.id === "api" && c.status === "ok");
    if (apiOk) {
      setApiBaseUrl(DEFAULT_PRIMARY_API);
      set({
        tripped: false,
        visible: false,
        failures: [],
        ...(get().offlineMode ? { offlineMode: false, offlineSuccessStreak: 0, restoredAt: Date.now() } : {}),
      });
    }
  },

  // manual trigger from settings: runs every probe and saves the dump file
  // straight away, without showing the wall.
  runAndSaveDump: async () => {
    await get().runDiagnostics();
    const state = get();
    try {
      const result = await downloadDump(
        buildOfflineDump({
          checks: state.checks,
          failures: state.failures,
          main: state.main,
          endpoints: DIAG_ENDPOINTS,
        }),
      );
      if (result.filePath) {
        set({ lastSavedDumpPath: result.filePath });
      }
      return result;
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  reset: () => {
    set({
      tripped: false,
      visible: false,
      failures: [],
      offlineMode: false,
      offlineSuccessStreak: 0,
    });
  },

  enterOfflineMode: () => {
    set({ offlineMode: true, visible: false, offlineSuccessStreak: 0 });
  },

  exitOfflineMode: () => {
    set({ offlineMode: false, offlineSuccessStreak: 0 });
  },
}));

export function recordConnectivityFailure(entry: Omit<FailureEntry, "at">): void {
  if (isPlaybackPath(entry.path)) return;
  try {
    useConnectivityStore.getState().recordFailure(entry);
  } catch {
  }
}

export function isOfflineModeActive(): boolean {
  try {
    return useConnectivityStore.getState().offlineMode;
  } catch {
    return false;
  }
}

// successful api answers while offline mode is on mean liner's servers are coming back
export function recordConnectivitySuccess(): void {
  try {
    const state = useConnectivityStore.getState();
    if (!state.offlineMode) return;
    const streak = state.offlineSuccessStreak + 1;
    if (streak < RESTORE_SUCCESS_COUNT) {
      useConnectivityStore.setState({ offlineSuccessStreak: streak });
      return;
    }
    useConnectivityStore.setState({
      offlineMode: false,
      offlineSuccessStreak: 0,
      restoredAt: Date.now(),
      tripped: false,
      failures: [],
    });
  } catch {
  }
}
