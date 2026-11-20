export async function mapLimit<T, R>(
  input: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = Array.from({ length: input.length });
  let next = 0;
  const worker = async () => {
    while (next < input.length) {
      const index = next++;
      out[index] = await fn(input[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, input.length) }, worker),
  );
  return out;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
