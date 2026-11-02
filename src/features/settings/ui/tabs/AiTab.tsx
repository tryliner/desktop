import { useAiTranslateStore } from "@/features/ai-translate";
import { SettingRow, SettingSection } from "../controls";
import { ToggleSwitch } from "@/shared/ui";
import { AiLanguageSelect } from "./AiLanguageSelect";
import { AiTabModelConfig } from "./AiTabModelConfig";

export function AiTab({ searchQuery }: { searchQuery?: string }) {
  const {
    showTranslation,
    setShowTranslation,
    singableMode,
    setSingableMode,
    showRomanization,
    setShowRomanization,
    targetLang,
    setTargetLang,
  } = useAiTranslateStore();

  return (
    <SettingSection>
      <SettingRow
        title="Bilingual Lyrics Translation"
        description="Display line-by-line translated lyrics under original subtitles in Fullscreen player"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={showTranslation}
            onChange={setShowTranslation}
          />
        }
      />

      <SettingRow
        title="Singable Translation (Lyric Adaptation)"
        description="Adapt lyrics to match original syllable count, cadence, and poetic rhymes so they can be sung naturally to the melody"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={singableMode}
            onChange={setSingableMode}
          />
        }
      />

      <SettingRow
        title="Show Pronunciation Guide"
        description="Display Romaji, Pinyin, or phonetic pronunciation under non-Latin song lines"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={showRomanization}
            onChange={setShowRomanization}
          />
        }
      />

      <SettingRow
        title="Target Language"
        description="Select the language for bilingual subtitles and singable adaptation"
        searchQuery={searchQuery}
        control={
          <AiLanguageSelect
            value={targetLang}
            onChange={setTargetLang}
          />
        }
      />

      <AiTabModelConfig />
    </SettingSection>
  );
}
