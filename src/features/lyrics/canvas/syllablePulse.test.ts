import { describe, it, expect } from "vitest";
import { syllablePulse } from "./syllablePulse";
import type { LyricToken } from "./types";

describe("syllablePulse", () => {
  const shortToken: LyricToken = {
    text: "la",
    startMs: 1000,
    durationMs: 200,
    background: false,
    space: false,
  };

  const longToken: LyricToken = {
    text: "forever",
    startMs: 2000,
    durationMs: 1200,
    background: false,
    space: false,
  };

  it("does not apply bounce or pulse to short syllables (< 320ms)", () => {
    const effect = syllablePulse(shortToken, 100);
    expect(effect.scale).toBe(1);
    expect(effect.glowRem).toBe(0);
  });

  it("applies bounce scale on attack for sustained syllables", () => {
    const attackEffect = syllablePulse(longToken, 140);
    expect(attackEffect.scale).toBeGreaterThan(1.05);
    expect(attackEffect.scale).toBeLessThanOrEqual(1.1);
  });

  it("returns glowing highlight during mid-point of sustained singing", () => {
    const midEffect = syllablePulse(longToken, 600);
    expect(midEffect.glowRem).toBeGreaterThan(0.4);
  });

  it("returns neutral scale when elapsed is beyond token duration", () => {
    const pastEffect = syllablePulse(longToken, 1500);
    expect(pastEffect.scale).toBe(1);
    expect(pastEffect.glowRem).toBe(0);
  });
});
