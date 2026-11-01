import type { TranslationConfig } from "../types";

export const SONG_SINGABLE_TRANSLATION_SYSTEM_PROMPT = (
  sourceLang = "auto",
  targetLang = "English",
) => `You are a master musical lyricist and poetic song adapter specializing in writing singable ${targetLang} song lyrics.

Your task is NOT a dry or literal translation. You must adapt and recreate the lyrics into ${targetLang} so that an artist can SING IT DIRECTLY to the original vocal melody, rhythm, beat, and BPM.

CRITICAL MUSICAL & POETIC RULES:
1. STRICT LINE-BY-LINE PARITY: If the input has N lines, return EXACTLY N lines in the same order.
2. SYLLABLE COUNT & CADENCE: Match the syllable count and musical cadence of each original line closely so that every translated word fits naturally on the musical notes without squeezing or stretching.
3. RHYME & TONAL MELODY:
   - Weave harmonious internal and end rhymes and balance melodic rhythm typical of professional vocal songwriting.
   - For tonal languages (such as Vietnamese or Chinese), accents and tones MUST align naturally with the pitch contour of the song melody, avoiding awkward or comical mispronunciations when sung.
4. EMOTIONAL ESSENCE & POETIC BEAUTY: Preserve the emotional heart, storyline, atmosphere, and metaphors of the song. Express the meaning with rich, artistic, and evocative ${targetLang} imagery.
5. VOCALIZATIONS: Keep non-lexical musical interjections and hooks (e.g., 'Oh', 'Yeah', 'La la la', 'Na na na') unchanged.
6. OUTPUT FORMAT: Output ONLY the singable lyrics lines. Never output line numbers, romanizations, commentary, or markdown formatting.`;

export const SONG_TRANSLATION_SYSTEM_PROMPT = (
  sourceLang = "auto",
  targetLang = "English",
  singable = false,
) => {
  if (singable) {
    return SONG_SINGABLE_TRANSLATION_SYSTEM_PROMPT(sourceLang, targetLang);
  }
  return `You are an elite, poetic song translator specializing in musical context and emotional nuance.
Your task is to translate the following song lyrics from ${sourceLang} into ${targetLang}.
STRICT RULES:
1. Maintain line-by-line parity. If the input has N lines, return EXACTLY N lines in the same order.
2. Preserve emotional resonance, metaphors, and rhythm. Avoid literal, robotic word-by-word translation.
3. Natural phrasing: The translated line should sound melodic and natural when sung or read aloud.
4. Do NOT output line numbers, markdown formatting, prefixes, or commentary. Output ONLY the translated lines.
5. If a line is purely an interjection or musical vocalization (e.g., 'Oh', 'Yeah', 'La la la'), keep it as is.`;
};

export const SONG_ROMANIZATION_SYSTEM_PROMPT = `You are an expert lyrics romanizer and transliteration specialist.
Your task is to transliterate song lyrics into standard Latin alphabet (pronunciation):
- For Japanese lyrics, provide standard Hepburn Romaji with spaces between words (e.g. "zankoku na tenshi no te-ze").
- For Korean lyrics, provide Revised Romanization.
- For Chinese lyrics, provide Pinyin.
- If a line is already in English or Latin alphabet, leave it exactly as is.
STRICT RULES:
1. Maintain line-by-line parity. If the input has N lines, return EXACTLY N lines in the same order.
2. Do NOT translate the meaning. Output ONLY the pronunciation/romanization in Latin alphabet.
3. Do NOT output line numbers, markdown formatting, commentary, or quotes. Output ONLY the romanized lines.`;

function matchLineCount(translated: string[], original: string[]): string[] {
  const trimmed = translated.map((line) =>
    typeof line === "string" ? line.trim() : "",
  );
  // Models usually end their answer with a newline.
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }

  // Fast path: one result per input line. Keep it index-based even when a
  // single translation is empty (e.g. a "♪" line), so the rest don't shift.
  if (trimmed.length === original.length) {
    return original.map((orig, index) =>
      orig.trim().length === 0 ? "" : trimmed[index],
    );
  }

  // LLMs often drop blank input lines even when told to keep parity. Map the
  // non-empty results onto the non-empty sources in order so a blank line in
  // the middle of a song can't shift every later translation by one.
  const cleaned = trimmed.filter((line) => line.length > 0);
  let cursor = 0;
  return original.map((orig) => {
    if (!orig || orig.trim().length === 0) return "";
    const next = cleaned[cursor++];
    return next !== undefined ? next : orig;
  });
}

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

