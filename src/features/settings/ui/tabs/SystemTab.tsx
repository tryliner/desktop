import { useState } from "react";
import { FolderOpenLine } from "@mingcute/react";
import { useToast } from "@/shared/ui";
import Button from "@/shared/ui/Button";
import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui";
import { isTelemetryEnabled, setTelemetryEnabled } from "@/shared/telemetry";
import { useConnectivityStore } from "@/features/connectivity";
import {
  clearMediaAndCoverCache,
  clearSearchAndQueryCache,
} from "@/shared/utils/cacheManager";
import { SettingRow, SettingSection } from "../controls";

export function SystemTab() {
  const { t } = useTranslation();
  const [telemetryOptIn, setTelemetryOptIn] = useState(() => isTelemetryEnabled());
  const { toast } = useToast();
  const [dumpExported, setDumpExported] = useState(false);
  const connRunning = useConnectivityStore((s) => s.running);
  const connChecks = useConnectivityStore((s) => s.checks);
  const connLastRunAt = useConnectivityStore((s) => s.lastRunAt);
  const runAndSaveDump = useConnectivityStore((s) => s.runAndSaveDump);

  const handleToggleTelemetry = (checked: boolean) => {
    setTelemetryOptIn(checked);
    setTelemetryEnabled(checked);
    toast(checked ? t("settings.telemetry.enabled") : t("settings.telemetry.disabled"), "info");
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <SettingSection>
        <SettingRow
          title={t("settings.telemetry.title")}
          description={t("settings.telemetry.description")}
          control={
            <ToggleSwitch
              checked={telemetryOptIn}
              onChange={handleToggleTelemetry}
            />
          }
        />
      </SettingSection>

      <SettingSection label={t("settings.cache.title")}>
        <SettingRow
          title={t("settings.cache.local_cache.title")}
          description={t("settings.cache.local_cache.description")}
          control={
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={async () => {
                try {
                  await clearMediaAndCoverCache();
                  toast(t("settings.cache.local_cache.success"), "success");
                } catch {
                  toast(t("settings.cache.local_cache.error"), "error");
                }
              }}
            >
              {t("settings.cache.local_cache.button")}
            </Button>
          }
        />

        <SettingRow
          title={t("settings.cache.search_cache.title")}
          description={t("settings.cache.search_cache.description")}
          control={
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={async () => {
                try {
                  await clearSearchAndQueryCache();
                  toast(t("settings.cache.search_cache.success"), "success");
                } catch {
                  toast(t("settings.cache.search_cache.error"), "error");
                }
              }}
            >
              {t("settings.cache.search_cache.button")}
            </Button>
          }
        />
      </SettingSection>

      <SettingSection label={t("settings.connection.title")}>
        <SettingRow
          title={t("settings.connection.checks_title")}
          description={
            connChecks.length > 0 && connLastRunAt
              ? t("settings.connection.last_run", {
                  ok: connChecks.filter((c) => c.status === "ok").length,
                  total: connChecks.length,
                  time: new Date(connLastRunAt).toLocaleTimeString(),
                })
              : t("settings.connection.never_run")
          }
          control={
            <div className="flex items-center gap-[8px]">
              {dumpExported && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={async () => {
                    const targetPath = useConnectivityStore.getState().lastSavedDumpPath || undefined;
                    if (window.linerElectron?.openExportFolder) {
                      await window.linerElectron.openExportFolder(targetPath);
                    } else if (window.linerElectron?.openDownloads) {
                      await window.linerElectron.openDownloads(targetPath);
                    } else {
                      toast(t("settings.connection.open_folder"), "info");
                    }
                  }}
                  title={t("settings.connection.open_folder")}
                  aria-label={t("settings.connection.open_folder")}
                  className="!h-[34px] !w-[34px] !px-0"
                >
                  <FolderOpenLine size={18} />
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={connRunning}
                onClick={async () => {
                  const res = await runAndSaveDump();
                  if (res.success) {
                    setDumpExported(true);
                    toast(t("settings.connection.saved"), "success");
                  } else if (!res.canceled) {
                    toast(t("settings.connection.failed"), "error");
                  }
                }}
              >
                {connRunning
                  ? t("settings.connection.checking")
                  : t("settings.connection.button")}
              </Button>
            </div>
          }
        />
      </SettingSection>
    </div>
  );
}
