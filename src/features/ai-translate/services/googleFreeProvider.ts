import { mapWithConcurrency, matchLineCount } from "./lineMatching";

export async function translateWithGoogleFree(
  lines: string[],
  targetLang: string,
): Promise<string[]> {
  const tl =
    targetLang === "Vietnamese" || targetLang === "vi" ? "vi" : targetLang;

  const translated = await mapWithConcurrency(lines, 4, async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Translate error: ${response.status}`);
    }
    const data = await response.json();
    type GoogleSegment = [string | null, ...unknown[]] | null;
    return ((data?.[0] as GoogleSegment[]) || [])
      .map((item) => item?.[0] ?? "")
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
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Google romanization error: ${res.status}`);
    }
    const data = await res.json();
    type RomanizeSegment = [unknown, unknown, unknown, string | null] | null;
    const parts = ((data?.[0] as RomanizeSegment[]) || []);
    for (const item of parts) {
      if (item && item[3]) {
        return String(item[3]).trim();
      }
    }
    return line;
  });
  return results;
}
