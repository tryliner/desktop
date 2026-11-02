import type { TranslationConfig } from "../types";
import { dropUnchangedRomanization } from "./lineMatching";
import {
  translateWithGemini,
  romanizeWithGemini,
} from "./geminiProvider";
import {
  translateWithOpenAI,
  romanizeWithOpenAI,
  translateWithDeepSeek,
  romanizeWithDeepSeek,
  translateWithOpenAiCompatible,
  romanizeWithOpenAiCompatible,
} from "./openAiProvider";
import {
  translateWithGoogleFree,
  romanizeWithGoogleFree,
} from "./googleFreeProvider";

export * from "../prompts";

export async function translateSongLyrics(
  lines: string[],
  config: TranslationConfig,
): Promise<string[]> {
  if (lines.length === 0) return [];

  const { provider, apiKey, targetLang, model, baseUrl, singableMode } = config;

  if (provider === "gemini") {
    if (!apiKey?.trim()) throw new Error("API key is required for Gemini");
    return translateWithGemini(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "openai") {
    if (!apiKey?.trim()) throw new Error("API key is required for OpenAI");
    return translateWithOpenAI(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "deepseek") {
    if (!apiKey?.trim()) throw new Error("API key is required for DeepSeek");
    return translateWithDeepSeek(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "openai_compatible") {
    return translateWithOpenAiCompatible(
      lines,
      apiKey || "",
      targetLang,
      baseUrl,
      model,
      singableMode,
    );
  }

  return translateWithGoogleFree(lines, targetLang);
}

export async function romanizeSongLyrics(
  lines: string[],
  config: TranslationConfig,
): Promise<string[]> {
  if (lines.length === 0) return [];

  const { provider, apiKey, model, baseUrl } = config;

  let result: string[];
  if (provider === "gemini") {
    if (!apiKey?.trim()) throw new Error("API key is required for Gemini");
    result = await romanizeWithGemini(lines, apiKey, model);
  } else if (provider === "openai") {
    if (!apiKey?.trim()) throw new Error("API key is required for OpenAI");
    result = await romanizeWithOpenAI(lines, apiKey, model);
  } else if (provider === "deepseek") {
    if (!apiKey?.trim()) throw new Error("API key is required for DeepSeek");
    result = await romanizeWithDeepSeek(lines, apiKey, model);
  } else if (provider === "openai_compatible") {
    result = await romanizeWithOpenAiCompatible(
      lines,
      apiKey || "",
      baseUrl,
      model,
    );
  } else {
    result = await romanizeWithGoogleFree(lines);
  }

  return dropUnchangedRomanization(result, lines);
}
