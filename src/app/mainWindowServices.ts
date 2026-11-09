import { initTelemetry } from "@/shared/telemetry";
import {
  forgetStorageAnalytics,
  initBackgroundStorageAnalytics,
} from "@/shared/utils/cacheManager";
import { registerSignOutTask } from "@/shared/api";
import { initClientVisitorSession } from "@/shared/youtube";
import { initBundleStampLog } from "@/shared/utils/bundleStampLog";
import { initSavedTracks } from "@/features/library/saved";
import { initOfflineMode } from "@/features/connectivity/engine/offlineController";
import { api, initEdgeKey } from "@/shared/api";

export function initMainWindowServices() {
  initTelemetry();
  initBackgroundStorageAnalytics();
  initClientVisitorSession();
  initBundleStampLog();
  initOfflineMode();
  initSavedTracks();
  initEdgeKey(() => api.fetchEdgeKey());
  registerSignOutTask(forgetStorageAnalytics);
}
