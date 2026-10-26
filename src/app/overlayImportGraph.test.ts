import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = path.resolve(__dirname, "..");
const candidates = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const importPattern =
  /(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(src, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const suffix of candidates) {
    const file = base + suffix;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function importGraph(entry: string): string[] {
  const seen = new Set([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    for (const match of fs.readFileSync(file, "utf8").matchAll(importPattern)) {
      const target = resolveImport(file, match[1] ?? match[2]);
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return [...seen].map((file) => path.relative(src, file).replaceAll("\\", "/"));
}

describe("overlay window bundle", () => {
  const graph = importGraph(path.join(src, "app/OverlayApp.tsx"));

  it.each([
    "features/player/engine/",
    "shared/api/api.ts",
    "features/auth/",
    "features/settings/ui/",
    "features/library/",
    "features/lyrics/",
    "shared/telemetry/",
  ])("never pulls in %s", (heavy) => {
    expect(graph.filter((file) => file.startsWith(heavy))).toEqual([]);
  });

  it("stays small", () => {
    expect(graph.length).toBeLessThanOrEqual(60);
  });
});
