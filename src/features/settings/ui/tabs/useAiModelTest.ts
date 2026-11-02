import { useState, useRef, useEffect } from "react";
import { useAiTranslateStore, translateSongLyrics } from "@/features/ai-translate";

export function useAiModelTest() {
  const { provider, apiKey, baseUrl, model, singableMode, targetLang } =
    useAiTranslateStore();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const testIdRef = useRef(0);
  const prevTargetLangRef = useRef(targetLang);
  const prevSingableModeRef = useRef(singableMode);

  const invalidateTest = () => {
    testIdRef.current++;
    setTesting(false);
    setTestResult(null);
  };

  useEffect(() => {
    if (
      prevTargetLangRef.current !== targetLang ||
      prevSingableModeRef.current !== singableMode
    ) {
      prevTargetLangRef.current = targetLang;
      prevSingableModeRef.current = singableMode;
      invalidateTest();
    }
  }, [targetLang, singableMode]);

  const handleTest = async () => {
    const currentId = ++testIdRef.current;
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
      if (testIdRef.current === currentId) {
        setTestResult(res?.[0] ?? "Translation error, please check your key.");
      }
    } catch (err: unknown) {
      if (testIdRef.current === currentId) {
        const message = err instanceof Error ? err.message : String(err);
        setTestResult(`Error: ${message}`);
      }
    } finally {
      if (testIdRef.current === currentId) setTesting(false);
    }
  };

  return { testResult, testing, handleTest, invalidateTest };
}
