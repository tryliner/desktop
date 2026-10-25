import { useState, useEffect } from "react";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { APP_VERSION } from "@/shared/config/version";
import { useUpdaterStore } from "@/features/updater";

export function useAboutAppVersion() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [appVersion, setAppVersion] = useState(APP_VERSION);
  const [bundleInfo, setBundleInfo] = useState<{
    bundleVersion: string;
    isOta: boolean;
    sha256: string | null;
  } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);

  useEffect(() => {
    if (window.linerElectron) {
      window.linerElectron
        .getAppVersion?.()
        .then((ver) => {
          if (ver) setAppVersion(ver);
        })
        .catch(() => {});

      window.linerElectron
        .bundleGetStatus?.()
        .then((status) => {
          if (status) {
            setBundleInfo({
              bundleVersion: status.bundleVersion,
              isOta: status.isOta,
              sha256: status.sha256,
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleCheckUpdates = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      await useUpdaterStore.getState().checkForUpdates();
      const status = useUpdaterStore.getState().status;
      const updateInfo = useUpdaterStore.getState().updateInfo;
      if (status === "available" && updateInfo) {
        useUpdaterStore.getState().openDialog();
      } else {
        toast(
          t("settings.about.latest_version_toast", { version: appVersion }),
          "info",
        );
      }
    } catch {
      toast(
        t("settings.about.latest_version_toast", { version: appVersion }),
        "info",
      );
    } finally {
      setCheckingUpdate(false);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastCheckedTime(timeStr);
    }
  };

  return {
    appVersion,
    bundleInfo,
    checkingUpdate,
    lastCheckedTime,
    handleCheckUpdates,
  };
}
