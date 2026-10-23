import { SiApplemusic, SiDeezer, SiSoundcloud, SiSpotify, SiTidal, SiYoutubemusic } from "react-icons/si";
import { useSearchSourceStore } from "@/features/search/store/searchSourceStore";
import { ToggleSwitch, useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { SettingRow, SettingSection } from "../controls";

const COMING_SOON_MESSAGE = "Spotify, Apple Music, TIDAL, and Deezer are coming soon.";

export function SourcesTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const enabledSources = useSearchSourceStore((state) => state.enabledSources);
  const setSourceEnabled = useSearchSourceStore((state) => state.setSourceEnabled);

  const youtubeEnabled = enabledSources.includes("youtube");
  const soundcloudEnabled = enabledSources.includes("soundcloud");

  return (
    <div className="flex flex-col gap-[16px]">
      <SettingSection label={t("settings.sources.available_title")}>
        <SettingRow
          title={t("search.sources.youtube")}
          description={t("settings.sources.youtube_description")}
          titleKey="search.sources.youtube"
          descKey="settings.sources.youtube_description"
          searchQuery={searchQuery}
          control={(
            <div className="flex items-center gap-3">
              <SiYoutubemusic size={18} className="text-[#ff0033]" aria-hidden />
              <ToggleSwitch
                checked={youtubeEnabled}
                disabled={youtubeEnabled && enabledSources.length === 1}
                onChange={(enabled) => setSourceEnabled("youtube", enabled)}
                ariaLabel={t("settings.sources.enable_youtube") || "Enable YouTube Music"}
              />
            </div>
          )}
        />
        <SettingRow
          title={t("search.sources.soundcloud")}
          description={t("settings.sources.soundcloud_description")}
          titleKey="search.sources.soundcloud"
          descKey="settings.sources.soundcloud_description"
          searchQuery={searchQuery}
          control={(
            <div className="flex items-center gap-3">
              <SiSoundcloud size={18} className="text-[#ff5500]" aria-hidden />
              <ToggleSwitch
                checked={soundcloudEnabled}
                disabled={soundcloudEnabled && enabledSources.length === 1}
                onChange={(enabled) => setSourceEnabled("soundcloud", enabled)}
                ariaLabel={t("settings.sources.enable_soundcloud") || "Enable SoundCloud"}
              />
            </div>
          )}
        />
      </SettingSection>

      <SettingSection>
        <SettingRow
          title={t("search.sources.coming_soon") || "More sources coming soon"}
          description={t("settings.sources.coming_soon_description")}
          titleKey="search.sources.coming_soon"
          descKey="settings.sources.coming_soon_description"
          searchQuery={searchQuery}
          control={(
            <button
              type="button"
              aria-label={t("search.sources.coming_soon") || "More sources coming soon"}
              onClick={() => toast(t("search.sources.coming_soon_message") || COMING_SOON_MESSAGE, "info")}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-solid border-border-primary bg-border-alpha-10 px-3 py-2 text-text-tertiary transition-colors hover:bg-border-alpha-14 hover:text-text-secondary"
            >
              <SiSpotify size={13} aria-hidden />
              <SiApplemusic size={13} aria-hidden />
              <SiTidal size={13} aria-hidden />
              <SiDeezer size={13} aria-hidden />
              <span className="ml-1 text-[12px]">{t("settings.sources.coming_soon_button")}</span>
            </button>
          )}
        />
      </SettingSection>
    </div>
  );
}

export default SourcesTab;
