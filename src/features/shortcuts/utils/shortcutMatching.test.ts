import { describe, it, expect } from "vitest";
import {
  matchesShortcut,
  hasModifier,
  formatAcceleratorForDisplay,
  getAcceleratorKeycaps,
  getEventAccelerator,
} from "./shortcutMatching";

function mockKeyEvent(init: {
  code?: string;
  key?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}): KeyboardEvent {
  return {
    code: init.code ?? "",
    key: init.key ?? "",
    ctrlKey: Boolean(init.ctrlKey),
    altKey: Boolean(init.altKey),
    shiftKey: Boolean(init.shiftKey),
    metaKey: Boolean(init.metaKey),
  } as unknown as KeyboardEvent;
}

describe("shortcutMatching", () => {
  describe("matchesShortcut with 1-button shortcuts", () => {
    it("matches Space", () => {
      const event = mockKeyEvent({ code: "Space", key: " " });
      expect(matchesShortcut(event, "Space")).toBe(true);
    });

    it("rejects Space if modifier is held (e.g. Ctrl+Space)", () => {
      const event = mockKeyEvent({ code: "Space", key: " ", ctrlKey: true });
      expect(matchesShortcut(event, "Space")).toBe(false);
    });

    it("matches letter key M", () => {
      const event = mockKeyEvent({ code: "KeyM", key: "m" });
      expect(matchesShortcut(event, "M")).toBe(true);
    });

    it("matches ArrowLeft and ArrowRight", () => {
      const leftEvent = mockKeyEvent({ code: "ArrowLeft", key: "ArrowLeft" });
      expect(matchesShortcut(leftEvent, "Left")).toBe(true);

      const rightEvent = mockKeyEvent({ code: "ArrowRight", key: "ArrowRight" });
      expect(matchesShortcut(rightEvent, "Right")).toBe(true);
    });

    it("matches bracket keys [ and ]", () => {
      const leftBracket = mockKeyEvent({ code: "BracketLeft", key: "[" });
      expect(matchesShortcut(leftBracket, "[")).toBe(true);

      const rightBracket = mockKeyEvent({ code: "BracketRight", key: "]" });
      expect(matchesShortcut(rightBracket, "]")).toBe(true);
    });

    it("matches Slash /", () => {
      const slash = mockKeyEvent({ code: "Slash", key: "/" });
      expect(matchesShortcut(slash, "/")).toBe(true);
    });
  });

  describe("matchesShortcut with 2-button shortcuts", () => {
    it("matches Control+Right", () => {
      const event = mockKeyEvent({ code: "ArrowRight", key: "ArrowRight", ctrlKey: true });
      expect(matchesShortcut(event, "Control+Right")).toBe(true);
      expect(matchesShortcut(event, "Ctrl+Right")).toBe(true);
    });

    it("rejects Control+Right if Shift is also held (Control+Shift+Right)", () => {
      const event = mockKeyEvent({
        code: "ArrowRight",
        key: "ArrowRight",
        ctrlKey: true,
        shiftKey: true,
      });
      expect(matchesShortcut(event, "Control+Right")).toBe(false);
    });

    it("matches Alt+L", () => {
      const event = mockKeyEvent({ code: "KeyL", key: "l", altKey: true });
      expect(matchesShortcut(event, "Alt+L")).toBe(true);
    });
  });

  describe("matchesShortcut with 3-button shortcuts", () => {
    it("matches Alt+Shift+O", () => {
      const event = mockKeyEvent({
        code: "KeyO",
        key: "o",
        altKey: true,
        shiftKey: true,
      });
      expect(matchesShortcut(event, "Alt+Shift+O")).toBe(true);
    });

    it("matches Alt+Shift+L", () => {
      const event = mockKeyEvent({
        code: "KeyL",
        key: "l",
        altKey: true,
        shiftKey: true,
      });
      expect(matchesShortcut(event, "Alt+Shift+L")).toBe(true);
    });
  });

  describe("Cyrillic layout remapping", () => {
    it("matches Alt+Shift+L when Russian layout key 'д' is pressed", () => {
      const event = mockKeyEvent({
        code: "KeyL",
        key: "д",
        altKey: true,
        shiftKey: true,
      });
      expect(matchesShortcut(event, "Alt+Shift+L")).toBe(true);
    });

    it("falls back to Cyrillic char if code is empty", () => {
      const event = mockKeyEvent({
        code: "",
        key: "д",
        altKey: true,
        shiftKey: true,
      });
      expect(matchesShortcut(event, "Alt+Shift+L")).toBe(true);
    });
  });

  describe("hasModifier", () => {
    it("returns false for single keys", () => {
      expect(hasModifier("Space")).toBe(false);
      expect(hasModifier("L")).toBe(false);
      expect(hasModifier("Left")).toBe(false);
    });

    it("returns true for combos with modifiers", () => {
      expect(hasModifier("Control+Right")).toBe(true);
      expect(hasModifier("Ctrl+L")).toBe(true);
      expect(hasModifier("Alt+Shift+O")).toBe(true);
      expect(hasModifier("Alt+Shift+L")).toBe(true);
    });
  });

  describe("formatAcceleratorForDisplay", () => {
    it("formats accelerators cleanly", () => {
      expect(formatAcceleratorForDisplay("Control+Right")).toBe("Ctrl + Right");
      expect(formatAcceleratorForDisplay("Alt+Shift+O")).toBe("Alt + Shift + O");
      expect(formatAcceleratorForDisplay("Space")).toBe("Space");
      expect(formatAcceleratorForDisplay("")).toBe("None");
    });
  });

  describe("getAcceleratorKeycaps", () => {
    it("formats arrow keys as clean unified text", () => {
      expect(getAcceleratorKeycaps("Control+Right")).toEqual(["Ctrl", "Right"]);
      expect(getAcceleratorKeycaps("Control+Left")).toEqual(["Ctrl", "Left"]);
      expect(getAcceleratorKeycaps("Up")).toEqual(["Up"]);
      expect(getAcceleratorKeycaps("Down")).toEqual(["Down"]);
    });

    it("formats modifiers and special keys", () => {
      expect(getAcceleratorKeycaps("Alt+Shift+L")).toEqual(["Alt", "Shift", "L"]);
      expect(getAcceleratorKeycaps("Space")).toEqual(["Space"]);
      expect(getAcceleratorKeycaps("")).toEqual(["None"]);
    });
  });
});
