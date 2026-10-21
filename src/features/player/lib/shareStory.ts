import { showToast } from "@/shared/ui";
import { shareTrackAsStory, type StoryTrack } from "@/shared/media/storyCard";
import type { TFunction } from "@/languages";

/** makes the story picture for a track and tells the user how it went (menu item and player bar button) */
export async function shareStoryWithToast(track: StoryTrack, t: TFunction): Promise<void> {
  try {
    const { copied } = await shareTrackAsStory(track);
    showToast(copied ? t("common.story_saved_copied") : t("common.story_saved"), "checkmark", {
      description: t("common.story_hint"),
    });
  } catch {
    showToast(t("common.story_failed"), "error");
  }
}
