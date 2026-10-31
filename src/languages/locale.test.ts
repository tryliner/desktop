import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStoredLocale,
  storeLocale,
  getBrowserLocale,
  SUPPORTED_LOCALES,
} from "./locale";
import { translations } from "./data";
import { LOCALE_OPTIONS } from "./options";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function stubBrowserLanguages(languages: string[]) {
  vi.stubGlobal("window", { navigator: { language: languages[0], languages } });
}

describe("locale", () => {
  beforeEach(() => {
    const storage = createStorage();
    vi.stubGlobal("window", {
      localStorage: storage,
      navigator: { language: "en-US", languages: ["en-US"] },
    });
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("defaults to en", () => {
    expect(getStoredLocale()).toBe("en");
  });

  it.each(SUPPORTED_LOCALES)("stores and retrieves %s", (locale) => {
    storeLocale(locale);
    expect(getStoredLocale()).toBe(locale);
  });

  it("migrates legacy 'ua' stored value to 'uk'", () => {
    localStorage.setItem("liner_locale", "ua");
    expect(getStoredLocale()).toBe("uk");
    expect(localStorage.getItem("liner_locale")).toBe("uk");
  });

  it("falls back to browser locale on invalid stored value", () => {
    localStorage.setItem("liner_locale", "nl");
    expect(getStoredLocale()).toBe("en");
  });
});

describe("getBrowserLocale", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["ru-RU", "ru"],
    ["es-ES", "es"],
    ["uk-UA", "uk"],
    ["ua-UA", "uk"],
    ["de-DE", "de"],
    ["it-IT", "it"],
    ["fr-FR", "fr"],
    ["pl-PL", "pl"],
    ["tr-TR", "tr"],
    ["pt-BR", "pt"],
    ["pt-PT", "pt"],
    ["en-GB", "en"],
    ["vi-VN", "vi"],
  ])(
    "returns the matching locale when navigator.language is %s",
    (language, expected) => {
      stubBrowserLanguages([language, "en-US"]);
      expect(getBrowserLocale()).toBe(expected);
    },
  );

  it("falls back to ru for unknown locales", () => {
    stubBrowserLanguages(["nl-NL"]);
    expect(getBrowserLocale()).toBe("ru");
  });

  it("returns ru on server side", () => {
    vi.stubGlobal("window", undefined);
    expect(getBrowserLocale()).toBe("ru");
  });
});

describe("registered locales", () => {
  it("ships a translation file and a picker option for every supported locale", () => {
    const pickerValues = LOCALE_OPTIONS.map((option) => option.value).sort();
    expect(pickerValues).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(translations[locale]).length).toBeGreaterThan(0);
    }
  });
});
