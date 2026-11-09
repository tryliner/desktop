import fs from "node:fs";
import path from "node:path";
import type { Rect } from "./window-drag.js";

export type SavedWindowState = {
  remember: boolean;
  bounds?: Rect;
  maximized?: boolean;
};

export type WindowSnapshot = {
  bounds: Rect;
  maximized: boolean;
};

const MIN_VISIBLE_PX = 64;
const SAVE_DEBOUNCE_MS = 400;

function isRect(value: unknown): value is Rect {
  if (!value || typeof value !== "object") return false;
  const rect = value as Record<string, unknown>;
  return (
    [rect.x, rect.y, rect.width, rect.height].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) &&
    (rect.width as number) > 0 &&
    (rect.height as number) > 0
  );
}

export function parseWindowState(raw: unknown): SavedWindowState {
  if (!raw || typeof raw !== "object") return { remember: false };
  const data = raw as Record<string, unknown>;
  const state: SavedWindowState = { remember: data.remember === true };
  if (isRect(data.bounds)) {
    const { x, y, width, height } = data.bounds;
    state.bounds = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  }
  if (typeof data.maximized === "boolean") state.maximized = data.maximized;
  return state;
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width < MIN_VISIBLE_PX || height < MIN_VISIBLE_PX) return 0;
  return width * height;
}

export function restorableBounds(
  state: SavedWindowState,
  workAreas: Rect[],
  minimum: { width: number; height: number },
): Rect | null {
  const saved = state.bounds;
  if (!state.remember || !saved) return null;
  let best: Rect | null = null;
  let bestOverlap = 0;
  for (const area of workAreas) {
    const overlap = overlapArea(saved, area);
    if (overlap > bestOverlap) {
      best = area;
      bestOverlap = overlap;
    }
  }
  if (!best) return null;
  const width = Math.min(Math.max(saved.width, minimum.width), best.width);
  const height = Math.min(Math.max(saved.height, minimum.height), best.height);
  const x = Math.min(Math.max(saved.x, best.x), best.x + best.width - width);
  const y = Math.min(Math.max(saved.y, best.y), best.y + best.height - height);
  return { x, y, width, height };
}

export function createWindowStateStore(filePath: string) {
  let state = load();
  let pending: (() => WindowSnapshot | null) | null = null;
  let timer: NodeJS.Timeout | null = null;

  function load(): SavedWindowState {
    try {
      return parseWindowState(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch {
      return { remember: false };
    }
  }

  function write() {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(state));
    } catch (error) {
      console.warn("window state save failed", error);
    }
  }

  function capture() {
    const read = pending;
    pending = null;
    if (timer) clearTimeout(timer);
    timer = null;
    const snapshot = read?.();
    if (!snapshot || !state.remember) return;
    state = { ...state, ...snapshot };
    write();
  }

  return {
    get: (): SavedWindowState => state,
    remembers: () => state.remember,
    setRemember(remember: boolean, snapshot: WindowSnapshot | null) {
      state = remember && snapshot ? { remember, ...snapshot } : { remember };
      write();
    },
    track(read: () => WindowSnapshot | null) {
      if (!state.remember) return;
      pending = read;
      if (timer) clearTimeout(timer);
      timer = setTimeout(capture, SAVE_DEBOUNCE_MS);
    },
    flush(read?: () => WindowSnapshot | null) {
      if (read) pending = read;
      capture();
    },
  };
}
