import { describe, it, expect } from "vitest";
import {
  SONG_TRANSLATION_SYSTEM_PROMPT,
  SONG_SINGABLE_TRANSLATION_SYSTEM_PROMPT,
  SONG_ROMANIZATION_SYSTEM_PROMPT,
} from "./services/aiTranslateService";

describe("AI Lyrics Translation Prompts", () => {
  it("generates correct system prompt enforcing line-by-line parity", () => {
    const prompt = SONG_TRANSLATION_SYSTEM_PROMPT("English", "Vietnamese");
    expect(prompt).toContain("Maintain line-by-line parity");
    expect(prompt).toContain("poetic song translator");
    expect(prompt).toContain("Vietnamese");
  });

  it("generates a romanization prompt that forbids translation", () => {
    expect(SONG_ROMANIZATION_SYSTEM_PROMPT).toContain("Maintain line-by-line parity");
    expect(SONG_ROMANIZATION_SYSTEM_PROMPT).toContain("Hepburn Romaji");
    expect(SONG_ROMANIZATION_SYSTEM_PROMPT).toContain("Do NOT translate");
  });

  it("generates musical singable prompt with syllable and rhyme rules", () => {
    const singablePrompt = SONG_SINGABLE_TRANSLATION_SYSTEM_PROMPT(
      "Japanese",
      "English",
    );
    expect(singablePrompt).toContain("singable");
    expect(singablePrompt).toContain("SYLLABLE COUNT & CADENCE");
    expect(singablePrompt).toContain("RHYME & TONAL MELODY");

    const prompt = SONG_TRANSLATION_SYSTEM_PROMPT("Japanese", "English", true);
    expect(prompt).toContain("SYLLABLE COUNT & CADENCE");
  });
});
