import { useState } from "react";
import {
  useAiTranslateStore,
  translateSongLyrics,
  type AiProvider,
} from "@/features/ai-translate";
import { SettingBlock, SegmentedControl } from "../controls";
import { showToast } from "@/shared/ui";

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "gemini", label: "Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai_compatible", label: "OpenAI Compatible" },
  { value: "google_translate", label: "Free (Google)" },
];

function getPlaceholder(p: AiProvider): string {
  if (p === "gemini") return "Default: gemini-2.5-flash (e.g. gemini-2.5-pro, gemini-2.0-flash)";
  if (p === "openai") return "Default: gpt-4o-mini (e.g. gpt-4o, o3-mini)";
  if (p === "deepseek") return "Default: deepseek-chat (e.g. deepseek-reasoner)";
  if (p === "openai_compatible") return "e.g. meta-llama/llama-3.3-70b-instruct, qwen-2.5-72b";
  return "Model name...";
}

export function AiTabModelConfig() {
  const { provider, setProvider, apiKey, setApiKey, baseUrl, setBaseUrl, model, setModel, singableMode, targetLang, clearCache } = useAiTranslateStore();
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
      setTestResult(res?.[0] ?? "Translation error, please check your key.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTestResult(`Error: ${message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SettingBlock title="AI Provider Configuration" description="Select the AI engine for song lyric translations and pronunciations">
      <div className="flex flex-col gap-3.5 pt-1">
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
                <label htmlFor="ai-settings-endpoint" className="text-xs font-medium text-white/80">Endpoint Base URL:</label>
                <input
                  id="ai-settings-endpoint"
                  type="text"
                  placeholder="https://api.openai.com/v1 (or OpenRouter, Groq, Ollama...)"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/30"
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ai-settings-api-key" className="text-xs font-medium text-white/80">API Key ({provider.toUpperCase()}):</label>
              <div className="flex items-center gap-2">
                <input
                  id="ai-settings-api-key"
                  type="password"
                  placeholder={`Enter ${provider.toUpperCase()} API key...`}
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
              <label htmlFor="ai-settings-model" className="text-xs font-medium text-white/80">Custom Model ID:</label>
              <input
                id="ai-settings-model"
                type="text"
                placeholder={getPlaceholder(provider)}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-sm text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/30"
              />
            </div>
            {testResult && (
              <div className="text-xs text-white/90 bg-white/[0.06] p-2.5 rounded-lg border border-white/10 leading-relaxed">
                <span className="font-semibold text-white">Test result:</span> {testResult}
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-white/90">Clear Translation Cache</span>
                <span className="text-[11px] text-text-secondary">Purge cached lyrics to re-translate</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearCache();
                  showToast.success("Translation cache cleared!");
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
  );
}
