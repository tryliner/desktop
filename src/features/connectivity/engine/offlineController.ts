import { showToast } from "@/shared/ui/Toast";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import {
  readManualOfflineMode,
  useOfflineModeStore,
  isOfflineMode,
  type OfflineSource,
} from "../store/offlineModeStore";
import {
  setConnectivityHooks,
  useConnectivityStore,
} from "../store/connectivityStore";
import { issueGroup, issueResolved, type IssueGroup } from "../lib/classify";

const RECHECK_DELAYS_MS = [5_000, 10_000, 20_000, 30_000];
const STARTUP_CHECK_DELAY_MS = 8_000;
const ONLINE_EVENT_SETTLE_MS = 1_500;
const YOUTUBE_RECHECK_GAP_MS = 10 * 60_000;
const ISSUE_POLL_MS = 20_000;
const OFFLINE_TOAST_ID = "offline-mode";
export const DEVICE_LIBRARY_HASH = "#/library";

let recheckTimer: ReturnType<typeof setTimeout> | null = null;
let issuePollTimer: ReturnType<typeof setInterval> | null = null;
let recheckAttempt = 0;
let initialized = false;

const translate = (key: string, params?: Record<string, string | number>) =>
  createTranslatorSync(getStoredLocale())(key, params);

function openDeviceLibrary(): void {
  window.location.hash = DEVICE_LIBRARY_HASH;
}

function announceBack(group: IssueGroup): void {
  showToast(
    translate(
      group === "youtube"
        ? "offline.youtube_back_title"
        : "offline.back_online_title",
    ),
    "success",
    {
      id: OFFLINE_TOAST_ID,
      description: translate(
        group === "youtube"
          ? "offline.youtube_back_desc"
          : "offline.back_online_desc",
      ),
    },
  );
}

function resolvedNow(group: IssueGroup): boolean {
  const { verdict, youtube } = useOfflineModeStore.getState();
  return verdict !== null && issueResolved(group, verdict, youtube);
}

function clearRecheck(): void {
  if (recheckTimer) clearTimeout(recheckTimer);
  recheckTimer = null;
}

function scheduleRecheck(): void {
  clearRecheck();
  const { offline, source } = useOfflineModeStore.getState();
  if (!offline || source !== "auto") return;
  const delay =
    RECHECK_DELAYS_MS[Math.min(recheckAttempt, RECHECK_DELAYS_MS.length - 1)];
  recheckAttempt += 1;
  recheckTimer = setTimeout(() => void recheck(), delay);
}

async function recheck(): Promise<void> {
  const store = useOfflineModeStore.getState();
  if (!store.offline || store.source !== "auto") return;
  await store.check();
  const latest = useOfflineModeStore.getState();
  if (!latest.offline || latest.source !== "auto") return;
  const group = latest.reason ?? "server";
  if (!resolvedNow(group)) {
    scheduleRecheck();
    return;
  }
  clearRecheck();
  latest.leave();
  announceBack(group);
}

export function enterOfflineMode(
  source: OfflineSource,
  announce = true,
  reason: IssueGroup | null = null,
): void {
  const store = useOfflineModeStore.getState();
  if (store.offline && (store.source === source || source === "auto")) return;
  store.enter(source, reason);
  useConnectivityStore.getState().reset();
  recheckAttempt = 0;
  scheduleRecheck();
  if (!announce) return;
  showToast(
    translate(
      source === "manual"
        ? "offline.entered_manual_title"
        : "offline.entered_auto_title",
    ),
    "info",
    {
      id: OFFLINE_TOAST_ID,
      description: translate(
        source === "manual"
          ? "offline.entered_desc_manual"
          : "offline.entered_desc_auto",
      ),
      button: {
        label: translate("offline.open_device"),
        onClick: openDeviceLibrary,
      },
    },
  );
}

export async function goOnline(): Promise<boolean> {
  const store = useOfflineModeStore.getState();
  const group = store.reason ?? "server";
  const verdict = await store.check();
  if (resolvedNow(group)) {
    clearRecheck();
    useOfflineModeStore.getState().leave();
    announceBack(group);
    return true;
  }
  useOfflineModeStore.getState().enter("auto", group);
  recheckAttempt = 0;
  scheduleRecheck();
  showToast(
    translate(
      group === "youtube" && verdict === "online"
        ? "offline.still_youtube_title"
        : verdict === "offline"
          ? "offline.still_offline_title"
          : "offline.still_server_title",
    ),
    "error",
    {
      id: OFFLINE_TOAST_ID,
      description: translate("offline.still_desc"),
    },
  );
  return false;
}

