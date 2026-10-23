import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  validateProfile,
  sanitizeBio,
  HANDLE_REGEX,
  BIO_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_MAX_LENGTH,
} from "@/features/profile/validation";
import {
  readImageFileAsDataUrl,
  MAX_AVATAR_BYTES,
} from "@/features/profile/upload";
import {
  GUEST_PROFILE,
  PROFILE_CACHE_KEY,
  PROFILE_STORAGE_KEY,
} from "@/features/profile/constants";
import { useAuthStore } from "@/features/auth/store/authStore";
import { api } from "@/shared/api";
import ProfilePage from "@/features/profile/ui/ProfilePage";

// Support React act in Vitest environment
// @ts-expect-error - act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock lottie and translations
vi.mock("lottie-web", () => ({
  default: {
    loadAnimation: vi.fn(() => ({
      destroy: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
    })),
  },
}));

vi.mock("@/languages", () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params?.count !== undefined) return `${params.count} tracks`;
      return key;
    },
  }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        return React.forwardRef(({ children, ...props }: any, ref: any) => {
          const clean = { ...props };
          for (const k of ["initial", "animate", "exit", "transition", "layoutId"]) {
            delete clean[k];
          }
          return React.createElement(prop, { ref, ...clean }, children);
        });
      },
    }
  ),
}));

