import { useState } from "react";
import {
  useAiTranslateStore,
  translateSongLyrics,
  type AiProvider,
} from "@/features/ai-translate";
import { SettingRow, SettingSection, SettingBlock, SegmentedControl } from "../controls";
import { ToggleSwitch, showToast } from "@/shared/ui";

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "gemini", label: "Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai_compatible", label: "OpenAI Compatible" },
  { value: "google_translate", label: "Free (Google)" },
];

const TARGET_LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "vi", label: "Vietnamese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

function getModelPlaceholder(provider: AiProvider): string {
  switch (provider) {
    case "gemini":
      return "Default: gemini-2.5-flash (e.g. gemini-2.5-pro, gemini-2.0-flash...)";
    case "openai":
      return "Default: gpt-4o-mini (e.g. gpt-4o, gpt-4.5-preview, o3-mini...)";
    case "deepseek":
      return "Default: deepseek-chat (e.g. deepseek-reasoner...)";
    case "openai_compatible":
      return "e.g. meta-llama/llama-3.3-70b-instruct, qwen-2.5-72b...";
    default:
      return "Model name...";
  }
}

function getModelHint(provider: AiProvider): string {
  switch (provider) {
    case "gemini":
      return "Supports advanced models like gemini-2.5-pro for high-fidelity literary lyrics translation.";
    case "openai":
      return "Choose models like gpt-4o for expressive, musically coherent lyrics adaptation.";
    case "deepseek":
      return "Supports deepseek-chat or deepseek-reasoner for deep musical context reasoning.";
    case "openai_compatible":
      return "Compatible with OpenRouter, Groq, Together AI, vLLM, or local Ollama.";
    default:
      return "";
  }
}

export function AiTab({ searchQuery }: { searchQuery?: string }) {
  const provider = useAiTranslateStore((s) => s.provider);
  const setProvider = useAiTranslateStore((s) => s.setProvider);
  const apiKey = useAiTranslateStore((s) => s.apiKey);
  const setApiKey = useAiTranslateStore((s) => s.setApiKey);
  const baseUrl = useAiTranslateStore((s) => s.baseUrl);
  const setBaseUrl = useAiTranslateStore((s) => s.setBaseUrl);
  const model = useAiTranslateStore((s) => s.model);
  const setModel = useAiTranslateStore((s) => s.setModel);
  const singableMode = useAiTranslateStore((s) => s.singableMode);
  const setSingableMode = useAiTranslateStore((s) => s.setSingableMode);
  const targetLang = useAiTranslateStore((s) => s.targetLang);
  const setTargetLang = useAiTranslateStore((s) => s.setTargetLang);
  const showTranslation = useAiTranslateStore((s) => s.showTranslation);
  const setShowTranslation = useAiTranslateStore((s) => s.setShowTranslation);
  const showRomanization = useAiTranslateStore((s) => s.showRomanization);
  const setShowRomanization = useAiTranslateStore((s) => s.setShowRomanization);
  const clearCache = useAiTranslateStore((s) => s.clearCache);

  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await translateSongLyrics(
        ["I'm walking on sunshine, and don't it feel good!"],
        {
          provider,
          apiKey: apiKey.trim() || undefined,
          targetLang,
          model: model.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          singableMode,
        },
      );
      if (res && res.length > 0) {
        setTestResult(res[0]);
      } else {
        setTestResult("Translation error, please check your API key and endpoint.");
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message || String(err)}`);
    } finally {
      setTesting(false);
    }
  };

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
        title="Show Pronunciation (Romanization)"
        description="Display Latin transliteration (Romaji/Pinyin) for Japanese, Chinese, and Korean songs"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={showRomanization}
            onChange={setShowRomanization}
          />
        }
      />

      <SettingRow
        title="Translation Language"
        description="Target language for translating lyrics"
        searchQuery={searchQuery}
        control={
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm border border-white/15 focus:outline-none focus:border-white/30"
          >
            {TARGET_LANG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
                {opt.label}
              </option>
            ))}
          </select>
        }
      />

      <SettingBlock
        title="AI Provider"
        description="Select your smart translation engine. Supports Gemini, OpenAI, DeepSeek, OpenAI Compatible, or Free (Google Translate)."
        searchQuery={searchQuery}
      >
        <div className="flex flex-col gap-4">
          <SegmentedControl
            ariaLabel="AI Provider"
            value={provider}
            onChange={(val) => setProvider(val as AiProvider)}
            options={PROVIDER_OPTIONS}
          />

          {provider !== "google_translate" && (
            <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
              {provider === "openai_compatible" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-white/80">
                    Endpoint Base URL:
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1 (or OpenRouter, Ollama, Groq...)"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/30"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/80">
                  API Key {provider === "openai_compatible" ? "(optional for local Ollama)" : `for ${provider.toUpperCase()}`}:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder={
                      provider === "openai_compatible"
                        ? "Bearer token or API key..."
                        : `Enter ${provider.toUpperCase()} API key...`
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/15 text-sm font-medium transition-colors disabled:opacity-50 text-white shrink-0 shadow-sm"
                  >
                    {testing ? "Testing..." : "Test"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/80">
                    Custom Model ID:
                  </label>
                  {model && (
                    <button
                      type="button"
                      onClick={() => setModel("")}
                      className="text-[11px] text-white/70 hover:text-white underline"
                    >
                      Use default
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={getModelPlaceholder(provider)}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/30"
                />
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  {getModelHint(provider)}
                </p>
              </div>

              {testResult && (
                <div className="text-xs text-white/90 bg-white/[0.06] p-2.5 rounded-lg border border-white/10 leading-relaxed">
                  <span className="font-semibold text-white">
                    {singableMode ? "Singable translation test result:" : "Test result:"}
                  </span>{" "}
                  {testResult}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/90">Clear Translation Cache</span>
                  <span className="text-[11px] text-text-secondary">Purge cached translations to re-translate with updated models or prompts</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearCache();
                    showToast.success("Translation cache cleared successfully!");
                  }}
                  className="px-2.5 py-1 rounded-md text-xs bg-white/10 hover:bg-white/15 text-white/80 transition-colors"
                >
                  Clear cache
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingBlock>
    </SettingSection>
  );
}
