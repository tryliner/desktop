import {
  DEFAULT_APPEARANCE,
  sanitizeAppearance,
  type AppearanceSettings,
} from "./appearanceStore";

/**
 * .linertheme files: colours and wallpaper settings (never the picture
 * itself), small enough to paste into a Discord message.
 */

export const THEME_FILE_EXTENSION = ".linertheme";

const SHAREABLE_KEYS = [
  "preset",
  "accent",
  "blur",
  "dim",
  "saturation",
  "surfaceOpacity",
  "readable",
  "albumBackdrop",
] as const satisfies readonly (keyof AppearanceSettings)[];

type Shareable = Pick<AppearanceSettings, (typeof SHAREABLE_KEYS)[number]>;

export interface ThemeFile {
  liner: "theme";
  version: 1;
  name?: string;
  settings: Shareable;
}

export function exportThemeFile(
  settings: AppearanceSettings,
  name?: string,
): string {
  const shared = Object.fromEntries(
    SHAREABLE_KEYS.map((key) => [key, settings[key]]),
  ) as Shareable;
  const file: ThemeFile = {
    liner: "theme",
    version: 1,
    ...(name ? { name: name.slice(0, 60) } : {}),
    settings: shared,
  };
  return JSON.stringify(file, null, 2);
}

export type ThemeImportError =
  "not-json" | "not-a-theme" | "newer-version" | "invalid";

export type ThemeImportResult =
  | { ok: true; name?: string; settings: Shareable }
  | { ok: false; error: ThemeImportError };

/**
 * Strict on purpose: a file from someone else can only set the known
 * settings, each to a value of the right type, or it's refused as a whole.
 */
export function parseThemeFile(text: string): ThemeImportResult {
  if (text.length > 20_000) return { ok: false, error: "invalid" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "not-json" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "not-a-theme" };
  }
  const file = parsed as Record<string, unknown>;
  if (file.liner !== "theme") return { ok: false, error: "not-a-theme" };
  if (typeof file.version !== "number") return { ok: false, error: "invalid" };
  if (file.version > 1) return { ok: false, error: "newer-version" };
  const settings = file.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { ok: false, error: "invalid" };
  }
  const raw = settings as Record<string, unknown>;
  const allowed = new Set<string>(SHAREABLE_KEYS);
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    return { ok: false, error: "invalid" };
  }
  const clean = sanitizeAppearance(raw, DEFAULT_APPEARANCE);
  // a value that had to be replaced means the file was malformed
  for (const key of Object.keys(raw) as (keyof Shareable)[]) {
    if (clean[key] !== raw[key]) return { ok: false, error: "invalid" };
  }
  const shared = Object.fromEntries(
    SHAREABLE_KEYS.map((key) => [key, clean[key]]),
  ) as Shareable;
  const name =
    typeof file.name === "string" ? file.name.slice(0, 60) : undefined;
  return { ok: true, ...(name ? { name } : {}), settings: shared };
}
