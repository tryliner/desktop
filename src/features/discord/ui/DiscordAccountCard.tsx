import { DiscordFill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { AccountCard } from "@/shared/ui";
import { AppImage } from "@/features/covers";
import { useDiscordStatus } from "../hooks/useDiscordStatus";
import { useDiscordSettingsStore } from "../store/discordSettingsStore";

export default function DiscordAccountCard() {
  const { t } = useTranslation();
  const { status, loading } = useDiscordStatus();
  const enabled = useDiscordSettingsStore((state) => state.enabled);

  const title = status.connected
    ? status.username || "Discord"
    : t("settings.discord.status.disconnected") || "Discord not connected";

  const connectedLabel = status.viaArrpc
    ? t("settings.discord.status.via_arrpc") || "Connected via arRPC"
    : t("settings.discord.status.ready") || "Ready";

  const subtitle = !enabled
    ? t("settings.discord.status.disabled") || "Disabled"
    : status.connected
      ? connectedLabel
      : t("settings.discord.status.waiting") || "Waiting for Discord";

  return (
    <AccountCard
      media={
        status.avatarUrl ? (
          <AppImage src={status.avatarUrl} alt="" fill />
        ) : undefined
      }
      placeholderIcon={<DiscordFill size={24} />}
      title={title}
      subtitle={subtitle}
      loading={loading}
    />
  );
}
