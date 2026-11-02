import { describe, it, expect } from "vitest";
import {
  matchLineCount,
  dropUnchangedRomanization,
} from "./lineMatching";

describe("lineMatching", () => {
  it("aligns lines 1:1 when line counts and blank slots match exactly", () => {
    const source = ["Line 1", "", "Line 2"];
    const translated = ["Dòng 1", "", "Dòng 2"];
    expect(matchLineCount(translated, source)).toEqual(["Dòng 1", "", "Dòng 2"]);
  });

  it("re-aligns translated lines when an LLM drops blank lines", () => {
    const source = ["Line 1", "", "Line 2"];
    const translated = ["Dòng 1", "Dòng 2"];
    expect(matchLineCount(translated, source)).toEqual(["Dòng 1", "", "Dòng 2"]);
  });

  it("throws Line count mismatch when equal-count response places translation in a blank slot", () => {
    const source = ["A", "", "B"];
    const response = ["a", "misplaced", "b"];
    expect(() => matchLineCount(response, source)).toThrow(
      "Line count mismatch: expected 2 non-empty lines, received 3",
    );
  });

  it("throws Line count mismatch when nonblank source is opposite blank translation while blank source has nonblank translation", () => {
    const source = ["A", "", "B", ""];
    const response = ["a", "misplaced", "", "extra"];
    expect(() => matchLineCount(response, source)).toThrow(
      "Line count mismatch: expected 2 non-empty lines, received 3",
    );
  });

  it("cleans unchanged romanization lines for Latin text", () => {
    const source = ["Hello world", "残酷な天使のテーゼ"];
    const romanized = ["Hello world", "Zankoku na tenshi no teeze"];
    expect(dropUnchangedRomanization(romanized, source)).toEqual([
      "",
      "Zankoku na tenshi no teeze",
    ]);
  });
});
