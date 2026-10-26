import { describe, expect, it } from "vitest";
import { ambientGlowClass } from "./AmbientTopGlow";

describe("ambientGlowClass", () => {
  it("follows the time of day like the old home glow", () => {
    expect(ambientGlowClass(8)).toContain("from-amber-500/30");
    expect(ambientGlowClass(14)).toContain("via-sky-500/15");
    expect(ambientGlowClass(19)).toContain("from-rose-500/30");
    expect(ambientGlowClass(23)).toContain("from-indigo-600/35");
    expect(ambientGlowClass(3)).toContain("from-indigo-600/35");
  });
});
