import {
  SONG_TRANSLATION_SYSTEM_PROMPT,
  SONG_ROMANIZATION_SYSTEM_PROMPT,
} from "../prompts";
import { matchLineCount } from "./lineMatching";

async function callOpenAiChat(
  systemPrompt: string,
  userText: string,
  apiKey: string,
  model: string,
  baseUrl = "https://api.openai.com/v1",
): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const url = `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from AI service");
  }
  return text;
}

export async function translateWithOpenAiCompatible(
  lines: string[],
  apiKey: string,
  targetLang: string,
  baseUrl?: string,
  model?: string,
  singable = false,
): Promise<string[]> {
  const cleanBase = baseUrl?.trim();
  if (!cleanBase) {
    throw new Error("Base URL is required for OpenAI Compatible provider");
  }
  const prompt = SONG_TRANSLATION_SYSTEM_PROMPT("auto", targetLang, singable);
  const text = await callOpenAiChat(
    prompt,
    lines.join("\n"),
    apiKey,
    model || "gpt-4o-mini",
    cleanBase,
  );
  return matchLineCount(text.split("\n").map((l: string) => l.trim()), lines);
}

export async function romanizeWithOpenAiCompatible(
  lines: string[],
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<string[]> {
  const cleanBase = baseUrl?.trim();
  if (!cleanBase) {
    throw new Error("Base URL is required for OpenAI Compatible provider");
  }
  const text = await callOpenAiChat(
    SONG_ROMANIZATION_SYSTEM_PROMPT,
    lines.join("\n"),
    apiKey,
    model || "gpt-4o-mini",
    cleanBase,
  );
  return matchLineCount(text.split("\n").map((l: string) => l.trim()), lines);
}

export function translateWithOpenAI(
  lines: string[], apiKey: string, targetLang: string, model?: string, singable = false,
): Promise<string[]> {
  return translateWithOpenAiCompatible(lines, apiKey, targetLang, "https://api.openai.com/v1", model || "gpt-4o-mini", singable);
}

export function romanizeWithOpenAI(
  lines: string[], apiKey: string, model?: string,
): Promise<string[]> {
  return romanizeWithOpenAiCompatible(lines, apiKey, "https://api.openai.com/v1", model || "gpt-4o-mini");
}

export function translateWithDeepSeek(
  lines: string[], apiKey: string, targetLang: string, model?: string, singable = false,
): Promise<string[]> {
  return translateWithOpenAiCompatible(lines, apiKey, targetLang, "https://api.deepseek.com", model || "deepseek-chat", singable);
}

export function romanizeWithDeepSeek(
  lines: string[], apiKey: string, model?: string,
): Promise<string[]> {
  return romanizeWithOpenAiCompatible(lines, apiKey, "https://api.deepseek.com", model || "deepseek-chat");
}
