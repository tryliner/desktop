import { useAiTranslateStore } from "@/features/ai-translate";
import { SettingBlock } from "../controls";
import { AiProviderCards } from "./AiProviderCards";
import { AiTabModelInputs } from "./AiTabModelInputs";
import { useAiModelTest } from "./useAiModelTest";

export function AiTabModelConfig() {
  const { provider, setProvider } = useAiTranslateStore();
  const { testResult, testing, handleTest, invalidateTest } = useAiModelTest();

  return (
    <SettingBlock
      title="AI Provider Configuration"
      description="Select the AI engine for song lyric translations and pronunciations"
    >
      <div className="flex flex-col gap-3.5 pt-1">
        <AiProviderCards
          value={provider}
          onChange={(val) => {
            invalidateTest();
            setProvider(val);
          }}
        />

        {provider !== "google_translate" && (
          <AiTabModelInputs
            testResult={testResult}
            testing={testing}
            onTest={handleTest}
            onInvalidate={invalidateTest}
          />
        )}
      </div>
    </SettingBlock>
  );
}
