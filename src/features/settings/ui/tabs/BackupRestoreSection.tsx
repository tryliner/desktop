import { useEffect, useState } from "react";
import { DownloadLine, UploadLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import Button from "@/shared/ui/Button";
import { showToast } from "@/shared/ui";
import { debouncedStorage } from "@/shared/utils/storage";

const BACKUP_PREFIX = "liner_";
// Never carry credentials, sessions or the ListenBrainz token into a backup.
const SECRET_KEY_RE =
  /token|secret|auth|session|account|key|listenbrainz/i;

interface PlatformInfo {
  portable: boolean;
  dataPath: string;
}

function collectSettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  if (typeof localStorage === "undefined") return settings;
  debouncedStorage.flush();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(BACKUP_PREFIX) || SECRET_KEY_RE.test(key)) {
      continue;
    }
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  return settings;
}

function applySettings(raw: string): number {
  const parsed = JSON.parse(raw) as {
    app?: unknown;
    settings?: unknown;
  };
  if (
    parsed?.app !== "liner-backup" ||
    !parsed.settings ||
    typeof parsed.settings !== "object"
  ) {
    throw new Error("invalid");
  }
  let applied = 0;
  debouncedStorage.flush();
  for (const [key, value] of Object.entries(
    parsed.settings as Record<string, unknown>,
  )) {
    if (
      !key.startsWith(BACKUP_PREFIX) ||
      SECRET_KEY_RE.test(key) ||
      typeof value !== "string"
    ) {
      continue;
    }
    localStorage.setItem(key, value);
    applied += 1;
  }
  if (applied === 0) throw new Error("empty");
  return applied;
}

export default function BackupRestoreSection() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [info, setInfo] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    window.linerElectron
      ?.getPlatformInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const handleExport = async () => {
    setBusy("export");
    try {
      const payload = JSON.stringify({
        app: "liner-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: collectSettings(),
      });
      const result = await window.linerElectron?.exportBackup(payload);
      if (result?.ok) {
        showToast(t("settings.storage.backup_exported"), "success");
      } else if (result?.error) {
        showToast(result.error, "error");
      }
    } catch {
      showToast(t("settings.storage.backup_failed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    setBusy("import");
    try {
      const result = await window.linerElectron?.importBackup();
      if (!result?.ok) {
        if (result?.error) showToast(result.error, "error");
        return;
      }
      if (!result.data) return;
      if (!window.confirm(t("settings.storage.backup_restore_confirm"))) return;
      try {
        applySettings(result.data);
        window.location.reload();
      } catch {
        showToast(t("settings.storage.backup_invalid"), "error");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-[12px] rounded-2xl border border-border-primary/60 bg-bg-panel p-[16px] dark:border-transparent dark:bg-white/[0.035]">
      <div className="pl-[6px]">
        <h5 className="m-0 text-[13.5px] font-[600] text-text-primary">
          {t("settings.storage.backup_title")}
        </h5>
        <p className="m-0 mt-0.5 text-[11.5px] text-text-tertiary">
          {t("settings.storage.backup_desc")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-[8px]">
        <Button
          variant="secondary"
          size="default"
          type="button"
          disabled={busy !== null}
          onClick={() => void handleExport()}
          className="flex items-center gap-[6px] !h-[36px] px-[14px] text-[12.5px]"
        >
          <DownloadLine size={15} />
          {busy === "export"
            ? t("settings.storage.backup_working")
            : t("settings.storage.backup_export")}
        </Button>
        <Button
          variant="secondary"
          size="default"
          type="button"
          disabled={busy !== null}
          onClick={() => void handleImport()}
          className="flex items-center gap-[6px] !h-[36px] px-[14px] text-[12.5px]"
        >
          <UploadLine size={15} />
          {busy === "import"
            ? t("settings.storage.backup_working")
            : t("settings.storage.backup_import")}
        </Button>
      </div>

      {info ? (
        <div className="rounded-[10px] bg-black/[0.04] px-[12px] py-[9px] text-[11.5px] leading-[1.5] dark:bg-white/[0.05]">
          <p className="m-0 text-text-secondary">
            {info.portable
              ? t("settings.storage.portable_on")
              : t("settings.storage.portable_off")}
          </p>
          <p className="m-0 mt-[2px] break-all text-text-tertiary">
            {t("settings.storage.data_path", { path: info.dataPath })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