vi.mock("@/features/library/hooks/usePlaylists", () => ({
  usePlaylistsList: () => ({
    data: { playlists: [], total: 0 },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/features/library/hooks/useExternalItems", () => ({
  useExternalItems: () => ({
    data: [],
    isLoading: false,
  }),
}));

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("Empirical Challenger M2.1: Profile Validation, Avatar & Boundary Stress", () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal("localStorage", mockStorage);
    useAuthStore.setState({ status: "anonymous", user: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Handle Boundary & Character Set Stress Tests", () => {
    it("fails 2-character handles (lower boundary - 1)", () => {
      const res = validateProfile({ handle: "ab" });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Handle must be at least 3 characters");
      expect(res.errors).toContain("Handle length invalid");
      expect(res.fieldErrors.handle).toBe("Handle must be at least 3 characters");
    });

    it("passes exactly 3-character handles (lower boundary exact)", () => {
      const res = validateProfile({ handle: "abc" });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.fieldErrors.handle).toBeUndefined();
    });

    it("passes exactly 30-character handles (upper boundary exact)", () => {
      const handle30 = "a".repeat(30);
      expect(handle30.length).toBe(30);
      const res = validateProfile({ handle: handle30 });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.fieldErrors.handle).toBeUndefined();
    });

    it("fails 31-character handles (upper boundary + 1)", () => {
      const handle31 = "a".repeat(31);
      expect(handle31.length).toBe(31);
      const res = validateProfile({ handle: handle31 });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Handle length invalid");
      expect(res.fieldErrors.handle).toBe("Handle length invalid");
    });

    it("fails extreme lengths: 0 chars, 1 char, and 100 chars", () => {
      expect(validateProfile({ handle: "" }).valid).toBe(false);
      expect(validateProfile({ handle: "x" }).valid).toBe(false);
      expect(validateProfile({ handle: "x".repeat(100) }).valid).toBe(false);
    });

    it("fails handles containing internal spaces and whitespace-only", () => {
      const handlesWithSpaces = [
        "user name", // space between words
        "my cool handle",
        "a b",
        "foo  bar",
        "user 123",
        "   ", // whitespace only
        "   \t\n  ", // tabs and newlines
        " ab ", // 2 chars with spaces (trims to < 3 chars)
      ];

      for (const h of handlesWithSpaces) {
        const res = validateProfile({ handle: h });
        expect(res.valid).toBe(false);
      }
    });

    it("fails handles containing punctuation and special symbols", () => {
      const punctuationHandles = [
        "user.name", // dot
        "user-name", // hyphen
        "user@name", // at symbol
        "user#name", // hash
        "user$name", // dollar
        "user!name", // exclamation
        "user?name", // question mark
        "user:name", // colon
        "user;name", // semicolon
        "user/name", // slash
        "user\\name", // backslash
        "user<name", // HTML angle bracket
        "user>name",
        "user+name", // plus
        "user*name", // asterisk
        "user%name", // percent
        "user=name", // equal
        "user~name", // tilde
        "user^name", // caret
        "user&name", // ampersand
        "user(name)", // parentheses
        "user[name]", // brackets
      ];

      for (const h of punctuationHandles) {
        const res = validateProfile({ handle: h });
        expect(res.valid).toBe(false);
        expect(res.errors).toContain("Handle can only contain alphanumeric and underscore");
      }
    });

    it("fails handles containing emojis and non-ASCII Unicode characters", () => {
      const nonAsciiHandles = [
        "user🎵", // emoji
        "🎧producer", // emoji
        "пользователь", // Cyrillic
        "ユーザー", // Japanese
        "café_music", // accented é
        "ñandú", // accented ñ
        "über_dj", // umlaut ü
      ];

      for (const h of nonAsciiHandles) {
        const res = validateProfile({ handle: h });
        expect(res.valid).toBe(false);
        expect(res.errors).toContain("Handle can only contain alphanumeric and underscore");
      }
    });

    it("falls back to username when handle property is undefined", () => {
      const res = validateProfile({ username: "valid_fallback_user" });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("fails when both handle and username are missing or null", () => {
      expect(validateProfile({}).valid).toBe(false);
      expect(validateProfile({ handle: null, username: null }).valid).toBe(false);
      expect(validateProfile({ handle: undefined, username: undefined }).valid).toBe(false);
    });
  });

  describe("2. Bio Boundary & Sanitization Stress Tests", () => {
    it("passes exactly 250 characters bio (upper boundary exact)", () => {
      const bio250 = "X".repeat(250);
      expect(bio250.length).toBe(250);
      const res = validateProfile({ handle: "valid_handle", bio: bio250 });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.fieldErrors.bio).toBeUndefined();
    });

    it("fails 251 characters bio (upper boundary + 1)", () => {
      const bio251 = "X".repeat(251);
      expect(bio251.length).toBe(251);
      const res = validateProfile({ handle: "valid_handle", bio: bio251 });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Bio cannot exceed 250 characters");
      expect(res.errors).toContain("Bio too long");
      expect(res.fieldErrors.bio).toBe("Bio cannot exceed 250 characters");
    });

    it("fails extreme bio lengths: 1,000 and 10,000 characters", () => {
      expect(validateProfile({ handle: "valid_user", bio: "A".repeat(1000) }).valid).toBe(false);
      expect(validateProfile({ handle: "valid_user", bio: "A".repeat(10000) }).valid).toBe(false);
    });

    it("sanitizes HTML script injection and hostile vectors via sanitizeBio", () => {
      const attackVectors = [
        "<script>alert('XSS')</script>",
        "<script src='https://evil.com/malware.js'></script>",
        "<img src=x onerror=alert('PWNED')>",
        "<svg/onload=alert(document.domain)>",
        "<iframe src='javascript:alert(1)'></iframe>",
        "<style>body { display: none; }</style>",
        "<a href='javascript:void(0)' onclick='stealCookie()'>Click here</a>",
        "<div><p>Deeply <span>nested <b>tags</b></span></p></div>",
      ];

      for (const vector of attackVectors) {
        const sanitized = sanitizeBio(vector);
        expect(sanitized).not.toMatch(/<script/i);
        expect(sanitized).not.toMatch(/<\/script>/i);
        expect(sanitized).not.toMatch(/<img/i);
        expect(sanitized).not.toMatch(/<svg/i);
        expect(sanitized).not.toMatch(/<iframe/i);
        expect(sanitized).not.toMatch(/<style/i);
        expect(sanitized).not.toMatch(/<[^>]*>/); // No remaining HTML tags
      }
    });

    it("sanitizes HTML script tags while strictly preserving Unicode emojis and multi-byte characters", () => {
      const complexInput =
        "🎧 Electronic vibes 🌸 curated by DJ 🚀 <script>stealSession()</script> <b>Synthwave 2026</b> 🔥✨";
      const sanitized = sanitizeBio(complexInput);

      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("</script>");
      expect(sanitized).not.toContain("<b>");
      expect(sanitized).not.toContain("</b>");

      // Verify all emojis survive intact
      expect(sanitized).toContain("🎧");
      expect(sanitized).toContain("🌸");
      expect(sanitized).toContain("🚀");
      expect(sanitized).toContain("🔥");
      expect(sanitized).toContain("✨");

      // Verify surrounding text survives
      expect(sanitized).toContain("Electronic vibes");
      expect(sanitized).toContain("curated by DJ");
      expect(sanitized).toContain("Synthwave 2026");
    });

    it("preserves diverse multi-byte Unicode scripts (Japanese, Cyrillic, Arabic, Accents)", () => {
      const multilingual =
        "Tokyo 東京 🌸 Moscow Москва ❄️ Cairo القاهرة 🏜️ Café français ☕ <script>alert(1)</script>";
      const sanitized = sanitizeBio(multilingual);

      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("Tokyo 東京 🌸");
      expect(sanitized).toContain("Moscow Москва ❄️");
      expect(sanitized).toContain("Cairo القاهرة 🏜️");
      expect(sanitized).toContain("Café français ☕");
    });
  });

  describe("3. Avatar Upload Boundary & MIME Rejection Stress Tests", () => {
    it("strictly enforces 3MB maximum byte limit (3,145,728 bytes)", async () => {
      // 3MB exact = passes limit check (does not reject for size)
      const exact3MB = new Uint8Array(MAX_AVATAR_BYTES);
      const exactFile = new File([exact3MB], "avatar_exact_3mb.png", { type: "image/png" });
      expect(exactFile.size).toBe(3 * 1024 * 1024);

      // 3MB + 1 byte = fails limit check
      const over3MB = new Uint8Array(MAX_AVATAR_BYTES + 1);
      const overFile = new File([over3MB], "avatar_oversize.png", { type: "image/png" });
      expect(overFile.size).toBe(3 * 1024 * 1024 + 1);

      await expect(readImageFileAsDataUrl(overFile)).rejects.toThrow("Avatar image size must be under 3MB");

      // 10MB = fails limit check
      const large10MB = new Uint8Array(10 * 1024 * 1024);
      const largeFile = new File([large10MB], "huge.png", { type: "image/png" });
      await expect(readImageFileAsDataUrl(largeFile)).rejects.toThrow("Avatar image size must be under 3MB");
    });

    it("rejects all non-image MIME types and invalid file payloads", async () => {
      const adversarialFiles = [
        new File(["dummy code"], "exploit.js", { type: "application/javascript" }),
        new File(["<html><body>hacked</body></html>"], "page.html", { type: "text/html" }),
        new File(["some text"], "notes.txt", { type: "text/plain" }),
        new File(["%PDF-1.4"], "document.pdf", { type: "application/pdf" }),
        new File(["ID3audio"], "song.mp3", { type: "audio/mpeg" }),
        new File(["video content"], "clip.mp4", { type: "video/mp4" }),
        new File(["binary data"], "blob.bin", { type: "application/octet-stream" }),
        new File(["empty mime"], "noext", { type: "" }),
      ];

      for (const file of adversarialFiles) {
        await expect(readImageFileAsDataUrl(file)).rejects.toThrow("Selected file must be an image");
      }
    });

    it("rejects null or undefined file input safely", async () => {
      await expect(readImageFileAsDataUrl(null as any)).rejects.toThrow("Selected file must be an image");
      await expect(readImageFileAsDataUrl(undefined as any)).rejects.toThrow("Selected file must be an image");
    });

    it("encodes valid image file below 3MB to Data URL", async () => {
      // Mock FileReader to return data URL in headless environment
      const originalFileReader = globalThis.FileReader;
      class MockFileReader {
        result: string | ArrayBuffer | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL(file: File) {
          setTimeout(() => {
            this.result = `data:${file.type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
            this.onload?.();
          }, 0);
        }
      }
      globalThis.FileReader = MockFileReader as any;

      try {
        const validFile = new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" });
        const dataUrl = await readImageFileAsDataUrl(validFile);
        expect(dataUrl).toContain("data:image/png;base64,");
      } finally {
        globalThis.FileReader = originalFileReader;
      }
    });
  });

  describe("4. Guest Fallback & Unauthenticated Safety Stress Tests", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it("ensures GUEST_PROFILE constant conforms to safe guest specifications", () => {
      expect(GUEST_PROFILE.isGuest).toBe(true);
      expect(GUEST_PROFILE.handle).toBe("guest");
      expect(GUEST_PROFILE.username).toBe("Guest Listener");
      expect(GUEST_PROFILE.avatarUrl).toBe("/default-avatar.png");
      expect(GUEST_PROFILE.bio).toBe("Sign in to save your profile and track listening statistics.");
      expect(GUEST_PROFILE.isPublic).toBe(false);
    });

    it("renders unauthenticated guest user cleanly without throwing exceptions", async () => {
      useAuthStore.setState({ status: "anonymous", user: null });

      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/profile"] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: "/profile", element: React.createElement(ProfilePage) })
            )
          )
        );
      });

      // Verify safe guest elements rendered in DOM
      expect(container.textContent).toContain("Guest Listener Mode");
      expect(container.textContent).toContain("@guest");
      expect(container.textContent).toContain("Sign in to save your profile and track listening statistics.");

      // Guest banner Sign In link exists
      const signInLink = container.querySelector("a[href='/login']");
      expect(signInLink).toBeDefined();
      expect(signInLink?.textContent).toContain("Sign In");

      // Ensure no edit profile button displayed for guest
      const editButton = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Edit Profile")
      );
      expect(editButton).toBeUndefined();
    });
  });

  describe("5. Persistence & API Error Rollback (HTTP 500 Injection)", () => {
    it("empirically verifies local storage cache is NOT corrupted when API throws 500 error", async () => {
      // 1. Establish valid existing local storage cache
      const originalProfile = {
        id: "usr_active_99",
        handle: "valid_original_handle",
        username: "valid_original_handle",
        displayName: "Original Music Maker",
        bio: "Original uncorrupted bio",
        avatarUrl: "https://liner.fun/avatars/preset_1.png",
        isGuest: false,
        isPublic: true,
      };

      const originalSerialized = JSON.stringify(originalProfile);
      mockStorage.setItem(PROFILE_STORAGE_KEY, originalSerialized);
      mockStorage.setItem(PROFILE_CACHE_KEY, originalSerialized);

      // Verify pre-condition: cache has original profile
      expect(mockStorage.getItem(PROFILE_STORAGE_KEY)).toBe(originalSerialized);
      expect(mockStorage.getItem(PROFILE_CACHE_KEY)).toBe(originalSerialized);

      // 2. Set authenticated user in auth store
      useAuthStore.setState({
        status: "authenticated",
        user: {
          id: "usr_active_99",
          username: "valid_original_handle",
          displayName: "Original Music Maker",
          bio: "Original uncorrupted bio",
          avatarUrl: "https://liner.fun/avatars/preset_1.png",
          isPublic: true,
        },
      });

      // 3. Mock api.updateProfile to simulate an adversarial 500 server crash
      const mockApiError = new Error("500 Internal Server Error: Database failure during profile update");
      const apiSpy = vi.spyOn(api, "updateProfile").mockRejectedValue(mockApiError);

      // 4. Trigger profile update via useAuthStore.getState().updateProfile
      let caughtError: any = null;
      try {
        await useAuthStore.getState().updateProfile({
          username: "corrupted_hacked_handle",
          displayName: "Corrupted Name",
          bio: "Hacked bio payload",
        });
      } catch (err) {
        caughtError = err;
      }

      // Assert error was thrown
      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain("500 Internal Server Error");
      expect(apiSpy).toHaveBeenCalledTimes(1);

      // 5. EMPIRICAL VERIFICATION: Check both local storage keys are COMPLETELY UNTOUCHED
      const currentStorageVal = mockStorage.getItem(PROFILE_STORAGE_KEY);
      const currentCacheVal = mockStorage.getItem(PROFILE_CACHE_KEY);

      expect(currentStorageVal).toBe(originalSerialized);
      expect(currentCacheVal).toBe(originalSerialized);

      const parsedStorage = JSON.parse(currentStorageVal!);
      expect(parsedStorage.handle).toBe("valid_original_handle");
      expect(parsedStorage.displayName).toBe("Original Music Maker");
      expect(parsedStorage.bio).toBe("Original uncorrupted bio");
      expect(parsedStorage.handle).not.toBe("corrupted_hacked_handle");

      // 6. Verify auth store user state remains uncorrupted
      const activeUser = useAuthStore.getState().user;
      expect(activeUser?.username).toBe("valid_original_handle");
      expect(activeUser?.displayName).toBe("Original Music Maker");
      expect(activeUser?.bio).toBe("Original uncorrupted bio");
    });

    it("verifies view model saveProfile re-throws API error and aborts local cache write", async () => {
      // Setup initial cached state
      const initialProfile = {
        id: "usr_view_model_test",
        handle: "stable_handle",
        username: "stable_handle",
        displayName: "Stable User",
        bio: "Stable bio",
        avatarUrl: "/default-avatar.png",
        isGuest: false,
        isPublic: true,
      };

      mockStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(initialProfile));
      mockStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(initialProfile));

      useAuthStore.setState({
        status: "authenticated",
        user: {
          id: "usr_view_model_test",
          username: "stable_handle",
          displayName: "Stable User",
          bio: "Stable bio",
          avatarUrl: "/default-avatar.png",
          isPublic: true,
        },
      });

      // Inject API failure into updateProfile
      vi.spyOn(api, "updateProfile").mockRejectedValue(new Error("500 Internal Server Error"));

      // Render ProfilePage and simulate editing modal save
      let container = document.createElement("div");
      document.body.appendChild(container);
      let root = createRoot(container);

      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/profile"] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: "/profile", element: React.createElement(ProfilePage) })
            )
          )
        );
      });

      // Verify initial profile rendered in page
      expect(container.textContent).toContain("Stable User");
      expect(container.textContent).toContain("@stable_handle");

      // Trigger Edit Profile Modal
      const editButton = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Edit Profile")
      );
      expect(editButton).toBeDefined();

      await act(async () => {
        editButton?.click();
      });

      // Attempt to save through modal form with 500 error injected
      const saveModalButton = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Save Changes")
      );
      expect(saveModalButton).toBeDefined();

      await act(async () => {
        saveModalButton?.click();
      });

      // Assert storage cache was NOT modified or corrupted
      const storageAfterFail = JSON.parse(mockStorage.getItem(PROFILE_STORAGE_KEY)!);
      expect(storageAfterFail.handle).toBe("stable_handle");
      expect(storageAfterFail.bio).toBe("Stable bio");

      // Cleanup
      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
