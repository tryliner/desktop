import { describe, it, expect } from "vitest";
import {
  getEnglishKeyFromEvent,
  normalizeShortcutToEnglish,
  getKeyDisplay,
  splitShortcutParts,
} from "./shortcutUtils";

describe("shortcutUtils", () => {
  describe("getEnglishKeyFromEvent", () => {
    it("maps physical keys via code even when Russian layout is active", () => {
      // User pressed 'O' key with Russian layout active (producing 'щ')
      const event = {
        code: "KeyO",
        key: "щ",
        ctrlKey: false,
        altKey: true,
        shiftKey: true,
        metaKey: false,
      } as unknown as KeyboardEvent;

      expect(getEnglishKeyFromEvent(event)).toBe("O");
    });

    it("maps other letters via physical code", () => {
      expect(getEnglishKeyFromEvent({ code: "KeyA", key: "ф" } as KeyboardEvent)).toBe("A");
      expect(getEnglishKeyFromEvent({ code: "KeyS", key: "ы" } as KeyboardEvent)).toBe("S");
      expect(getEnglishKeyFromEvent({ code: "KeyD", key: "в" } as KeyboardEvent)).toBe("D");
      expect(getEnglishKeyFromEvent({ code: "KeyZ", key: "я" } as KeyboardEvent)).toBe("Z");
    });

    it("falls back to Cyrillic mapping if code is missing", () => {
      expect(getEnglishKeyFromEvent({ code: "", key: "щ" } as KeyboardEvent)).toBe("O");
      expect(getEnglishKeyFromEvent({ code: "", key: "Щ" } as KeyboardEvent)).toBe("O");
      expect(getEnglishKeyFromEvent({ code: "", key: "ф" } as KeyboardEvent)).toBe("A");
      expect(getEnglishKeyFromEvent({ code: "", key: "і" } as KeyboardEvent)).toBe("S");
    });

    it("maps numbers and function keys correctly", () => {
      expect(getEnglishKeyFromEvent({ code: "Digit1", key: "1" } as KeyboardEvent)).toBe("1");
      expect(getEnglishKeyFromEvent({ code: "F5", key: "F5" } as KeyboardEvent)).toBe("F5");
      expect(getEnglishKeyFromEvent({ code: "F12", key: "F12" } as KeyboardEvent)).toBe("F12");
    });

    it("maps Space and special keys correctly", () => {
      expect(getEnglishKeyFromEvent({ code: "Space", key: " " } as KeyboardEvent)).toBe("Space");
      expect(getEnglishKeyFromEvent({ code: "Equal", key: "=" } as KeyboardEvent)).toBe("=");
    });
  });

  describe("normalizeShortcutToEnglish", () => {
    it("normalizes Russian shortcut to canonical English accelerator", () => {
      expect(normalizeShortcutToEnglish("Alt+Shift+Щ")).toBe("Alt+Shift+O");
      expect(normalizeShortcutToEnglish("Ctrl+Shift+ф")).toBe("Control+Shift+A");
      expect(normalizeShortcutToEnglish("Alt+Shift+і")).toBe("Alt+Shift+S");
    });

    it("normalizes modifier variations", () => {
      expect(normalizeShortcutToEnglish("Ctrl+Alt+O")).toBe("Control+Alt+O");
      expect(normalizeShortcutToEnglish("Cmd+Shift+K")).toBe("Command+Shift+K");
    });

    it("leaves standard English shortcuts untouched", () => {
      expect(normalizeShortcutToEnglish("Alt+Shift+O")).toBe("Alt+Shift+O");
      expect(normalizeShortcutToEnglish("Control+Alt+Space")).toBe("Control+Alt+Space");
    });
  });

  describe("getKeyDisplay & splitShortcutParts", () => {
    it("splits accelerator string properly", () => {
      expect(splitShortcutParts("Alt+Shift+O")).toEqual(["Alt", "Shift", "O"]);
      expect(splitShortcutParts("Control+Alt+Space")).toEqual(["Control", "Alt", "Space"]);
    });

    it("provides symbols and labels for keycaps", () => {
      const alt = getKeyDisplay("Alt");
      expect(alt.label).toBe("Alt");
      expect(alt.symbol).toBe("⌥");

      const shift = getKeyDisplay("Shift");
      expect(shift.label).toBe("Shift");
      expect(shift.symbol).toBe("⇧");

      const letter = getKeyDisplay("O");
      expect(letter.label).toBe("O");
      expect(letter.isModifier).toBe(false);
    });
  });
});
