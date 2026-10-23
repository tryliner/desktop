import { describe, it, expect } from "vitest";
import { validateProfile, sanitizeBio } from "./validation";
import { buildProfileShareUrl, copyProfileShareLink } from "./share";
import { readImageFileAsDataUrl, MAX_AVATAR_BYTES } from "./upload";

describe("Profile Validation, Sanitization, Share & Upload", () => {
  describe("validateProfile", () => {
    it("accepts valid handles and bios (R2-T3, R2-C2)", () => {
      expect(validateProfile({ handle: "valid_user", bio: "Short bio" }).valid).toBe(true);
      expect(validateProfile({ handle: "abc", bio: "X".repeat(250) }).valid).toBe(true);
      expect(validateProfile({ handle: "a".repeat(30), bio: "Bio" }).valid).toBe(true);
      expect(validateProfile({ username: "cool_user_123" }).valid).toBe(true);
    });

    it("rejects handles shorter than 3 characters", () => {
      const res = validateProfile({ handle: "ab" });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Handle must be at least 3 characters");
      expect(res.fieldErrors.handle).toBeDefined();
    });

    it("rejects handles longer than 30 characters", () => {
      const res = validateProfile({ handle: "a".repeat(31), bio: "Bio" });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Handle length invalid");
    });

    it("rejects handles containing non-alphanumeric or non-underscore characters", () => {
      const res1 = validateProfile({ handle: "invalid user!" });
      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain("Handle can only contain alphanumeric and underscore");

      const res2 = validateProfile({ handle: "user-name" });
      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain("Handle can only contain alphanumeric and underscore");

      const res3 = validateProfile({ handle: "user@liner" });
      expect(res3.valid).toBe(false);
      expect(res3.errors).toContain("Handle can only contain alphanumeric and underscore");
    });

    it("rejects bio longer than 250 characters (R2-T3, R2-C2)", () => {
      const res = validateProfile({ handle: "valid_handle", bio: "A".repeat(251) });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Bio cannot exceed 250 characters");
      expect(res.errors).toContain("Bio too long");
      expect(res.fieldErrors.bio).toBeDefined();
    });

    it("handles missing or null input gracefully", () => {
      const res = validateProfile({});
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Handle must be at least 3 characters");
    });
  });

  describe("sanitizeBio", () => {
    it("strips HTML tags while preserving Unicode emojis (R2-C5)", () => {
      const dirty = "Curating synthwave 🌆 with retro aesthetics! 🚀 <script>alert(1)</script>";
      const clean = sanitizeBio(dirty);

      expect(clean).toContain("synthwave 🌆 with retro aesthetics! 🚀");
      expect(clean).not.toContain("<script>");
      expect(clean).not.toContain("</script>");
    });

    it("handles multiple and nested HTML tags", () => {
      const dirty = "<b>Hello</b> <i>world</i> <a href='https://liner.fun'>link</a>";
      const clean = sanitizeBio(dirty);
      expect(clean).toBe("Hello world link");
    });

    it("handles empty or falsy strings", () => {
      expect(sanitizeBio("")).toBe("");
      expect(sanitizeBio(null as any)).toBe("");
    });
  });

  describe("buildProfileShareUrl & copyProfileShareLink", () => {
    it("generates canonical URL matching R2-T6 and Tier 4 assertions", () => {
      expect(buildProfileShareUrl("music_maker")).toBe("https://liner.fun/profile/music_maker");
      expect(buildProfileShareUrl("synth_master")).toBe("https://liner.fun/profile/synth_master");
    });

    it("strips leading @ symbol if present", () => {
      expect(buildProfileShareUrl("@audiophile99")).toBe("https://liner.fun/profile/audiophile99");
    });

    it("supports deeplink and public modes", () => {
      expect(buildProfileShareUrl("user1", "deeplink")).toBe("liner://user/user1");
      expect(buildProfileShareUrl("user1", "public")).toBe("https://tryliner.fun/user/user1");
    });

    it("copyProfileShareLink writes to clipboard when available", async () => {
      let writtenText = "";
      const originalClipboard = navigator.clipboard;
      (navigator as any).clipboard = {
        writeText: async (t: string) => {
          writtenText = t;
        },
      };

      const url = await copyProfileShareLink("music_fan");
      expect(url).toBe("https://liner.fun/profile/music_fan");
      expect(writtenText).toBe("https://liner.fun/profile/music_fan");

      (navigator as any).clipboard = originalClipboard;
    });
  });

  describe("upload.ts (readImageFileAsDataUrl)", () => {
    it("rejects non-image MIME types", async () => {
      const textFile = new File(["dummy text"], "dummy.txt", { type: "text/plain" });
      await expect(readImageFileAsDataUrl(textFile)).rejects.toThrow("Selected file must be an image");
    });

    it("rejects files exceeding 3MB limit", async () => {
      const largeBlob = new Uint8Array(MAX_AVATAR_BYTES + 1024);
      const largeFile = new File([largeBlob], "huge.png", { type: "image/png" });
      await expect(readImageFileAsDataUrl(largeFile)).rejects.toThrow("Avatar image size must be under 3MB");
    });
  });
});
