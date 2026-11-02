import type { TranslationConfig } from "../types";
import { dropUnchangedRomanization } from "./lineMatching";
import {
  translateWithGemini,
  romanizeWithGemini,
} from "./geminiProvider";
import {
  translateWithClaude,
  romanizeWithClaude,
} from "./claudeProvider";
import {
  translateWithOpenAI,
  romanizeWithOpenAI,
  translateWithDeepSeek,
  romanizeWithDeepSeek,
  translateWithOpenRouter,
  romanizeWithOpenRouter,
  translateWithOpenAiCompatible,
  romanizeWithOpenAiCompatible,
} from "./openAiProvider";
import {
  translateWithOllama,
  romanizeWithOllama,
} from "./ollamaProvider";
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
  if (provider === "claude") {
    if (!apiKey?.trim()) throw new Error("API key is required for Claude");
    return translateWithClaude(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "openai") {
    if (!apiKey?.trim()) throw new Error("API key is required for OpenAI");
    return translateWithOpenAI(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "deepseek") {
    if (!apiKey?.trim()) throw new Error("API key is required for DeepSeek");
    return translateWithDeepSeek(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "openrouter") {
    if (!apiKey?.trim()) throw new Error("API key is required for OpenRouter");
    return translateWithOpenRouter(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "ollama") {
    return translateWithOllama(lines, apiKey, targetLang, baseUrl, model, singableMode);
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
  } else if (provider === "claude") {
    if (!apiKey?.trim()) throw new Error("API key is required for Claude");
    result = await romanizeWithClaude(lines, apiKey, model);
  } else if (provider === "openai") {
    if (!apiKey?.trim()) throw new Error("API key is required for OpenAI");
    result = await romanizeWithOpenAI(lines, apiKey, model);
  } else if (provider === "deepseek") {
    if (!apiKey?.trim()) throw new Error("API key is required for DeepSeek");
    result = await romanizeWithDeepSeek(lines, apiKey, model);
  } else if (provider === "openrouter") {
    if (!apiKey?.trim()) throw new Error("API key is required for OpenRouter");
    result = await romanizeWithOpenRouter(lines, apiKey, model);
  } else if (provider === "ollama") {
    result = await romanizeWithOllama(lines, apiKey, baseUrl, model);
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
