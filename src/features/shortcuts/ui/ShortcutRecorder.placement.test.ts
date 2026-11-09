import { describe, expect, it } from "vitest";
import { placeTooltipInside } from "./ShortcutRecorder";

const panel = { left: 400, right: 1000 };

describe("recorder error tooltip placement", () => {
  it("stays under the recorder when it fits", () => {
    expect(placeTooltipInside(500, 200, panel)).toEqual({ left: 0 });
  });

  it("slides left so it does not run past the panel's right edge", () => {
    expect(placeTooltipInside(880, 230, panel)).toEqual({ left: -118 });
  });

  it("never slides past the panel's left edge and wraps when too wide", () => {
    expect(placeTooltipInside(450, 900, panel)).toEqual({
      left: -42,
      maxWidth: 584,
    });
  });
});
