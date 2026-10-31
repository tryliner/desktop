import { create } from "zustand";
import { probeConnection } from "../lib/probe";
import {
  classifyConnection,
  connectionIssue,
  issueGroup,
  youtubeReach,
  type ConnectionIssue,
  type ConnectionVerdict,
  type IssueGroup,
  type YoutubeReach,
} from "../lib/classify";

export const OFFLINE_MODE_KEY = "liner_offline_mode";
export const OFFLINE_UNAVAILABLE_MESSAGE = "Not saved on this device";

export type OfflineSource = "auto" | "manual";

const ISSUE_PRIORITY: Record<IssueGroup, number> = {
  youtube: 0,
  server: 1,
  offline: 2,
};

interface OfflineModeState {
  offline: boolean;
  source: OfflineSource | null;
  reason: IssueGroup | null;
  verdict: ConnectionVerdict | null;
  youtube: YoutubeReach;
  country: string | null;
  checking: boolean;
  checkedAt: number | null;
  issue: ConnectionIssue | null;
  dismissed: IssueGroup[];
  enter: (source: OfflineSource, reason?: IssueGroup | null) => void;
  leave: () => void;
  check: () => Promise<ConnectionVerdict>;
  detectedIssue: () => ConnectionIssue | null;
  openIssue: (issue: ConnectionIssue) => boolean;
  closeIssue: () => void;
  dismissIssue: () => void;
}

function persistManual(on: boolean): void {
  try {
    if (on) localStorage.setItem(OFFLINE_MODE_KEY, "1");
    else localStorage.removeItem(OFFLINE_MODE_KEY);
  } catch {}
}

export function readManualOfflineMode(): boolean {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

let inFlight: Promise<ConnectionVerdict> | null = null;

export const useOfflineModeStore = create<OfflineModeState>((set, get) => ({
  offline: false,
  source: null,
  reason: null,
  verdict: null,
  youtube: "unknown",
  country: null,
  checking: false,
  checkedAt: null,
  issue: null,
  dismissed: [],

  enter: (source, reason = null) => {
    persistManual(source === "manual");
    set({ offline: true, source, reason, issue: null });
  },

  leave: () => {
    persistManual(false);
    set({ offline: false, source: null, reason: null });
  },

  check: () => {
    if (inFlight) return inFlight;
    set({ checking: true });
    inFlight = (async () => {
      try {
        const probe = await probeConnection();
        const verdict = classifyConnection(probe);
        const youtube = youtubeReach(probe);
        set({
          verdict,
          youtube: youtube === "unknown" ? get().youtube : youtube,
          country: probe.country ?? get().country,
          checkedAt: Date.now(),
        });
        return verdict;
      } finally {
        set({ checking: false });
        inFlight = null;
      }
    })();
    return inFlight;
  },

  detectedIssue: () => {
    const { verdict, youtube } = get();
    return verdict ? connectionIssue(verdict, youtube) : null;
  },

  openIssue: (issue) => {
    const { offline, dismissed, issue: current } = get();
    const group = issueGroup(issue);
    if (offline || dismissed.includes(group)) return false;
    if (current && ISSUE_PRIORITY[issueGroup(current)] > ISSUE_PRIORITY[group])
      return false;
    set({ issue });
    return true;
  },

  closeIssue: () => set({ issue: null }),

  dismissIssue: () => {
    const { issue, dismissed } = get();
    if (!issue) return;
    const group = issueGroup(issue);
    set({
      issue: null,
      dismissed: dismissed.includes(group) ? dismissed : [...dismissed, group],
    });
  },
}));

export function isOfflineMode(): boolean {
  return useOfflineModeStore.getState().offline;
}

export function connectionToastsMuted(): boolean {
  const { offline, issue } = useOfflineModeStore.getState();
  return offline || issue === "server" || issue === "offline";
}
