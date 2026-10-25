import { asArray } from "@/shared/utils/json";

const VISITOR_DATA_PATTERN = /Cg[s-v][A-Za-z0-9_-]{20,}(?:%3D|=){0,2}/;

function fromJson(text: string): string | null {
  try {
    const body = text.startsWith(")]}'")
      ? text.slice(text.indexOf("\n") + 1)
      : text;
    const value = asArray(
      asArray(
        asArray(asArray(asArray(JSON.parse(body) as unknown)[0])[2])[0],
      )[0],
    )[13];
    return typeof value === "string" && VISITOR_DATA_PATTERN.test(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function parseVisitorData(swJsData: string): string | null {
  return (
    fromJson(swJsData) ?? swJsData.match(VISITOR_DATA_PATTERN)?.[0] ?? null
  );
}
