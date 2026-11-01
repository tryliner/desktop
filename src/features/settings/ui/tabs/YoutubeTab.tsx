import {
  PlayCircleFill,
  Playlist2Fill,
  UserQuestionFill,
} from "@mingcute/react";
import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui";
import { useYoutubePreferences } from "@/shared/youtube";
import { YoutubeAccountCard } from "@/features/youtube-auth";
import { SettingRow, SettingSection } from "../controls";

export function YoutubeTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const accountPlayback = useYoutubePreferences((s) => s.accountPlayback);
  const setAccountPlayback = useYoutubePreferences((s) => s.setAccountPlayback);
  const promptSignIn = useYoutubePreferences((s) => s.promptSignIn);
  const setPromptSignIn = useYoutubePreferences((s) => s.setPromptSignIn);
  const syncLibrary = useYoutubePreferences((s) => s.syncLibrary);
  const setSyncLibrary = useYoutubePreferences((s) => s.setSyncLibrary);

  return (
    <div className="flex flex-col gap-[28px]">
      {!searchQuery?.trim() && <YoutubeAccountCard />}
      <SettingSection
        label={t("settings.youtube.section_playback") || "Playback"}
      >
        <SettingRow
          title={
            t("settings.youtube.account_playback.title") ||
            "Play through your account"
          }
          description={
            t("settings.youtube.account_playback.description") ||
            "Request YouTube audio with your signed-in account so streams are not blocked."
          }
          explained
          icon={<PlayCircleFill size={20} />}
          titleKey="settings.youtube.account_playback.title"
          descKey="settings.youtube.account_playback.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={accountPlayback}
              onChange={setAccountPlayback}
            />
          }
        />
        <SettingRow
          title={t("settings.youtube.prompt_sign_in.title") || "Ask to sign in"}
          description={
            t("settings.youtube.prompt_sign_in.description") ||
            "Show the sign-in card when YouTube blocks playback instead of skipping the track."
          }
          explained
          icon={<UserQuestionFill size={20} />}
          titleKey="settings.youtube.prompt_sign_in.title"
          descKey="settings.youtube.prompt_sign_in.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch checked={promptSignIn} onChange={setPromptSignIn} />
          }
        />
        <SettingRow
          title={t("settings.youtube.sync_library.title") || "Sync library"}
          description={
            t("settings.youtube.sync_library.description") ||
            "Show playlists from your YouTube account in the library next to Liner playlists."
          }
          icon={<Playlist2Fill size={20} />}
          titleKey="settings.youtube.sync_library.title"
          descKey="settings.youtube.sync_library.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch checked={syncLibrary} onChange={setSyncLibrary} />
          }
        />
      </SettingSection>
    </div>
  );
}
