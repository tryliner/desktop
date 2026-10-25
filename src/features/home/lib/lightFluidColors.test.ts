import { describe, expect, it } from "vitest";
import { rgbToHsl } from "@/shared/lib/color";
import { withLightness } from "./lightFluidColors";

function hsl(rgb: string) {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return rgbToHsl(r!, g!, b!);
}

describe("withLightness", () => {
  it("lifts a near-black accent to a soft tone of the same hue", () => {
    const dark = "rgb(92, 22, 44)";
    const light = withLightness(dark, 0.62);
    expect(hsl(light)[2]).toBeCloseTo(0.62, 1);
    expect(hsl(light)[0]).toBeCloseTo(hsl(dark)[0], 1);
  });
});
