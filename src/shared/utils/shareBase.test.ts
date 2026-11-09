import { describe, expect, it } from "vitest";
import { resolveShareBaseUrl } from "./share";

describe("resolveShareBaseUrl", () => {
  it("shares through the staging edge when the app talks to the staging api", () => {
    expect(resolveShareBaseUrl(undefined, "https://staging.tryliner.fun")).toBe(
      "https://staging.tryliner.fun/link",
    );
  });

  it("uses the prod link for the prod api and anything unknown", () => {
    expect(resolveShareBaseUrl(undefined, "https://api.tryliner.fun")).toBe(
      "https://link.tryliner.fun",
    );
    expect(resolveShareBaseUrl("", "not a url")).toBe(
      "https://link.tryliner.fun",
    );
  });

  it("lets an explicit setting win", () => {
    expect(
      resolveShareBaseUrl("http://localhost:1193/", "https://staging.tryliner.fun"),
    ).toBe("http://localhost:1193");
  });
});
