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

  it("applies dynamic glow pulse to all syllables including short ones", () => {
    const effect = syllablePulse(shortToken, 60);
    expect(effect.scale).toBe(1);
    expect(effect.glowRem).toBeGreaterThan(0.5);
  });

  it("applies peak luminous bloom on attack for sustained syllables", () => {
    const attackEffect = syllablePulse(longToken, 80);
    expect(attackEffect.scale).toBe(1);
    expect(attackEffect.glowRem).toBeGreaterThan(0.7);
  });

  it("returns glowing highlight during mid-point of sustained singing", () => {
    const midEffect = syllablePulse(longToken, 600);
    expect(midEffect.glowRem).toBeGreaterThan(0.3);
  });

  it("returns 0 glow and neutral scale when elapsed is beyond token duration", () => {
    const endEffect = syllablePulse(longToken, 1200);
    expect(endEffect.scale).toBe(1);
    expect(endEffect.glowRem).toBe(0);

    const pastEffect = syllablePulse(longToken, 1500);
    expect(pastEffect.scale).toBe(1);
    expect(pastEffect.glowRem).toBe(0);
  });
});
