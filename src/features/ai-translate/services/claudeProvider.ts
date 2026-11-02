import {
  SONG_TRANSLATION_SYSTEM_PROMPT,
  SONG_ROMANIZATION_SYSTEM_PROMPT,
} from "../prompts";
import { matchLineCount } from "./lineMatching";

const DEFAULT_CLAUDE_MODEL = "claude-3-5-haiku-20241022";
const REQUEST_TIMEOUT_MS = 60_000;

async function callClaudeApi(
  systemPrompt: string,
  userText: string,
  apiKey: string,
  customModel?: string,
): Promise<string> {
  const model = customModel?.trim() || DEFAULT_CLAUDE_MODEL;
  const url = "https://api.anthropic.com/v1/messages";

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
      }),
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout"))
    ) {
      throw new Error(`Claude request timed out (${REQUEST_TIMEOUT_MS / 1000}s). Please retry.`);
    }
    throw err;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${model}: ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error(`Empty response from Claude model ${model}`);
  }
  return text;
}

export async function translateWithClaude(
  lines: string[],
  apiKey: string,
  targetLang: string,
  customModel?: string,
  singable = false,
): Promise<string[]> {
  const systemPrompt = SONG_TRANSLATION_SYSTEM_PROMPT("auto", targetLang, singable);
  const text = await callClaudeApi(systemPrompt, lines.join("\n"), apiKey, customModel);
  const translatedLines = text.split("\n").map((l: string) => l.trim());
  return matchLineCount(translatedLines, lines);
}

export async function romanizeWithClaude(
  lines: string[],
  apiKey: string,
  customModel?: string,
): Promise<string[]> {
  const text = await callClaudeApi(
    SONG_ROMANIZATION_SYSTEM_PROMPT,
    lines.join("\n"),
    apiKey,
    customModel,
  );
  const romanizedLines = text.split("\n").map((l: string) => l.trim());
  return matchLineCount(romanizedLines, lines);
}
