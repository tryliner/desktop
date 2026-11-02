import { useAiTranslateStore } from "@/features/ai-translate";
import { SettingRow, SettingSection, SegmentedControl } from "../controls";
import { ToggleSwitch } from "@/shared/ui";
import { AiTabModelConfig } from "./AiTabModelConfig";

const TARGET_LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "vi", label: "Vietnamese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

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
          <SegmentedControl
            ariaLabel="Target Language"
            value={targetLang}
            onChange={setTargetLang}
            options={TARGET_LANG_OPTIONS}
          />
        }
      />

      <AiTabModelConfig />
    </SettingSection>
  );
}
