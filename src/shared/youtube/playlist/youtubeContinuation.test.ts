import { describe, expect, it } from "vitest";
import { extractInnertubeContinuationToken } from "./youtubeContinuation";

describe("youtube continuation", () => {
  it("finds continuation tokens in several shapes", () => {
    const item = {
      continuationItemRenderer: {
        continuationEndpoint: { continuationCommand: { token: " a " } },
      },
    };
    expect(extractInnertubeContinuationToken({ contents: [item] })).toBe("a");
    expect(
      extractInnertubeContinuationToken({
        x: { nextContinuationData: { continuation: "b" } },
      }),
    ).toBe("b");
    expect(extractInnertubeContinuationToken({})).toBeUndefined();
  });
});
