/**
 * Cyrillic to English QWERTY keyboard layout mapping.
 * Used as a fallback when KeyboardEvent.code is unavailable or generic.
 */
export const CYRILLIC_TO_QWERTY_MAP: Record<string, string> = {
  // Russian standard JCUKEN
  "й": "Q", "ц": "W", "у": "E", "к": "R", "е": "T", "н": "Y", "г": "U", "ш": "I", "щ": "O", "з": "P", "х": "[", "ъ": "]",
  "ф": "A", "ы": "S", "в": "D", "а": "F", "п": "G", "р": "H", "о": "J", "л": "K", "д": "L", "ж": ";", "э": "'",
  "я": "Z", "ч": "X", "с": "C", "м": "V", "и": "B", "т": "N", "ь": "M", "б": ",", "ю": ".", "ё": "`",
  // Ukrainian additions
  "і": "S", "ї": "]", "є": "'", "ґ": "\\",
};

/**
 * Maps a KeyboardEvent to a canonical English key suitable for Electron globalShortcut accelerators.
 * Uses event.code first to ensure layout-independent physical key detection,
 * with fallbacks for non-standard environments.
 */
export function getEnglishKeyFromEvent(e: KeyboardEvent): string | null {
  const code = e.code;

  // 1. Primary: map by physical key position via event.code (always QWERTY layout)
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3).toUpperCase();
  }

  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }

  if (/^F\d{1,2}$/i.test(code)) {
    return code.toUpperCase();
  }

  if (code.startsWith("Numpad") && /^\d$/.test(code.slice(6))) {
    return code.slice(6);
  }

  // Named keys in Electron accelerator format
  switch (code) {
    case "Space":
      return "Space";
    case "Tab":
      return "Tab";
    case "Enter":
    case "NumpadEnter":
      return "Return";
    case "Backspace":
      return "Backspace";
    case "Delete":
      return "Delete";
    case "Insert":
      return "Insert";
    case "Home":
      return "Home";
    case "End":
      return "End";
    case "PageUp":
      return "PageUp";
    case "PageDown":
      return "PageDown";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    case "Semicolon":
      return ";";
    case "Quote":
      return "'";
    case "Backquote":
      return "`";
    case "Comma":
      return ",";
    case "Period":
      return ".";
    case "Slash":
      return "/";
    case "Backslash":
      return "\\";
    case "Minus":
    case "NumpadSubtract":
      return "-";
    case "Equal":
      return "=";
    case "NumpadAdd":
      return "Plus";
    default:
      break;
  }

  // 2. Fallback: check Cyrillic characters to map them to QWERTY
  const lowerKey = e.key.toLowerCase();
  if (CYRILLIC_TO_QWERTY_MAP[lowerKey]) {
    return CYRILLIC_TO_QWERTY_MAP[lowerKey];
  }

  // 3. Fallback: standard ASCII character
  if (/^[a-zA-Z0-9]$/.test(e.key)) {
    return e.key.toUpperCase();
  }

  if (e.key === " ") return "Space";
  if (e.key === "+") return "Plus";

  return null;
}

/**
 * Normalizes any shortcut string to ensure only canonical English keys and Electron modifiers.
 * Converts any Cyrillic or non-English characters to English QWERTY equivalents.
 */
export function normalizeShortcutToEnglish(shortcut: string): string {
  if (!shortcut || typeof shortcut !== "string") return "";

  const parts = shortcut.split("+").map((p) => p.trim()).filter(Boolean);
  const modifiers: string[] = [];
  let mainKey = "";

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "control" || lower === "ctrl" || lower === "commandorcontrol") {
      if (!modifiers.includes("Control")) modifiers.push("Control");
    } else if (lower === "alt" || lower === "option") {
      if (!modifiers.includes("Alt")) modifiers.push("Alt");
    } else if (lower === "shift") {
      if (!modifiers.includes("Shift")) modifiers.push("Shift");
    } else if (lower === "command" || lower === "cmd" || lower === "meta" || lower === "super") {
      if (!modifiers.includes("Command")) modifiers.push("Command");
    } else {
      // Map main key to English QWERTY if it's Cyrillic
      if (CYRILLIC_TO_QWERTY_MAP[lower]) {
        mainKey = CYRILLIC_TO_QWERTY_MAP[lower];
      } else if (lower === "space") {
        mainKey = "Space";
      } else if (lower === "plus" || lower === "+") {
        mainKey = "Plus";
      } else if (/^f\d{1,2}$/i.test(part)) {
        mainKey = part.toUpperCase();
      } else if (part.length === 1 && /^[a-zA-Z0-9]$/.test(part)) {
        mainKey = part.toUpperCase();
      } else {
        mainKey = part.toUpperCase();
      }
    }
  }

  if (mainKey) {
    modifiers.push(mainKey);
  }

  return modifiers.join("+");
}

export interface KeyCapDisplay {
  label: string;
  symbol?: string;
  isModifier: boolean;
}

/**
 * Returns formatted labels and symbols for pretty keycap rendering.
 */
export function getKeyDisplay(part: string): KeyCapDisplay {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const p = part.toLowerCase();

  if (p === "control" || p === "ctrl" || p === "commandorcontrol") {
    return { label: isMac ? "Control" : "Ctrl", symbol: "⌃", isModifier: true };
  }
  if (p === "alt" || p === "option") {
    return { label: isMac ? "Option" : "Alt", symbol: "⌥", isModifier: true };
  }
  if (p === "shift") {
    return { label: "Shift", symbol: "⇧", isModifier: true };
  }
  if (p === "command" || p === "cmd" || p === "meta") {
    return { label: isMac ? "Cmd" : "Win", symbol: isMac ? "⌘" : "⊞", isModifier: true };
  }
  if (p === "return" || p === "enter") {
    return { label: "Enter", symbol: "↵", isModifier: false };
  }
  if (p === "space") {
    return { label: "Space", symbol: "␣", isModifier: false };
  }
  if (p === "plus") {
    return { label: "+", isModifier: false };
  }
  return { label: part.toUpperCase(), isModifier: false };
}

/**
 * Splits an accelerator string into its component keys.
 */
export function splitShortcutParts(shortcut: string): string[] {
  if (!shortcut) return [];
  return shortcut.split("+").map((p) => p.trim()).filter(Boolean);
}
