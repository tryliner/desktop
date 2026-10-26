export const SUPPORTED_LOCALES = [
  "en",
  "ru",
  "uk",
  "es",
  "de",
  "it",
  "fr",
  "pl",
  "tr",
  "pt",
  "id",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_STORAGE_KEY = "liner_locale";

const LANGUAGE_ALIASES: Record<string, Locale> = { ua: "uk" };

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined" || !window.localStorage) return "en";
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && isLocale(stored)) return stored;
  if (stored && LANGUAGE_ALIASES[stored]) {
    storeLocale(LANGUAGE_ALIASES[stored]);
    return LANGUAGE_ALIASES[stored];
  }
  return getBrowserLocale();
}

export function storeLocale(locale: Locale): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function getBrowserLocale(): Locale {
  if (typeof window === "undefined") return "ru";
  const langs = window.navigator.languages ?? [window.navigator.language];
  for (const language of langs) {
    const code = language.slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
    if (LANGUAGE_ALIASES[code]) return LANGUAGE_ALIASES[code];
  }
  return "ru";
}
