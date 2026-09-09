import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredLocale, storeLocale, getBrowserLocale } from "./locale";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("locale", () => {
  beforeEach(() => {
    const storage = createStorage();
    vi.stubGlobal("window", { localStorage: storage, navigator: { language: "en-US", languages: ["en-US"] } });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US"] });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("defaults to en", () => {
    expect(getStoredLocale()).toBe("en");
  });

  it("stores and retrieves locale", () => {
    storeLocale("ru");
    expect(getStoredLocale()).toBe("ru");
    storeLocale("uk");
    expect(getStoredLocale()).toBe("uk");
  });

  it("migrates legacy 'ua' stored value to 'uk'", () => {
    localStorage.setItem("liner_locale", "ua");
    expect(getStoredLocale()).toBe("uk");
    expect(localStorage.getItem("liner_locale")).toBe("uk");
  });

  it("falls back to browser locale on invalid stored value", () => {
    localStorage.setItem("liner_locale", "de");
    expect(getStoredLocale()).toBe("en");
  });
});

describe("getBrowserLocale", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns ru when navigator.language is ru-RU", () => {
    vi.stubGlobal("window", { navigator: { language: "ru-RU", languages: ["ru-RU", "en-US"] } });
    vi.stubGlobal("navigator", {
      ...navigator,
      language: "ru-RU",
      languages: ["ru-RU", "en-US"],
    });
    expect(getBrowserLocale()).toBe("ru");
    vi.unstubAllGlobals();
  });

  it("returns uk when navigator.language is uk-UA or ua-UA", () => {
    vi.stubGlobal("window", { navigator: { language: "uk-UA", languages: ["uk-UA", "ru-RU"] } });
    vi.stubGlobal("navigator", {
      ...navigator,
      language: "uk-UA",
      languages: ["uk-UA", "ru-RU"],
    });
    expect(getBrowserLocale()).toBe("uk");
    vi.unstubAllGlobals();
  });

  it("falls back to ru for unknown locales", () => {
    vi.stubGlobal("window", { navigator: { language: "fr-FR", languages: ["fr-FR"] } });
    vi.stubGlobal("navigator", {
      ...navigator,
      language: "fr-FR",
      languages: ["fr-FR"],
    });
    expect(getBrowserLocale()).toBe("ru");
  });

  it("returns ru on server side", () => {
    vi.stubGlobal("window", undefined);
    expect(getBrowserLocale()).toBe("ru");
  });
});
