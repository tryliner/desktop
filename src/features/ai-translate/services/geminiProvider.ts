import {
  SONG_TRANSLATION_SYSTEM_PROMPT,
  SONG_ROMANIZATION_SYSTEM_PROMPT,
} from "../prompts";
import { matchLineCount } from "./lineMatching";

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const REQUEST_TIMEOUT_MS = 60_000;

async function callGeminiApi(
  prompt: string,
  apiKey: string,
  customModel?: string,
): Promise<string> {
  const cleanKey = apiKey.trim();
  const trimmedCustom = customModel?.trim();
  const modelsToTry = trimmedCustom ? [trimmedCustom] : DEFAULT_GEMINI_MODELS;

  let lastError: Error | null = null;
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${model}: ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Empty response from Gemini model ${model}`);
      }
      return text;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError =
        error.name === "TimeoutError" || error.message.toLowerCase().includes("timeout")
          ? new Error(`Gemini request timed out (${REQUEST_TIMEOUT_MS / 1000}s). Please retry.`)
          : error;
      if (
        lastError.message.includes("API_KEY_INVALID") ||
        lastError.message.includes("PERMISSION_DENIED")
      ) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}

export async function translateWithGemini(
  lines: string[],
  apiKey: string,
  targetLang: string,
  customModel?: string,
  singable = false,
): Promise<string[]> {
  const systemPrompt = SONG_TRANSLATION_SYSTEM_PROMPT("auto", targetLang, singable);
  const prompt = `${systemPrompt}\n\nSong lyrics:\n${lines.join("\n")}`;
  const text = await callGeminiApi(prompt, apiKey, customModel);
  const translatedLines = text.split("\n").map((l: string) => l.trim());
  return matchLineCount(translatedLines, lines);
}

export async function romanizeWithGemini(
  lines: string[],
  apiKey: string,
  customModel?: string,
): Promise<string[]> {
  const prompt = `${SONG_ROMANIZATION_SYSTEM_PROMPT}\n\nSong lyrics:\n${lines.join("\n")}`;
  const text = await callGeminiApi(prompt, apiKey, customModel);
  const romanizedLines = text.split("\n").map((l: string) => l.trim());
  return matchLineCount(romanizedLines, lines);
}
