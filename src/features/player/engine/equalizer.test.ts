import { describe, expect, it } from "vitest";
import {
  EQ_BANDS,
  EQ_PRESETS,
  EQ_MAX_CUSTOM_PRESETS,
  FLAT_EQ,
  clampEqGain,
  eqPreampDb,
  findEqPreset,
  isEqActive,
  normalizeEqCustomPresets,
  normalizeEqGains,
} from "./equalizer";

describe("equalizer", () => {
  it("every preset covers all bands", () => {
    for (const preset of EQ_PRESETS)
      expect(preset.gains).toHaveLength(EQ_BANDS.length);
  });

  it("preset ids are unique and curves stay in range", () => {
    expect(new Set(EQ_PRESETS.map((p) => p.id)).size).toBe(EQ_PRESETS.length);
    for (const preset of EQ_PRESETS)
      expect(normalizeEqGains(preset.gains)).toEqual(preset.gains);
  });

  it("enhance presets stay gentle: no band moves more than 4 dB", () => {
    for (const preset of EQ_PRESETS.filter((p) => p.category === "enhance"))
      for (const gain of preset.gains) expect(Math.abs(gain)).toBeLessThanOrEqual(4);
  });

  it("drops broken custom presets and caps the list", () => {
    const valid = { id: "a", name: "  Mine  ", gains: [1, ...FLAT_EQ.slice(1)] };
    expect(
      normalizeEqCustomPresets([valid, { id: "b", name: "" }, null, "x"]),
    ).toEqual([{ id: "a", name: "Mine", gains: valid.gains }]);
    const many = Array.from({ length: 20 }, (_, i) => ({ ...valid, id: String(i) }));
    expect(normalizeEqCustomPresets(many)).toHaveLength(EQ_MAX_CUSTOM_PRESETS);
    expect(normalizeEqCustomPresets(undefined)).toEqual([]);
  });

  it("clamps and snaps gains to half a dB", () => {
    expect(clampEqGain(20)).toBe(12);
    expect(clampEqGain(-20)).toBe(-12);
    expect(clampEqGain(3.3)).toBe(3.5);
  });

  it("falls back to flat on a broken persisted value", () => {
    expect(normalizeEqGains(undefined)).toEqual(FLAT_EQ);
    expect(normalizeEqGains([1, 2])).toEqual(FLAT_EQ);
    expect(normalizeEqGains([NaN, ...FLAT_EQ.slice(1)])).toEqual(FLAT_EQ);
  });

  it("is only active when enabled and not flat", () => {
    const bass = EQ_PRESETS.find((p) => p.id === "bass")!.gains;
    expect(isEqActive(true, FLAT_EQ)).toBe(false);
    expect(isEqActive(false, bass)).toBe(false);
    expect(isEqActive(true, bass)).toBe(true);
  });

  it("matches presets and pulls the preamp down by the loudest boost", () => {
    const bass = EQ_PRESETS.find((p) => p.id === "bass")!.gains;
    expect(findEqPreset(bass)?.id).toBe("bass");
    expect(findEqPreset([1, ...FLAT_EQ.slice(1)])).toBeNull();
    expect(eqPreampDb(bass)).toBe(-6);
    expect(eqPreampDb([-3, ...FLAT_EQ.slice(1)])).toBeCloseTo(0);
  });
});
