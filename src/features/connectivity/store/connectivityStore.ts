import { create } from "zustand";
import { DIAG_ENDPOINTS, runAllChecks, type DiagnosticsResult } from "../lib/diagnostics";
import { buildOfflineDump, downloadDump, type SaveDumpResult } from "../lib/dump";

export const TRIP_COUNT = 3;
export const TRIP_WINDOW_MS = 60_000;
export const MAX_FAILURES = 20;

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
  recordFailure: (entry: Omit<FailureEntry, "at">) => void;
  runDiagnostics: () => Promise<void>;
  retry: () => Promise<void>;
  runAndSaveDump: () => Promise<SaveDumpResult>;
  reset: () => void;
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

  recordFailure: (entry) => {
    const at = Date.now();
    const failures = [...get().failures, { ...entry, at }].slice(-MAX_FAILURES);
    const recent = failures.filter((f) => at - f.at <= TRIP_WINDOW_MS).length;
    if (recent >= TRIP_COUNT) {
      set({ failures, tripped: true, visible: true });
      // fresh probes for the wall and the dump
      void get().runDiagnostics();
    } else {
      set({ failures });
    }
  },

  runDiagnostics: async () => {
    if (get().running) return;
    set({ running: true });
    try {
      const { checks, main } = await runAllChecks();
      set({ checks, main, lastRunAt: Date.now() });
    } finally {
      set({ running: false });
    }
  },

  retry: async () => {
    await get().runDiagnostics();
    const apiOk = get().checks.some((c) => c.id === "api" && c.status === "ok");
    if (apiOk) {
      set({ tripped: false, visible: false, failures: [] });
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
    });
  },
}));

// api-layer hook, importable without cycles (this feature never imports @/shared/api)
export function recordConnectivityFailure(entry: Omit<FailureEntry, "at">): void {
  try {
    useConnectivityStore.getState().recordFailure(entry);
  } catch {
    // store unavailable in exotic contexts, the request error still propagates
  }
}
