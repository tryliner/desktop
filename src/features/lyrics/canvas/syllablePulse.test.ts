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

  it("applies bounce pop and lift to short syllables", () => {
    const effect = syllablePulse(shortToken, 60);
    expect(effect.scale).toBeGreaterThan(1.02);
    expect(effect.dy).toBeLessThan(0);
    expect(effect.glowRem).toBeGreaterThan(0.5);
  });

  it("applies peak bounce on attack for sustained syllables", () => {
    const attackEffect = syllablePulse(longToken, 70);
    expect(attackEffect.scale).toBeGreaterThan(1.04);
    expect(attackEffect.dy).toBeLessThan(-2.0);
    expect(attackEffect.glowRem).toBeGreaterThan(0.7);
  });

  it("lands back to baseline during sustain phase", () => {
    const midEffect = syllablePulse(longToken, 600);
    expect(midEffect.scale).toBe(1);
    expect(midEffect.glowRem).toBeGreaterThan(0.2);
  });

  it("returns neutral state when elapsed is beyond token duration", () => {
    const endEffect = syllablePulse(longToken, 1200);
    expect(endEffect.scale).toBe(1);
    expect(endEffect.dy).toBe(0);
    expect(endEffect.glowRem).toBe(0);

    const pastEffect = syllablePulse(longToken, 1500);
    expect(pastEffect.scale).toBe(1);
    expect(pastEffect.dy).toBe(0);
    expect(pastEffect.glowRem).toBe(0);
  });
});
