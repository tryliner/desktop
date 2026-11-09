import { initTelemetry } from "@/shared/telemetry";
import {
  forgetStorageAnalytics,
  initBackgroundStorageAnalytics,
} from "@/shared/utils/cacheManager";
import { api, initEdgeKey, registerSignOutTask } from "@/shared/api";
import { initClientVisitorSession } from "@/shared/youtube";
import { initBundleStampLog } from "@/shared/utils/bundleStampLog";
import { initSavedTracks } from "@/features/library/saved";
import { initOfflineMode } from "@/features/connectivity/engine/offlineController";

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
