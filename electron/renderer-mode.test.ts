import { describe, expect, it } from "vitest";
import { getRendererMode } from "./renderer-mode";

describe("renderer selection", () => {
  it("keeps normal releases on the OTA update path", () => {
    expect(getRendererMode({ localTestBuild: false })).toBe("ota");
  });
  it("uses the packaged UI for a marked local test build, even with cached updates", () => {
    expect(getRendererMode({ localTestBuild: true })).toBe("bundled");
  });
  it("gives the development server precedence over the local test marker", () => {
    expect(
      getRendererMode({
        devServerUrl: "http://localhost:5173",
        localTestBuild: true,
      }),
    ).toBe("development");
  });
});
