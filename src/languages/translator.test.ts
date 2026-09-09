import { describe, it, expect } from "vitest";
import { flatten, t, formatTemplate, createTranslatorSync, type TranslationDict } from "./translator";

const mockDict: TranslationDict = {
  "common.loading": "Loading...",
  "common.signed_in": "Signed in as {user}",
  "player.queue_empty": "Queue is empty",
  "settings.tabs.general": "General",
  "common.added_to_library": "Added {type} to library",
};

describe("flatten", () => {
  it("flattens nested object with prefix", () => {
    const result = flatten({ name: "Liner", nested: { key: "val" } }, "common");
    expect(result).toEqual({ "common.name": "Liner", "common.nested.key": "val" });
  });

  it("handles empty objects", () => {
    expect(flatten({}, "test")).toEqual({});
  });

  it("skips non-string values", () => {
    const result = flatten({ str: "hello", num: 42, arr: [1] }, "a");
    expect(result).toEqual({ "a.str": "hello" });
  });

  it("works without prefix", () => {
    expect(flatten({ key: "val" })).toEqual({ key: "val" });
  });

  it("handles deep nesting", () => {
    const result = flatten({ a: { b: { c: "deep" } } }, "x");
    expect(result).toEqual({ "x.a.b.c": "deep" });
  });
});

describe("t", () => {
  it("looks up simple keys", () => {
    expect(t(mockDict, "common.loading")).toBe("Loading...");
  });

  it("returns the key itself when missing", () => {
    expect(t(mockDict, "nonexistent.key")).toBe("nonexistent.key");
  });

  it("interpolates template variables", () => {
    expect(t(mockDict, "common.signed_in", { user: "Alice" })).toBe("Signed in as Alice");
  });

  it("interpolates multiple variables", () => {
    expect(t(mockDict, "common.added_to_library", { type: "playlist" })).toBe("Added playlist to library");
  });

  it("returns key when dict is undefined", () => {
    expect(t(undefined as any, "some.key")).toBe("some.key");
  });
});

describe("formatTemplate", () => {
  it("replaces all {var} placeholders with replaceAll", () => {
    expect(formatTemplate("Hello {name}, welcome {name}!", { name: "World" })).toBe("Hello World, welcome World!");
  });

  it("leaves text unchanged when no placeholders", () => {
    expect(formatTemplate("Plain text", {})).toBe("Plain text");
  });

  it("leaves unmatched placeholders as-is", () => {
    expect(formatTemplate("Hi {name}", { other: "val" })).toBe("Hi {name}");
  });

  it("handles empty template string", () => {
    expect(formatTemplate("", { x: "y" })).toBe("");
  });
});

describe("createTranslatorSync with plurals", () => {
  it("translates and pluralizes correctly in Russian", () => {
    const tRu = createTranslatorSync("ru");
    expect(tRu("common.loading")).toBe("Загрузка");
    expect(tRu("common.tracks", { count: 1 })).toBe("1 трек");
    expect(tRu("common.tracks", { count: 3 })).toBe("3 трека");
    expect(tRu("common.tracks", { count: 5 })).toBe("5 треков");
    expect(tRu("common.tracks", { count: 21 })).toBe("21 трек");
  });

  it("translates and pluralizes correctly in Ukrainian", () => {
    const tUk = createTranslatorSync("uk");
    expect(tUk("common.loading")).toBe("Завантаження");
    expect(tUk("common.tracks", { count: 1 })).toBe("1 трек");
    expect(tUk("common.tracks", { count: 2 })).toBe("2 треки");
    expect(tUk("common.tracks", { count: 10 })).toBe("10 треків");
  });

  it("falls back to English when key is missing in target locale", () => {
    const tRu = createTranslatorSync("ru");
    expect(tRu("common.app.name")).toBe("Liner");
  });
});
