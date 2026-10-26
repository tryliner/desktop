import { initTelemetry } from "@/shared/telemetry";
import { initBackgroundStorageAnalytics } from "@/shared/utils/cacheManager";
import { initClientVisitorSession } from "@/shared/youtube";
import { initBundleStampLog } from "@/shared/utils/bundleStampLog";
import { lastfmTracker } from "@/features/lastfm/playbackTracker";

export function initMainWindowServices() {
  if (window.linerElectron?.lastfm) lastfmTracker.bind(window.linerElectron.lastfm);
  initTelemetry();
  initBackgroundStorageAnalytics();
  initClientVisitorSession();
  initBundleStampLog();
}
