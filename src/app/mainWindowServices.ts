import { initTelemetry } from "@/shared/telemetry";
import { initBackgroundStorageAnalytics } from "@/shared/utils/cacheManager";
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
}
