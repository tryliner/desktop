import { describe, it, expect } from "vitest";
import { toMaxQualityAvatarUrl } from "./api";

describe("toMaxQualityAvatarUrl", () => {
  it("returns empty string for empty input", () => {
    expect(toMaxQualityAvatarUrl(undefined)).toBe("");
    expect(toMaxQualityAvatarUrl("")).toBe("");
  });

  it("leaves non-google/youtube urls unchanged", () => {
    const genius = "https://images.genius.com/abc12345.640x640x1.jpg";
    expect(toMaxQualityAvatarUrl(genius)).toBe(genius);

    const custom = "https://example.com/avatar.png";
    expect(toMaxQualityAvatarUrl(custom)).toBe(custom);
  });

  it("upgrades googleusercontent.com width/height formatted avatars to =s0", () => {
    const original =
      "https://lh3.googleusercontent.com/a/abc123def456=w512-h512-l90-rj";
    expect(toMaxQualityAvatarUrl(original)).toBe(
      "https://lh3.googleusercontent.com/a/abc123def456=s0",
    );
  });

  it("upgrades yt3.ggpht.com scale formatted avatars to =s0", () => {
    const original =
      "https://yt3.ggpht.com/a/abc123def456=s88-c-k-c0x00ffffff-no-rj";
    expect(toMaxQualityAvatarUrl(original)).toBe(
      "https://yt3.ggpht.com/a/abc123def456=s0",
    );
  });

  it("appends =s0 when no parameter suffix is present", () => {
    const original = "https://yt3.googleusercontent.com/a/abc123def456";
    expect(toMaxQualityAvatarUrl(original)).toBe(
      "https://yt3.googleusercontent.com/a/abc123def456=s0",
    );
  });

  it("retains =s0 if already at maximum quality", () => {
    const original = "https://yt3.ggpht.com/a/abc123def456=s0";
    expect(toMaxQualityAvatarUrl(original)).toBe(
      "https://yt3.ggpht.com/a/abc123def456=s0",
    );
  });
});
