import { useEffect, useState } from "react";
import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui";
import Button from "@/shared/ui/Button";
import type { LastfmStatus } from "@/features/lastfm/contracts";
import { SettingBlock, SettingRow, SettingSection } from "../controls";

export function LastfmTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const bridge = window.linerElectron?.lastfm;
  const [status, setStatus] = useState<LastfmStatus>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [custom, setCustom] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    let changed = false;
    const unsubscribe = bridge.onChange((next) => {
      changed = true;
      if (active) setStatus(next);
    });
    void bridge
      .status()
      .then((next) => {
        if (active && !changed) setStatus(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);

  async function run(action: () => Promise<LastfmStatus>) {
    setBusy(true);
    setFailed(false);
    try {
      setStatus(await action());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!bridge) return <p>{t("settings.lastfm.unavailable")}</p>;
  const needsCredentials = custom || status?.configured === false;
  const inputClass =
    "w-full rounded-md border border-border-alpha-14 bg-transparent px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2";

  return (
    <div className="flex flex-col gap-[18px]">
      <SettingSection>
        <SettingBlock
          title={t("settings.lastfm.account")}
          description={t("settings.lastfm.privacy")}
          titleKey="settings.lastfm.account"
          descKey="settings.lastfm.privacy"
          searchQuery={searchQuery}
        >
          <p
            className="text-text-secondary text-sm"
            role="status"
            aria-live="polite"
          >
            {status?.connected
              ? t("settings.lastfm.connected", {
                  username: status.username ?? "",
                })
              : t("settings.lastfm.disconnected")}
          </p>
          {status?.authorizing ? (
            <>
              <p className="text-text-secondary text-sm">
                {t("settings.lastfm.authorize_help")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => bridge.finish())}
                >
                  {t("settings.lastfm.finish")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void run(() => bridge.cancel())}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </>
          ) : (
            <>
              {needsCredentials && (
                <div className="flex flex-col gap-3">
                  <p className="text-text-secondary text-sm">
                    {t("settings.lastfm.credentials_help")}{" "}
                    <a
                      className="underline"
                      href="https://www.last.fm/api/account/create"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("settings.lastfm.create_key")}
                    </a>
                  </p>
                  <label className="text-sm text-text-primary">
                    {t("settings.lastfm.api_key")}
                    <input
                      className={inputClass}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value.trim())}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={32}
                    />
                  </label>
                  <label className="text-sm text-text-primary">
                    {t("settings.lastfm.api_secret")}
                    <input
                      className={inputClass}
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value.trim())}
                      autoComplete="off"
                      maxLength={32}
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={
                    busy ||
                    !status ||
                    (needsCredentials &&
                      (!/^[a-f\d]{32}$/i.test(apiKey) ||
                        !/^[a-f\d]{32}$/i.test(secret)))
                  }
                  onClick={() => {
                    const credentials = needsCredentials
                      ? { apiKey, secret }
                      : undefined;
                    setSecret("");
                    void run(() => bridge.connect(credentials));
                  }}
                >
                  {t(
                    status?.connected || status?.username
                      ? "settings.lastfm.reconnect"
                      : "settings.lastfm.connect",
                  )}
                </Button>
                {status?.connected ||
                status?.username ||
                status?.pending ||
                status?.error === "storage_unreadable" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void run(() => bridge.disconnect())}
                  >
                    {t("settings.lastfm.disconnect")}
                  </Button>
                ) : null}
                {status?.configured && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-pressed={custom}
                    onClick={() => setCustom(!custom)}
                  >
                    {t("settings.lastfm.custom_credentials")}
                  </Button>
                )}
              </div>
            </>
          )}
          {status?.sessionOnly && (
            <p className="text-text-secondary text-sm">
              {t("settings.lastfm.session_only")}
            </p>
          )}
          {(failed || status?.error) && (
            <p role="alert" className="text-text-secondary text-sm">
              {t(
                `settings.lastfm.errors.${failed ? "request_failed" : status?.error}`,
              )}
            </p>
          )}
          <p className="text-text-tertiary text-xs">
            {t("settings.lastfm.disconnect_help")}
          </p>
        </SettingBlock>
        <SettingRow
          title={t("settings.lastfm.enable.title")}
          description={t("settings.lastfm.enable.description")}
          explained
          titleKey="settings.lastfm.enable.title"
          descKey="settings.lastfm.enable.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              ariaLabel={t("settings.lastfm.enable.title")}
              checked={status?.enabled ?? false}
              disabled={busy || !status?.connected}
              onChange={(enabled) =>
                void run(() => bridge.settings({ enabled }))
              }
            />
          }
        />
        <SettingRow
          title={t("settings.lastfm.now_playing.title")}
          description={t("settings.lastfm.now_playing.description")}
          explained
          titleKey="settings.lastfm.now_playing.title"
          descKey="settings.lastfm.now_playing.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              ariaLabel={t("settings.lastfm.now_playing.title")}
              checked={status?.nowPlaying ?? true}
              disabled={busy || !status?.connected}
              onChange={(nowPlaying) =>
                void run(() => bridge.settings({ nowPlaying }))
              }
            />
          }
        />
        <SettingRow
          title={t("settings.lastfm.queue", { count: status?.pending ?? 0 })}
          titleKey="settings.lastfm.queue"
          searchQuery={searchQuery}
          control={
            <Button
              size="sm"
              variant="secondary"
              disabled={
                busy || !status?.connected || !status.enabled || !status.pending
              }
              onClick={() => void run(() => bridge.retry())}
            >
              {t("settings.lastfm.retry")}
            </Button>
          }
        />
      </SettingSection>
    </div>
  );
}
