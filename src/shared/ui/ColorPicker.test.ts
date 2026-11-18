import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex } from "./ColorPicker";

describe("colour picker conversions", () => {
  it("round-trips hex through HSV", () => {
    for (const hex of ["#ff4d4d", "#22d3ee", "#000000", "#ffffff", "#6c8cff"]) {
      expect(hsvToHex(hexToHsv(hex)!)).toBe(hex);
    }
  });

  it("reads pure colours", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00ff00")?.h).toBe(120);
    expect(hexToHsv("#0000ff")?.h).toBe(240);
  });

  it("accepts short and hashless codes, rejects junk", () => {
    expect(hsvToHex(hexToHsv("f80")!)).toBe("#ff8800");
    expect(hexToHsv("#12345")).toBeNull();
    expect(hexToHsv("zzzzzz")).toBeNull();
  });
});
