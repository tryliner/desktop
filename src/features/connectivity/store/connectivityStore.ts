import { create } from "zustand";
import { runAllChecks, type DiagnosticsResult } from "../lib/diagnostics";
import { isPlaybackPath } from "../lib/failureKind";

export const TRIP_COUNT = 3;
export const TRIP_WINDOW_MS = 60_000;
export const MAX_FAILURES = 20;

export type TripOutcome = "show" | "handled";

interface ConnectivityHooks {
  suppress: () => boolean;
  onTrip: () => Promise<TripOutcome>;
}

let hooks: ConnectivityHooks | null = null;

export function setConnectivityHooks(next: ConnectivityHooks | null): void {
  hooks = next;
}

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
  failures: FailureEntry[];
  lastRunAt?: number;
  recordFailure: (entry: Omit<FailureEntry, "at">) => void;
  runDiagnostics: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  tripped: false,
  visible: false,
  running: false,
  checks: [],
  failures: [],
  lastRunAt: undefined,

  recordFailure: (entry) => {
    if (isPlaybackPath(entry.path)) return;
    if (hooks?.suppress()) return;
    const at = Date.now();
    const failures = [...get().failures, { ...entry, at }].slice(-MAX_FAILURES);
    const recent = failures.filter((f) => at - f.at <= TRIP_WINDOW_MS).length;
    if (recent >= TRIP_COUNT && hooks && !get().tripped) {
      set({ failures, tripped: true });
      void hooks
        .onTrip()
        .catch((): TripOutcome => "show")
        .then((outcome) => {
          if (!get().tripped) return;
          if (outcome === "handled") {
            get().reset();
            return;
          }
          set({ visible: true });
          void get().runDiagnostics();
        });
    } else if (recent >= TRIP_COUNT && !hooks) {
      set({ failures, tripped: true, visible: true });
      void get().runDiagnostics();
    } else {
      set({ failures });
    }
  },

  runDiagnostics: async () => {
    if (get().running) return;
    set({ running: true });
    try {
      const { checks } = await runAllChecks();
      set({ checks, lastRunAt: Date.now() });
      const apiOk = checks.some((c) => c.id === "api" && c.status === "ok");
      if (apiOk && get().tripped) {
        set({ tripped: false, visible: false, failures: [] });
      }
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

  reset: () => {
    set({
      tripped: false,
      visible: false,
      failures: [],
    });
  },
}));

export function recordConnectivityFailure(
  entry: Omit<FailureEntry, "at">,
): void {
  if (isPlaybackPath(entry.path)) return;
  try {
    useConnectivityStore.getState().recordFailure(entry);
  } catch {}
}
