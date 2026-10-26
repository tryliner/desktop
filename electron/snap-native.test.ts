import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// the CI add-on check (scripts/verify-native-addon.cjs) must require exactly what the
// app requires (electron/snap-native.ts), or a release could ship an add-on that
// passes CI but makes the app fall back to the plain preview
const names = (source: string, pattern: RegExp) => {
  const block = source.match(pattern)?.[1] ?? "";
  return [...block.matchAll(/"(\w+)"/g)].map((m) => m[1]).sort();
};

describe("native add-on function list", () => {
  it("CI check and app loader require the same functions", () => {
    const root = path.join(__dirname, "..");
    const app = names(fs.readFileSync(path.join(root, "electron", "snap-native.ts"), "utf8"), /const required = \[([\s\S]*?)\] as const/);
    const ci = names(fs.readFileSync(path.join(root, "scripts", "verify-native-addon.cjs"), "utf8"), /const REQUIRED = \[([\s\S]*?)\];/);
    expect(app.length).toBeGreaterThan(0);
    expect(ci).toEqual(app);
  });
});
