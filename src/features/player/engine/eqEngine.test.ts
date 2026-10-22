import { beforeEach, describe, expect, it } from "vitest";
import { playerEngine, usePlayerStore } from "./playerEngine";
import { EQ_PRESETS } from "./eqMath";

describe("equaliser engine api", () => {
  beforeEach(() => {
    usePlayerStore.setState({ eqEnabled: false, eqBands: [...EQ_PRESETS.flat] });
  });

  it("dragging a band switches the eq on and clamps/steps the value", () => {
    playerEngine.setEqBand(3, 20);
    const s = usePlayerStore.getState();
    expect(s.eqEnabled).toBe(true);
    expect(s.eqBands[3]).toBe(12);
    playerEngine.setEqBand(3, 2.26);
    expect(usePlayerStore.getState().eqBands[3]).toBe(2.5);
  });

  it("presets load their curve and turn the eq on (flat does not)", () => {
    playerEngine.applyEqPreset("flat");
    expect(usePlayerStore.getState().eqEnabled).toBe(false);
    playerEngine.applyEqPreset("rock");
    expect(usePlayerStore.getState().eqBands).toEqual([...EQ_PRESETS.rock]);
    expect(usePlayerStore.getState().eqEnabled).toBe(true);
  });

  it("reset flattens but keeps the on/off choice", () => {
    playerEngine.applyEqPreset("vocal");
    playerEngine.resetEq();
    const s = usePlayerStore.getState();
    expect(s.eqBands).toEqual([...EQ_PRESETS.flat]);
    expect(s.eqEnabled).toBe(true);
  });

  it("ignores out-of-range band indices", () => {
    playerEngine.setEqBand(42, 6);
    expect(usePlayerStore.getState().eqBands).toEqual([...EQ_PRESETS.flat]);
  });
});