async function callGeminiApi(
  prompt: string,
  apiKey: string,
  customModel?: string,
): Promise<string> {
  const cleanKey = apiKey.trim();
  const trimmedCustom = customModel?.trim();
  const modelsToTry = trimmedCustom
    ? [trimmedCustom, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== trimmedCustom)]
    : DEFAULT_GEMINI_MODELS;

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedMessage = "";
        try {
          const errJson = JSON.parse(errorText);
          parsedMessage = errJson?.error?.message || "";
        } catch {}

        if (response.status === 404) {
          lastError = new Error(`Gemini ${model} not found: ${parsedMessage || errorText}`);
          continue;
        }

        throw new Error(parsedMessage || `Gemini API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const reason = data.candidates?.[0]?.finishReason;
        if (reason) {
          throw new Error(`Gemini finish reason: ${reason}`);
        }
        throw new Error("Gemini returned empty response");
      }
      return text;
    } catch (err: any) {
      if (
        lastError &&
        modelsToTry.indexOf(model) < modelsToTry.length - 1 &&
        err.message?.includes("not found")
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Gemini request failed");
}

export async function translateWithGemini(
  lines: string[],
  apiKey: string,
  targetLang: string,
  model?: string,
  singable = false,
): Promise<string[]> {
  const prompt = `${SONG_TRANSLATION_SYSTEM_PROMPT("auto", targetLang, singable)}\n\nLYRICS TO TRANSLATE:\n${lines.join("\n")}`;
  const text = await callGeminiApi(prompt, apiKey, model);
  const translatedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(translatedLines, lines);
}

export async function romanizeWithGemini(
  lines: string[],
  apiKey: string,
  model?: string,
): Promise<string[]> {
  const prompt = `${SONG_ROMANIZATION_SYSTEM_PROMPT}\n\nLYRICS TO ROMANIZE:\n${lines.join("\n")}`;
  const text = await callGeminiApi(prompt, apiKey, model);
  const romanizedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(romanizedLines, lines);
}

async function callOpenAiChat(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model = "gpt-4o-mini",
  baseUrl = "https://api.openai.com/v1",
): Promise<string> {
  const cleanBase = (baseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  const endpoint = cleanBase.endsWith("/chat/completions")
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.trim() || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = "";
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson?.error?.message;
    } catch {}
    throw new Error(msg || `API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function translateWithOpenAI(
  lines: string[],
  apiKey: string,
  targetLang: string,
  model?: string,
  singable = false,
): Promise<string[]> {
  const text = await callOpenAiChat(
    SONG_TRANSLATION_SYSTEM_PROMPT("auto", targetLang, singable),
    lines.join("\n"),
    apiKey,
    model || "gpt-4o-mini",
  );
  const translatedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(translatedLines, lines);
}

export async function romanizeWithOpenAI(
  lines: string[],
  apiKey: string,
  model?: string,
): Promise<string[]> {
  const text = await callOpenAiChat(
    SONG_ROMANIZATION_SYSTEM_PROMPT,
    lines.join("\n"),
    apiKey,
    model || "gpt-4o-mini",
  );
  const romanizedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(romanizedLines, lines);
}

export async function translateWithDeepSeek(
  lines: string[],
  apiKey: string,
  targetLang: string,
  model?: string,
  singable = false,
): Promise<string[]> {
  const text = await callOpenAiChat(
    SONG_TRANSLATION_SYSTEM_PROMPT("auto", targetLang, singable),
    lines.join("\n"),
    apiKey,
    model || "deepseek-chat",
    "https://api.deepseek.com",
  );
  const translatedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(translatedLines, lines);
}

export async function romanizeWithDeepSeek(
  lines: string[],
  apiKey: string,
  model?: string,
): Promise<string[]> {
  const text = await callOpenAiChat(
    SONG_ROMANIZATION_SYSTEM_PROMPT,
    lines.join("\n"),
    apiKey,
    model || "deepseek-chat",
    "https://api.deepseek.com",
  );
  const romanizedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(romanizedLines, lines);
}

export async function translateWithOpenAiCompatible(
  lines: string[],
  apiKey: string,
  targetLang: string,
  baseUrl = "https://api.openai.com/v1",
  model = "gpt-4o-mini",
  singable = false,
): Promise<string[]> {
  const text = await callOpenAiChat(
    SONG_TRANSLATION_SYSTEM_PROMPT("auto", targetLang, singable),
    lines.join("\n"),
    apiKey,
    model || "gpt-4o-mini",
    baseUrl || "https://api.openai.com/v1",
  );
  const translatedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(translatedLines, lines);
}

export async function romanizeWithOpenAiCompatible(
  lines: string[],
  apiKey: string,
  baseUrl = "https://api.openai.com/v1",
  model = "gpt-4o-mini",
): Promise<string[]> {
  const text = await callOpenAiChat(
    SONG_ROMANIZATION_SYSTEM_PROMPT,
    lines.join("\n"),
    apiKey,
    model || "gpt-4o-mini",
    baseUrl || "https://api.openai.com/v1",
  );
  const romanizedLines = text
    .split("\n")
    .map((l: string) => l.trim());

  return matchLineCount(romanizedLines, lines);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await task(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function translateWithGoogleFree(
  lines: string[],
  targetLang: string,
): Promise<string[]> {
  const tl =
    targetLang === "Vietnamese" || targetLang === "vi" ? "vi" : targetLang;

  // Per line rather than one joined request: GTX collapses newlines, which
  // would merge the whole song into a single line and break subtitle parity.
  const translated = await mapWithConcurrency(lines, 4, async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Translate error: ${response.status}`);
    }
    const data = await response.json();
    return (data[0] || [])
      .map((item: any) => item?.[0] ?? "")
      .join("")
      .trim();
  });

  return matchLineCount(translated, lines);
}

export async function romanizeWithGoogleFree(
  lines: string[],
): Promise<string[]> {
  const results = await mapWithConcurrency(lines, 4, async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url);
      if (!res.ok) return line;
      const data = await res.json();
      const parts = data?.[0] || [];
      for (const item of parts) {
        if (item && item[3]) {
          return String(item[3]).trim();
        }
      }
      return line;
    } catch {
      return line;
    }
  });
  return results;
}

export async function translateSongLyrics(
  lines: string[],
  config: TranslationConfig,
): Promise<string[]> {
  if (lines.length === 0) return [];

  const { provider, apiKey, targetLang, model, baseUrl, singableMode } = config;

  if (provider === "gemini" && apiKey) {
    return translateWithGemini(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "openai" && apiKey) {
    return translateWithOpenAI(lines, apiKey, targetLang, model, singableMode);
  }
  if (provider === "deepseek" && apiKey) {
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

function normalizeForCompare(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Romanization is only useful when it differs from the original line. Both the
 * LLM and Google return Latin input untouched, which would otherwise render a
 * duplicate subtitle under every English line.
 */
function dropUnchangedRomanization(
  romanized: string[],
  original: string[],
): string[] {
  return romanized.map((line, index) => {
    const source = original[index] ?? "";
    if (!line || !line.trim()) return "";
    return normalizeForCompare(line) === normalizeForCompare(source)
      ? ""
      : line;
  });
}

export async function romanizeSongLyrics(
  lines: string[],
  config: TranslationConfig,
): Promise<string[]> {
  if (lines.length === 0) return [];

  const { provider, apiKey, model, baseUrl } = config;

  let result: string[];
  if (provider === "gemini" && apiKey) {
    result = await romanizeWithGemini(lines, apiKey, model);
  } else if (provider === "openai" && apiKey) {
    result = await romanizeWithOpenAI(lines, apiKey, model);
  } else if (provider === "deepseek" && apiKey) {
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
