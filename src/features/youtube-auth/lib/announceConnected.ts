import { createTranslatorSync, getStoredLocale } from "@/languages";
import { showToast } from "@/shared/ui";
import { fetchYoutubeAccount } from "@/shared/youtube";

function translate(key: string, fallback: string): string {
  const value = createTranslatorSync(getStoredLocale())(key);
  return value && value !== key ? value : fallback;
}

export async function announceYoutubeConnected(): Promise<void> {
  const account = await fetchYoutubeAccount().catch(() => null);
  const title = translate("youtube_auth.connected", "YouTube connected");
  const description = account
    ? [account.name, account.email].filter(Boolean).join(" · ")
    : undefined;
  showToast(title, "checkmark", description ? { description } : undefined);
}
