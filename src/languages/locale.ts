export type Locale = "en" | "ru" | "uk";

const LOCALE_STORAGE_KEY = "liner_locale";

export function getStoredLocale(): Locale {
  if (typeof window === "undefined" || !window.localStorage) return "en";
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "en" || stored === "ru" || stored === "uk") return stored;
  // Handle legacy stored 'ua'
  if (stored === "ua") {
    storeLocale("uk");
    return "uk";
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
  for (const l of langs) {
    const code = l.slice(0, 2).toLowerCase();
    if (code === "en") return "en";
    if (code === "ru") return "ru";
    if (code === "uk" || code === "ua") return "uk";
  }
  return "ru";
}
