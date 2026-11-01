import { useState } from "react";
import { CloudFill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { Button, TextInput, ToggleSwitch, showToast } from "@/shared/ui";
import { SettingBlock, SettingRow, SettingSection } from "@/features/settings/ui/controls";
import { useListenBrainzStore } from "../store/listenBrainzStore";
import { validateListenBrainzToken } from "../lib/client";

export default function ListenBrainzTab({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const enabled = useListenBrainzStore((state) => state.enabled);
  const token = useListenBrainzStore((state) => state.token);
  const username = useListenBrainzStore((state) => state.username);
  const setEnabled = useListenBrainzStore((state) => state.setEnabled);
  const connect = useListenBrainzStore((state) => state.connect);
  const disconnect = useListenBrainzStore((state) => state.disconnect);

  const [draft, setDraft] = useState(token);
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    const value = draft.trim();
    if (!value) {
      showToast(t("settings.listenbrainz.token_required"), "error");
      return;
    }
    setBusy(true);
    const result = await validateListenBrainzToken(value);
    setBusy(false);
    if (!result.username) {
      showToast(result.error || t("settings.listenbrainz.invalid_token"), "error");
      return;
    }
    connect(value, result.username);
    setDraft(value);
    showToast(
      t("settings.listenbrainz.connected_toast", { user: result.username }),
      "success",
    );
  };

  const handleDisconnect = () => {
    disconnect();
    setDraft("");
    showToast(t("settings.listenbrainz.disconnected_toast"), "info");
  };

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.listenbrainz.title")}
        description={t("settings.listenbrainz.description")}
        icon={<CloudFill size={18} />}
        explained
        titleKey="settings.listenbrainz.title"
        descKey="settings.listenbrainz.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={enabled}
            disabled={!username}
            onChange={setEnabled}
          />
        }
      />

      <SettingBlock
        title={t("settings.listenbrainz.account_title")}
        description={
          username
            ? t("settings.listenbrainz.connected_as", { user: username })
            : t("settings.listenbrainz.account_description")
        }
        titleKey="settings.listenbrainz.account_title"
        descKey="settings.listenbrainz.account_description"
        searchQuery={searchQuery}
      >
        <div className="flex flex-col gap-[8px] sm:flex-row">
          <TextInput
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("settings.listenbrainz.token_placeholder")}
            size="sm"
            className="min-w-0 flex-1"
          />
          <div className="flex shrink-0 items-center gap-[8px]">
            <Button
              variant="secondary"
              size="default"
              type="button"
              disabled={busy}
              onClick={() => void handleConnect()}
              className="!h-[36px] px-[14px] text-[12.5px]"
            >
              {busy
                ? t("settings.listenbrainz.connecting")
                : username
                  ? t("settings.listenbrainz.reconnect")
                  : t("settings.listenbrainz.connect")}
            </Button>
            {username ? (
              <Button
                variant="secondary"
                size="default"
                type="button"
                onClick={handleDisconnect}
                className="!h-[36px] px-[14px] text-[12.5px]"
              >
                {t("settings.listenbrainz.disconnect")}
              </Button>
            ) : null}
          </div>
        </div>
      </SettingBlock>
    </SettingSection>
  );
}
