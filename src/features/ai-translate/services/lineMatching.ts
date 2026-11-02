export function matchLineCount(
  translated: string[],
  original: string[],
): string[] {
  const trimmed = translated.map((line) =>
    typeof line === "string" ? line.trim() : "",
  );
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }

  if (trimmed.length === original.length) {
    return original.map((orig, index) =>
      orig.trim().length === 0 ? "" : trimmed[index],
    );
  }

  const cleaned = trimmed.filter((line) => line.length > 0);
  let cursor = 0;
  return original.map((orig) => {
    if (!orig || orig.trim().length === 0) return "";
    const next = cleaned[cursor++];
    return next !== undefined ? next : orig;
  });
}

function normalizeForCompare(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function dropUnchangedRomanization(
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

export async function mapWithConcurrency<T, R>(
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
