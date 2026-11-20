import { expect, it } from "vitest";
import { overlayOrigin, type OverlayAnchor } from "./placement";

it.each<[OverlayAnchor, number]>([
  ["bottom-left", -460],
  ["bottom-center", -190],
  ["bottom-right", 80],
])("places %s relative to the bottom of an offset work area", (anchor, x) => {
  expect(
    overlayOrigin(
      { x: -480, y: 50, width: 900, height: 600 },
      { anchor, width: 320, height: 56, margin: 20 },
    ),
  ).toEqual({ x, y: 574 });
});
