import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui/ToggleSwitch";
import { getLyricPronunciation } from "../engine/lyricsAnnotations";
import { useLyricsStore } from "../store/lyricsStore";

export function LyricsPronunciationToggle() {
  const { t } = useTranslation();
  const lyrics = useLyricsStore((s) => s.braccatoLyrics);
  const showPronunciation = useLyricsStore((s) => s.showPronunciation);
  const setShowPronunciation = useLyricsStore((s) => s.setShowPronunciation);
  const hasPronunciation = lyrics.some(
    (line) => getLyricPronunciation(line) || getLyricPronunciation(line, true),
  );
  if (!hasPronunciation) return null;

  const label = t("player.lyric_languages.pronunciation");

  return (
    <label
      data-keyboard-focus
      data-no-window-drag
      data-theme="dark"
      title={label}
      className="pointer-events-auto inline-flex h-8 items-center gap-2 rounded-lg bg-black/50 px-2 text-xs font-medium text-white/80 backdrop-blur-xl focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/80"
    >
      <span>{label}</span>
      <ToggleSwitch
        checked={showPronunciation}
        onChange={setShowPronunciation}
        ariaLabel={label}
      />
    </label>
  );
}
