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
