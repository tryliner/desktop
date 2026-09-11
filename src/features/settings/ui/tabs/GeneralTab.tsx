import { useState, useEffect } from "react";
import { FolderOpenLine } from "@mingcute/react";
import { useToast } from "@/shared/ui";
import { useTranslation, type Locale } from "@/languages";
import { usePlayerStore } from "@/features/player";
import { ToggleSwitch } from "@/shared/ui";
import { isTelemetryEnabled, setTelemetryEnabled } from "@/shared/telemetry";
import { useConnectivityStore } from "@/features/connectivity";
import {
  clearMediaAndCoverCache,
  clearSearchAndQueryCache,
} from "@/shared/utils/cacheManager";

const locales: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "uk", label: "Українська" },
];

export function GeneralTab() {
  const { t, locale: currentLocale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [telemetryOptIn, setTelemetryOptIn] = useState(() => isTelemetryEnabled());
  const autoplaySimilar = usePlayerStore((state) => state.autoplaySimilar);
  const setAutoplaySimilar = usePlayerStore(
    (state) => state.setAutoplaySimilar,
  );
  const trackDoubleClickBehavior = usePlayerStore(
    (state) => state.trackDoubleClickBehavior,
  );
  const setTrackDoubleClickBehavior = usePlayerStore(
    (state) => state.setTrackDoubleClickBehavior,
  );
  const defaultPlaybackContext = usePlayerStore(
    (state) => state.defaultPlaybackContext,
  );
  const setDefaultPlaybackContext = usePlayerStore(
    (state) => state.setDefaultPlaybackContext,
  );
  const { toast } = useToast();
  const [dumpExported, setDumpExported] = useState(false);
  const connRunning = useConnectivityStore((s) => s.running);
  const connChecks = useConnectivityStore((s) => s.checks);
  const connLastRunAt = useConnectivityStore((s) => s.lastRunAt);
  const runAndSaveDump = useConnectivityStore((s) => s.runAndSaveDump);

  const handleToggleTelemetry = (checked: boolean) => {
    setTelemetryOptIn(checked);
    setTelemetryEnabled(checked);
    toast(
      checked
        ? currentLocale === "ru"
          ? "Анонимная телеметрия включена"
          : currentLocale === "uk"
            ? "Анонімна телеметрія увімкнена"
            : "Anonymous telemetry enabled"
        : currentLocale === "ru"
          ? "Телеметрия полностью отключена"
          : currentLocale === "uk"
            ? "Телеметрія повністю вимкнена"
            : "Telemetry completely disabled",
      "info",
    );
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col gap-[36px]">
      {/* Language Section */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.language.label")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.language.description")}
          </p>
        </div>

        {mounted && (
          <div className="inline-flex items-center gap-[6px] rounded-xl bg-bg-elevated border border-border-primary p-[5px] w-fit">
            {locales.map((l) => {
              const isActive = currentLocale === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLocale(l.value)}
                  className={`inline-flex items-center gap-[5px] rounded-md px-[18px] py-[8px] text-[14px] leading-none capitalize border-0 cursor-pointer ${
                    isActive
                      ? "bg-border-alpha-14 text-text-primary shadow-sm"
                      : "bg-transparent text-text-secondary hover:text-text-primary"
                  }`}
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Autoplay Similar Songs */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.autoplay_similar.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.autoplay_similar.description")}
          </p>
        </div>

        <ToggleSwitch
          checked={autoplaySimilar}
          onChange={setAutoplaySimilar}
        />
      </div>

      {/* Track Double Click Behavior */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.track_double_click.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.track_double_click.description")}
          </p>
        </div>

        {mounted && (
          <div className="inline-flex items-center gap-[6px] rounded-xl bg-bg-elevated border border-border-primary p-[5px] w-fit">
            {(
              [
                {
                  value: "play",
                  label: t("settings.track_double_click.play"),
                },
                {
                  value: "queue",
                  label: t("settings.track_double_click.queue"),
                },
              ] as const
            ).map((item) => {
              const isActive = trackDoubleClickBehavior === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTrackDoubleClickBehavior(item.value)}
                  className={`inline-flex items-center gap-[5px] rounded-md px-[18px] py-[8px] text-[14px] leading-none border-0 cursor-pointer ${
                    isActive
                      ? "bg-border-alpha-14 text-text-primary shadow-sm"
                      : "bg-transparent text-text-secondary hover:text-text-primary"
                  }`}
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Default Playback Context */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.default_playback_context.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.default_playback_context.description")}
          </p>
        </div>

        {mounted && (
          <div className="inline-flex items-center gap-[6px] rounded-xl bg-bg-elevated border border-border-primary p-[5px] w-fit">
            {(
              [
                {
                  value: "resume",
                  label: t("settings.default_playback_context.resume"),
                },
                {
                  value: "empty",
                  label: t("settings.default_playback_context.empty"),
                },
              ] as const
            ).map((item) => {
              const isActive = defaultPlaybackContext === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDefaultPlaybackContext(item.value)}
                  className={`inline-flex items-center gap-[5px] rounded-md px-[18px] py-[8px] text-[14px] leading-none border-0 cursor-pointer ${
                    isActive
                      ? "bg-border-alpha-14 text-text-primary shadow-sm"
                      : "bg-transparent text-text-secondary hover:text-text-primary"
                  }`}
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Anonymous Telemetry & Diagnostics (Opt-in) */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px] max-w-[500px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {currentLocale === "ru"
              ? "Анонимная диагностика и телеметрия"
              : currentLocale === "uk"
                ? "Анонімна діагностика та телеметрія"
                : "Anonymous Telemetry & Diagnostics"}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0 leading-relaxed">
            {currentLocale === "ru"
              ? "Помогает находить и устранять сбои плеера, буферизации и сети. Не собирает персональные данные, пароли, токены или локальные пути к файлам."
              : currentLocale === "uk"
                ? "Допомагає знаходити та усувати збої плеєра, буферизації та мережі. Не збирає персональні дані, паролі, токени або локальні шляхи до файлів."
                : "Helps identify and fix playback errors, buffering stalls, and network issues. Never collects personal data, tokens, passwords, or local file paths."}
          </p>
        </div>

        <ToggleSwitch
          checked={telemetryOptIn}
          onChange={handleToggleTelemetry}
        />
      </div>

      {/* Cache Storage Section */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[6px] border-b border-border-primary pb-[16px]">
          <h2 className="text-text-primary text-[16px] font-medium m-0">
            {t("settings.cache.title")}
          </h2>
          <p className="text-text-secondary text-[14px] m-0">
            {t("settings.cache.description")}
          </p>
        </div>

        <div className="flex flex-col gap-[16px]">
          {/* Local Cache */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-[4px]">
              <h3 className="text-text-primary text-[15px] font-medium m-0">
                {t("settings.cache.local_cache.title")}
              </h3>
              <p className="text-text-tertiary text-[13px] m-0">
                {t("settings.cache.local_cache.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await clearMediaAndCoverCache();
                  toast(t("settings.cache.local_cache.success"), "success");
                } catch {
                  toast(t("settings.cache.local_cache.error"), "error");
                }
              }}
              className="inline-flex items-center gap-[6px] rounded-md px-[14px] py-[7px] text-[13px] font-medium bg-border-alpha-14 text-text-primary hover:bg-border-alpha-24 transition-colors border-0 cursor-pointer active:scale-[0.98]"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {t("settings.cache.local_cache.button")}
            </button>
          </div>

          {/* Search Cache */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-[4px]">
              <h3 className="text-text-primary text-[15px] font-medium m-0">
                {t("settings.cache.search_cache.title")}
              </h3>
              <p className="text-text-tertiary text-[13px] m-0">
                {t("settings.cache.search_cache.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await clearSearchAndQueryCache();
                  toast(t("settings.cache.search_cache.success"), "success");
                } catch {
                  toast(t("settings.cache.search_cache.error"), "error");
                }
              }}
              className="inline-flex items-center gap-[6px] rounded-md px-[14px] py-[7px] text-[13px] font-medium bg-border-alpha-14 text-text-primary hover:bg-border-alpha-24 transition-colors border-0 cursor-pointer active:scale-[0.98]"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {t("settings.cache.search_cache.button")}
            </button>
          </div>
        </div>
      </div>

      {/* Connection Diagnostics Section */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[6px] border-b border-border-primary pb-[16px]">
          <h2 className="text-text-primary text-[16px] font-medium m-0">
            {t("settings.connection.title")}
          </h2>
          <p className="text-text-secondary text-[14px] m-0">
            {t("settings.connection.description")}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-[4px]">
            <h3 className="text-text-primary text-[15px] font-medium m-0">
              {t("settings.connection.checks_title")}
            </h3>
            <p className="text-text-tertiary text-[13px] m-0">
              {connChecks.length > 0 && connLastRunAt
                ? t("settings.connection.last_run", {
                    ok: connChecks.filter((c) => c.status === "ok").length,
                    total: connChecks.length,
                    time: new Date(connLastRunAt).toLocaleTimeString(),
                  })
                : t("settings.connection.never_run")}
            </p>
          </div>
          <div className="flex items-center gap-[8px]">
            {dumpExported && (
              <button
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
                className="inline-flex items-center justify-center h-[34px] w-[34px] rounded-md bg-border-alpha-14 text-text-primary hover:bg-border-alpha-24 transition-colors border-0 cursor-pointer active:scale-[0.96]"
              >
                <FolderOpenLine size={18} />
              </button>
            )}
            <button
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
              className="inline-flex items-center gap-[6px] rounded-md px-[14px] py-[7px] text-[13px] font-medium bg-border-alpha-14 text-text-primary hover:bg-border-alpha-24 transition-colors border-0 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-default"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {connRunning
                ? t("settings.connection.checking")
                : t("settings.connection.button")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
