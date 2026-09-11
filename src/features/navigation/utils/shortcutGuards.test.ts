import { describe, expect, it, afterEach } from "vitest";
import {
  hasBlockingModifier,
  isBlockingOverlayOpen,
  isKeyHandledByFocusedControl,
  isTypingTarget,
} from "./shortcutGuards";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isTypingTarget", () => {
  it("treats input, textarea and select as typing targets", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
  });

  it("treats a contentEditable element as a typing target", () => {
    const div = document.createElement("div");
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isTypingTarget(div)).toBe(true);
  });

  it("does not treat a plain div or button as a typing target", () => {
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });

  it("returns false for null or non-element targets", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({} as EventTarget)).toBe(false);
  });
});

describe("hasBlockingModifier", () => {
  it("flags ctrl, meta and alt", () => {
    expect(hasBlockingModifier({ ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(hasBlockingModifier({ ctrlKey: false, metaKey: true, altKey: false })).toBe(true);
    expect(hasBlockingModifier({ ctrlKey: false, metaKey: false, altKey: true })).toBe(true);
  });

  it("is false with no modifiers (shift alone is not blocking)", () => {
    expect(hasBlockingModifier({ ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
  });
});

describe("isBlockingOverlayOpen", () => {
  it("is false when nothing is mounted", () => {
    expect(isBlockingOverlayOpen()).toBe(false);
  });

  it("is true when a dialog container is present", () => {
    const el = document.createElement("div");
    el.setAttribute("data-dialog-container", "true");
    document.body.appendChild(el);
    expect(isBlockingOverlayOpen()).toBe(true);
  });

  it("is true when a dropdown menu is present", () => {
    const el = document.createElement("div");
    el.setAttribute("data-dropdown-menu", "true");
    document.body.appendChild(el);
    expect(isBlockingOverlayOpen()).toBe(true);
  });
});

describe("isKeyHandledByFocusedControl", () => {
  it("Space never yields to a focused button, link or role=button — Space always drives global Play/Pause", () => {
    expect(isKeyHandledByFocusedControl(document.createElement("button"), "Space")).toBe(false);

    const link = document.createElement("a");
    link.setAttribute("href", "#");
    expect(isKeyHandledByFocusedControl(link, "Space")).toBe(false);

    const div = document.createElement("div");
    div.setAttribute("role", "button");
    expect(isKeyHandledByFocusedControl(div, "Space")).toBe(false);
  });

  it("Space still yields to non-button widgets like a switch or a tab", () => {
    const switchEl = document.createElement("div");
    switchEl.setAttribute("role", "switch");
    expect(isKeyHandledByFocusedControl(switchEl, "Space")).toBe(true);
  });

  it("Space does not yield to a plain div with no interactive role", () => {
    expect(isKeyHandledByFocusedControl(document.createElement("div"), "Space")).toBe(false);
  });

  it("arrow keys yield to a slider, a range input, and a select", () => {
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    expect(isKeyHandledByFocusedControl(slider, "ArrowUp")).toBe(true);
    expect(isKeyHandledByFocusedControl(slider, "ArrowDown")).toBe(true);
    expect(isKeyHandledByFocusedControl(slider, "ArrowLeft")).toBe(true);
    expect(isKeyHandledByFocusedControl(slider, "ArrowRight")).toBe(true);

    const range = document.createElement("input");
    range.type = "range";
    expect(isKeyHandledByFocusedControl(range, "ArrowUp")).toBe(true);

    expect(isKeyHandledByFocusedControl(document.createElement("select"), "ArrowDown")).toBe(true);
  });

  it("arrow keys do not yield to an unrelated focused element", () => {
    expect(isKeyHandledByFocusedControl(document.createElement("div"), "ArrowUp")).toBe(false);
  });

  it("returns false for keys it doesn't know about (e.g. KeyF)", () => {
    expect(isKeyHandledByFocusedControl(document.createElement("button"), "KeyF")).toBe(false);
  });

  it("returns false for non-element targets", () => {
    expect(isKeyHandledByFocusedControl(null, "Space")).toBe(false);
  });
});
