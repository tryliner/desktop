import { useState, useEffect } from "react";
import { useTranslation } from "@/languages";
import {
  useDiscordSettingsStore,
  DEFAULT_DISCORD_CLIENT_ID,
  type DiscordStatusDisplayType,
} from "@/features/discord";
import { ToggleSwitch, Button, TextInput, Select } from "@/shared/ui";
import { SettingRow, SettingSection } from "../controls";
import { Refresh1Line } from "@mingcute/react";

export function DiscordTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<{
    connected: boolean;
    username?: string;
  }>({ connected: false });

  const enabled = useDiscordSettingsStore((s) => s.enabled);
  const setEnabled = useDiscordSettingsStore((s) => s.setEnabled);

  const applicationId = useDiscordSettingsStore((s) => s.applicationId);
  const setApplicationId = useDiscordSettingsStore((s) => s.setApplicationId);
  const resetApplicationId = useDiscordSettingsStore((s) => s.resetApplicationId);

  const statusDisplayType = useDiscordSettingsStore((s) => s.statusDisplayType);
  const setStatusDisplayType = useDiscordSettingsStore((s) => s.setStatusDisplayType);

  const showTime = useDiscordSettingsStore((s) => s.showTime);
  const setShowTime = useDiscordSettingsStore((s) => s.setShowTime);

  const showArtwork = useDiscordSettingsStore((s) => s.showArtwork);
  const setShowArtwork = useDiscordSettingsStore((s) => s.setShowArtwork);

  const showArtistSmallImage = useDiscordSettingsStore((s) => s.showArtistSmallImage);
  const setShowArtistSmallImage = useDiscordSettingsStore((s) => s.setShowArtistSmallImage);

  const showPaused = useDiscordSettingsStore((s) => s.showPaused);
  const setShowPaused = useDiscordSettingsStore((s) => s.setShowPaused);

  const showButton = useDiscordSettingsStore((s) => s.showButton);
  const setShowButton = useDiscordSettingsStore((s) => s.setShowButton);

  const showDownloadButton = useDiscordSettingsStore((s) => s.showDownloadButton);
  const setShowDownloadButton = useDiscordSettingsStore((s) => s.setShowDownloadButton);

  useEffect(() => {
    setMounted(true);

    const checkStatus = () => {
      if (window.linerElectron?.getDiscordStatus) {
        window.linerElectron.getDiscordStatus().then((status) => {
          if (status) setDiscordStatus(status);
        });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const isCustomAppId = applicationId !== DEFAULT_DISCORD_CLIENT_ID;

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Discord Connection Status */}
      <div className="flex items-center justify-between px-[14px] py-[10px] rounded-lg bg-border-alpha-10">
        <div className="flex items-center gap-[10px]">
          <span
            className={`w-[8px] h-[8px] rounded-full shrink-0 ${
              discordStatus.connected
                ? "bg-[#23a55a] shadow-[0_0_8px_rgba(35,165,90,0.5)]"
                : "bg-text-tertiary/40"
            }`}
          />
          <span className="text-[13px] text-text-primary font-medium">
            {discordStatus.connected
              ? t("settings.discord.status.connected", {
                  user: discordStatus.username || "Discord",
                }) || `Connected to Discord (${discordStatus.username || "Active"})`
              : t("settings.discord.status.disconnected") || "Discord not connected"}
          </span>
        </div>
        <span className="text-[12px] text-text-tertiary font-mono">
          {enabled ? (discordStatus.connected ? "Ready" : "Waiting for Discord") : "Disabled"}
        </span>
      </div>

      {/* Main enable switch */}
      <SettingSection>
        <SettingRow
          title={t("settings.discord.enable.title") || "Discord Rich Presence"}
          description={
            t("settings.discord.enable.description") ||
            "Broadcast your active music playback to your Discord profile."
          }
          titleKey="settings.discord.enable.title"
          descKey="settings.discord.enable.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={enabled}
              onChange={setEnabled}
            />
          }
        />
      </SettingSection>

      {/* Display Options */}
      <SettingSection label={t("settings.discord.section_display") || "Display Options"}>
        {/* Status Line Format */}
        <SettingRow
          title={t("settings.discord.status_display.title") || "Status Format"}
          description={
            t("settings.discord.status_display.description") ||
            "Choose what appears in Discord's 'Listening to...' status header."
          }
          titleKey="settings.discord.status_display.title"
          descKey="settings.discord.status_display.description"
          searchQuery={searchQuery}
          control={
            mounted ? (
              <Select<DiscordStatusDisplayType>
                aria-label={t("settings.discord.status_display.title") || "Status Format"}
                className="w-[210px]"
                value={statusDisplayType}
                onChange={setStatusDisplayType}
                disabled={!enabled}
                options={[
                  {
                    value: "artist",
                    label: t("settings.discord.status_display.artist") || "Artist (Default)",
                  },
                  {
                    value: "title",
                    label: t("settings.discord.status_display.song") || "Song Title",
                  },
                  {
                    value: "artist_title",
                    label: t("settings.discord.status_display.artist_song") || "Artist - Song",
                  },
                  {
                    value: "title_artist",
                    label: t("settings.discord.status_display.song_artist") || "Song - Artist",
                  },
                  {
                    value: "app",
                    label: t("settings.discord.status_display.app") || "Liner (App name)",
                  },
                ]}
              />
            ) : (
              <span />
            )
          }
        />

        {/* Timeline progress bar */}
        <SettingRow
          title={t("settings.discord.show_timeline.title") || "Playback Timeline"}
          description={
            t("settings.discord.show_timeline.description") ||
            "Display interactive progress bar with elapsed and remaining track time."
          }
          titleKey="settings.discord.show_timeline.title"
          descKey="settings.discord.show_timeline.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={showTime}
              onChange={setShowTime}
              disabled={!enabled}
            />
          }
        />

        {/* Track artwork */}
        <SettingRow
          title={t("settings.discord.show_artwork.title") || "Track Artwork"}
          description={
            t("settings.discord.show_artwork.description") ||
            "Show track or album cover in the Discord activity card."
          }
          titleKey="settings.discord.show_artwork.title"
          descKey="settings.discord.show_artwork.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={showArtwork}
              onChange={setShowArtwork}
              disabled={!enabled}
            />
          }
        />

        {/* Artist small image */}
        <SettingRow
          title={t("settings.discord.show_artist_image.title") || "Artist Photo Badge"}
          description={
            t("settings.discord.show_artist_image.description") ||
            "Display the artist photo in a small circular badge on the bottom corner."
          }
          titleKey="settings.discord.show_artist_image.title"
          descKey="settings.discord.show_artist_image.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={showArtistSmallImage}
              onChange={setShowArtistSmallImage}
              disabled={!enabled}
            />
          }
        />

        {/* Show when paused */}
        <SettingRow
          title={t("settings.discord.show_paused.title") || "Show when Paused"}
          description={
            t("settings.discord.show_paused.description") ||
            "Keep status visible on Discord with a paused indicator when music is paused."
          }
          titleKey="settings.discord.show_paused.title"
          descKey="settings.discord.show_paused.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={showPaused}
              onChange={setShowPaused}
              disabled={!enabled}
            />
          }
        />
      </SettingSection>

      {/* Profile Buttons */}
      <SettingSection label={t("settings.discord.section_buttons") || "Profile Buttons"}>
        {/* Listen on Liner button */}
        <SettingRow
          title={t("settings.discord.show_button.title") || "'Listen on Liner' Button"}
          description={
            t("settings.discord.show_button.description") ||
            "Add an interactive button linking to the song on Liner."
          }
          titleKey="settings.discord.show_button.title"
          descKey="settings.discord.show_button.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={showButton}
              onChange={setShowButton}
              disabled={!enabled}
            />
          }
        />

        {/* Download Liner button */}
        <SettingRow
          title={t("settings.discord.show_download_button.title") || "'Download Liner' Button"}
          description={
            t("settings.discord.show_download_button.description") ||
            "Add an interactive button linking to tryliner.fun to download the app."
          }
          titleKey="settings.discord.show_download_button.title"
          descKey="settings.discord.show_download_button.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={showDownloadButton}
              onChange={setShowDownloadButton}
              disabled={!enabled}
            />
          }
        />
      </SettingSection>

      {/* Custom Application ID */}
      <SettingSection label={t("settings.discord.section_advanced") || "Advanced"}>
        <div className="flex flex-col gap-2 py-[13px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-[2px] min-w-0 max-w-[380px]">
              <span className="text-[13px] font-[500] text-text-primary">
                {t("settings.discord.client_id.title") || "Discord Application ID"}
              </span>
              <span className="text-[12.5px] text-text-tertiary leading-relaxed">
                {t("settings.discord.client_id.description") ||
                  "Configure a custom Discord Client ID created in Discord Developer Portal to customize the app title."}
              </span>
            </div>
            {isCustomAppId && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetApplicationId}
              >
                <Refresh1Line size={13} />
                <span>{t("settings.discord.client_id.reset") || "Reset"}</span>
              </Button>
            )}
          </div>
          <div className="w-full max-w-[420px] pt-1">
            <TextInput
              size="sm"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              placeholder={DEFAULT_DISCORD_CLIENT_ID}
              disabled={!enabled}
            />
          </div>
        </div>
      </SettingSection>
    </div>
  );
}
