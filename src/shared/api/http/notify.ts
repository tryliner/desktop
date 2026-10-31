import { showToast } from "@/shared/ui/Toast";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import { connectionToastsMuted } from "@/features/connectivity";
import { enterOfflineMode } from "@/features/connectivity/engine/offlineController";

export function translate(
  key: string,
  vars?: Record<string, string | number>,
): string {
  try {
    return createTranslatorSync(getStoredLocale())(key, vars);
  } catch {
    return key;
  }
}

function offlineModeAction() {
  return {
    label: translate("offline.use_offline"),
    onClick: () =>
      enterOfflineMode(
        "auto",
        true,
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "server",
      ),
  };
}

export function notifyTimeout(): void {
  if (connectionToastsMuted()) return;
  showToast(translate("common.error_timeout_title"), "error", {
    id: "network-timeout-toast",
    description: translate("common.error_network"),
    action: offlineModeAction(),
  });
}

export function notifyNetworkError(): void {
  if (connectionToastsMuted()) return;
  showToast(translate("common.error_network_title"), "error", {
    id: "network-error-toast",
    description: translate("common.error_network"),
    action: offlineModeAction(),
  });
}

export function notifyServerError(status: number, requestId?: string): void {
  if (connectionToastsMuted()) return;
  showToast(translate("common.error_server_title"), "error", {
    id: `server-error-${status}`,
    description: translate("common.error_server"),
    requestId,
  });
}
