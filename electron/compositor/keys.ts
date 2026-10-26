export type Modifier = "CTRL" | "ALT" | "SHIFT" | "SUPER";

export interface KeyCombo {
  modifiers: Modifier[];
  key: string;
  code: number | null;
}

const LETTER_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const LETTER_ROW_START = [24, 38, 52];
const NAMED_CODES: Record<string, number> = {
  space: 65,
  Up: 111,
  Down: 116,
  Left: 113,
  Right: 114,
  F11: 95,
  F12: 96,
};

function keycodeFor(key: string): number | null {
  for (const [row, letters] of LETTER_ROWS.entries()) {
    const index = letters.indexOf(key);
    if (index >= 0) return (LETTER_ROW_START[row] ?? 0) + index;
  }
  if (/^[1-9]$/.test(key)) return 9 + Number(key);
  if (key === "0") return 19;
  const fKey = /^F([1-9]|10)$/.exec(key);
  if (fKey) return 66 + Number(fKey[1]);
  return NAMED_CODES[key] ?? null;
}

const MODIFIERS: Record<string, Modifier> = {
  command: "SUPER",
  cmd: "SUPER",
  commandorcontrol: "CTRL",
  cmdorctrl: "CTRL",
  control: "CTRL",
  ctrl: "CTRL",
  alt: "ALT",
  option: "ALT",
  altgr: "ALT",
  shift: "SHIFT",
  super: "SUPER",
  meta: "SUPER",
};

const KEYSYMS: Record<string, string> = {
  space: "space",
  plus: "plus",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  enter: "Return",
  return: "Return",
  tab: "Tab",
  backspace: "BackSpace",
  delete: "Delete",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageup: "Prior",
  pagedown: "Next",
  esc: "Escape",
  escape: "Escape",
  mediaplaypause: "XF86AudioPlay",
  medianexttrack: "XF86AudioNext",
  mediaprevioustrack: "XF86AudioPrev",
  mediastop: "XF86AudioStop",
  volumeup: "XF86AudioRaiseVolume",
  volumedown: "XF86AudioLowerVolume",
  volumemute: "XF86AudioMute",
};

function toKeysym(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (KEYSYMS[lower]) return KEYSYMS[lower];
  if (/^f([1-9]|1\d|2[0-4])$/.test(lower)) return lower.toUpperCase();
  if (/^[a-z0-9]$/.test(lower)) return lower;
  return null;
}

export function parseAccelerator(accelerator: string): KeyCombo | null {
  const parts = accelerator
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const keyPart = parts.pop();
  if (!keyPart) return null;
  const modifiers: Modifier[] = [];
  for (const part of parts) {
    const modifier = MODIFIERS[part.toLowerCase()];
    if (!modifier) return null;
    if (!modifiers.includes(modifier)) modifiers.push(modifier);
  }
  const key = toKeysym(keyPart);
  return key ? { modifiers, key, code: keycodeFor(key) } : null;
}
