import { describe, it, expect, vi } from "vitest";

vi.mock("./baseUrl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./baseUrl")>()),
  getApiBaseUrl: () => "https://api.example",
}));

import { mediaUrl } from "./api";

describe("mediaUrl", () => {
  it("prefixes api-relative paths", () => {
    expect(mediaUrl("/covers/1.jpg")).toBe("https://api.example/covers/1.jpg");
    expect(mediaUrl("covers/1.jpg")).toBe("https://api.example/covers/1.jpg");
  });

  it.each([
    "https://cdn.example/a.jpg",
    "liner-local://playlist-cover/0123456789abcdef0123?v=1",
    "blob:http://localhost/abc",
    "data:image/png;base64,AAAA",
  ])("leaves %s alone", (url) => {
    expect(mediaUrl(url)).toBe(url);
  });

  it("returns empty for empty input", () => {
    expect(mediaUrl("")).toBe("");
  });
});