export function presentDetectedIssue(): void {
  const issue = useOfflineModeStore.getState().detectedIssue();
  if (issue) useOfflineModeStore.getState().openIssue(issue);
}

export function noteYoutubeTrouble(
  kind: "failed" | "refused" = "failed",
): void {
  const { checkedAt, checking, offline, openIssue } =
    useOfflineModeStore.getState();
  if (offline) return;
  if (kind === "refused") {
    openIssue("youtube_refused");
    return;
  }
  if (checking) return;
  if (checkedAt !== null && Date.now() - checkedAt < YOUTUBE_RECHECK_GAP_MS)
    return;
  void useOfflineModeStore
    .getState()
    .check()
    .then(() => {
      const issue = useOfflineModeStore.getState().detectedIssue();
      if (issue && issueGroup(issue) === "youtube")
        useOfflineModeStore.getState().openIssue(issue);
    });
}

export async function retryConnection(): Promise<boolean> {
  const { issue } = useOfflineModeStore.getState();
  if (!issue) return true;
  if (issue === "youtube_refused") {
    useOfflineModeStore.getState().closeIssue();
    return true;
  }
  const group = issueGroup(issue);
  await useOfflineModeStore.getState().check();
  const latest = useOfflineModeStore.getState();
  if (latest.issue !== issue) return latest.issue === null;
  if (resolvedNow(group)) {
    latest.closeIssue();
    announceBack(group);
    return true;
  }
  const detected = latest.detectedIssue();
  if (detected && detected !== issue)
    useOfflineModeStore.setState({ issue: detected });
  return false;
}

export function enterOfflineForIssue(): void {
  const { issue } = useOfflineModeStore.getState();
  enterOfflineMode("auto", true, issue ? issueGroup(issue) : null);
}

function stopIssuePoll(): void {
  if (issuePollTimer) clearInterval(issuePollTimer);
  issuePollTimer = null;
}

function syncIssuePoll(): void {
  const { issue } = useOfflineModeStore.getState();
  if (!issue || issue === "youtube_refused") {
    stopIssuePoll();
    return;
  }
  if (issuePollTimer) return;
  issuePollTimer = setInterval(() => {
    if (useOfflineModeStore.getState().checking) return;
    void retryConnection().then((done) => {
      if (done) stopIssuePoll();
    });
  }, ISSUE_POLL_MS);
}

export function initOfflineMode(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  useOfflineModeStore.subscribe((state, previous) => {
    if (state.issue !== previous.issue) syncIssuePoll();
  });

  setConnectivityHooks({
    suppress: () =>
      isOfflineMode() || useOfflineModeStore.getState().issue !== null,
    onTrip: async () => {
      await useOfflineModeStore.getState().check();
      const issue = useOfflineModeStore.getState().detectedIssue();
      if (issue === "offline" || issue === "server")
        useOfflineModeStore.getState().openIssue(issue);
      return "handled";
    },
  });

  window.addEventListener("offline", () => {
    useOfflineModeStore.getState().openIssue("offline");
  });
  window.addEventListener("online", () => {
    const { offline, source, issue } = useOfflineModeStore.getState();
    if (issue === "offline") {
      setTimeout(() => void retryConnection(), ONLINE_EVENT_SETTLE_MS);
      return;
    }
    if (!offline || source !== "auto") return;
    recheckAttempt = 0;
    clearRecheck();
    recheckTimer = setTimeout(() => void recheck(), ONLINE_EVENT_SETTLE_MS);
  });

  if (readManualOfflineMode()) {
    enterOfflineMode("manual", false);
    return;
  }
  if (!navigator.onLine) {
    useOfflineModeStore.getState().openIssue("offline");
    return;
  }
  setTimeout(() => {
    if (isOfflineMode()) return;
    void useOfflineModeStore
      .getState()
      .check()
      .then(() => presentDetectedIssue());
  }, STARTUP_CHECK_DELAY_MS);
}
