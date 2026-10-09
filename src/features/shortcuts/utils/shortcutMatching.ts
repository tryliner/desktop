import {
  getEnglishKeyFromEvent,
  normalizeShortcutToEnglish,
  splitShortcutParts,
  getKeyDisplay,
} from "@/features/overlay/lib/shortcutUtils";

export {
  getEnglishKeyFromEvent,
  normalizeShortcutToEnglish,
  splitShortcutParts,
  getKeyDisplay,
};

/**
 * Checks if a shortcut string contains at least one modifier key.
 */
export function hasModifier(shortcut: string): boolean {
  if (!shortcut) return false;
  const parts = splitShortcutParts(shortcut).map((p) => p.toLowerCase());
  return parts.some((p) =>
    ["control", "ctrl", "alt", "option", "shift", "command", "cmd", "meta"].includes(p)
  );
}

/**
 * Converts a KeyboardEvent into a canonical English accelerator string.
 * Returns null if only a modifier key is pressed or key is unsupported.
 */
export function getEventAccelerator(e: KeyboardEvent): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
    return null;
  }

  const englishKey = getEnglishKeyFromEvent(e);
  if (!englishKey) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Command");
  parts.push(englishKey);

  return normalizeShortcutToEnglish(parts.join("+"));
}

/**
 * Checks whether an incoming KeyboardEvent matches the target shortcut.
 * Ensures layout independence (Cyrillic to English QWERTY remapping)
 * and strict modifier matching.
 */
export function matchesShortcut(e: KeyboardEvent, targetShortcut: string): boolean {
  if (!targetShortcut) return false;

  const targetNormalized = normalizeShortcutToEnglish(targetShortcut);
  if (!targetNormalized) return false;

  const eventAccelerator = getEventAccelerator(e);
  if (!eventAccelerator) return false;

  return eventAccelerator.toLowerCase() === targetNormalized.toLowerCase();
}

export function isMacPlatform(): boolean {
  if (typeof window !== "undefined" && window.linerElectron?.platform) {
    return window.linerElectron.platform === "darwin";
  }
  if (typeof navigator !== "undefined") {
    return (
      /mac|iphone|ipad|ipod/i.test(navigator.platform || "") ||
      /mac/i.test(navigator.userAgent || "")
    );
  }
  return false;
}

/**
 * Pretty-formats an accelerator string for UI rendering.
 */
export function formatAcceleratorForDisplay(accelerator: string): string {
  if (!accelerator) return "None";
  const isMac = isMacPlatform();
  return splitShortcutParts(accelerator)
    .map((p) => {
      const lower = p.toLowerCase();
      if (lower === "control" || lower === "ctrl" || lower === "commandorcontrol") return "Ctrl";
      if (lower === "command" || lower === "cmd" || lower === "meta" || lower === "super") {
        return isMac ? "Cmd" : "Win";
      }
      if (lower === "alt" || lower === "option") return isMac ? "Opt" : "Alt";
      if (lower === "shift") return "Shift";
      if (lower === "space") return "Space";
      return p;
    })
    .join(" + ");
}

/**
 * Splits an accelerator string into individual styled keycap labels (e.g. ["Shift", "Ctrl", "L"]).
 */
export function getAcceleratorKeycaps(accelerator: string): string[] {
  if (!accelerator) return ["None"];
  const isMac = isMacPlatform();
  return splitShortcutParts(accelerator).map((p) => {
    const lower = p.toLowerCase();
    if (lower === "control" || lower === "ctrl" || lower === "commandorcontrol") return "Ctrl";
    if (lower === "command" || lower === "cmd" || lower === "meta" || lower === "super") {
      return isMac ? "⌘" : "Win";
    }
    if (lower === "alt" || lower === "option") return isMac ? "⌥" : "Alt";
    if (lower === "shift") return isMac ? "⇧" : "Shift";
    if (lower === "space") return "Space";
    if (lower === "right" || lower === "arrowright") return "Right";
    if (lower === "left" || lower === "arrowleft") return "Left";
    if (lower === "up" || lower === "arrowup") return "Up";
    if (lower === "down" || lower === "arrowdown") return "Down";
    return p;
  });
}

