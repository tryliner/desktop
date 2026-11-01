import { describe, expect, it } from "vitest";
import { applyLyricsSubtitles } from "./lyricsSubtitles";

function renderLines(): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="blyrics--line" data-line-number="0">
      <div class="blyrics-line-main">残酷な天使のテーゼ</div>
    </div>
    <div class="blyrics--line" data-line-number="1" data-blank="true"></div>
    <div class="blyrics--line" data-line-number="2">
      <div class="blyrics-line-main">Hello world</div>
    </div>
    <div class="blyrics--line" data-line-number="3" data-instrumental="true"></div>
  `;
  return container;
}

function line(container: HTMLElement, index: number): HTMLElement {
  return container.querySelector<HTMLElement>(
    `.blyrics--line[data-line-number="${index}"]`,
  )!;
}

function subtitles(container: HTMLElement, index: number): string[] {
  return Array.from(line(container, index).children)
    .filter((el) => el.classList.contains("blyrics-content-line"))
    .map((el) =>
      el.classList.contains("blyrics--romanized") ? "romanized" : "translated",
    );
}

function subtitleText(
  container: HTMLElement,
  index: number,
  kind: "romanized" | "translated",
): string | null {
  return (
    line(container, index)
      .querySelector(`.blyrics--${kind}`)
      ?.textContent?.trim() ?? null
  );
}

const bothVisible = {
  showTranslation: true,
  showRomanization: true,
} as const;

describe("applyLyricsSubtitles", () => {
  it("renders romanization above the translation, under the original line", () => {
    const container = renderLines();

    const changed = applyLyricsSubtitles(container, {
      ...bothVisible,
      translations: ["Lời một", "", "Xin chào thế giới", ""],
      romanizations: ["Zankoku na tenshi no tēze", "", "", ""],
    });

    expect(changed).toBe(true);
    expect(subtitles(container, 0)).toEqual(["romanized", "translated"]);
    expect(subtitleText(container, 0, "romanized")).toBe(
      "Zankoku na tenshi no tēze",
    );
    expect(subtitleText(container, 0, "translated")).toBe("Lời một");
    // The main sung line still comes first.
    expect(line(container, 0).firstElementChild?.className).toBe(
      "blyrics-line-main",
    );
  });

  it("never puts subtitles on blank or instrumental lines", () => {
    const container = renderLines();

    applyLyricsSubtitles(container, {
      ...bothVisible,
      translations: ["a", "b", "c", "d"],
      romanizations: ["e", "f", "g", "h"],
    });

    expect(subtitles(container, 1)).toEqual([]);
    expect(subtitles(container, 3)).toEqual([]);
  });

  it("skips a translation that merely repeats the original line", () => {
    const container = renderLines();

    applyLyricsSubtitles(container, {
      ...bothVisible,
      translations: ["same", "", "Hello world", ""],
      romanizations: ["", "", "", ""],
    });

    expect(subtitleText(container, 2, "translated")).toBeNull();
  });

  it("inserts a later romanization above an existing translation", () => {
    const container = renderLines();
    const translations = ["Lời một", "", "Xin chào", ""];
    const romanizations = ["Zankoku na tenshi no tēze", "", "", ""];

    applyLyricsSubtitles(container, {
      translations,
      romanizations,
      showTranslation: true,
      showRomanization: false,
    });
    expect(subtitles(container, 0)).toEqual(["translated"]);

    applyLyricsSubtitles(container, {
      translations,
      romanizations,
      ...bothVisible,
    });
    expect(subtitles(container, 0)).toEqual(["romanized", "translated"]);
    expect(line(container, 0).querySelectorAll(".blyrics--romanized")).toHaveLength(
      1,
    );
  });

  it("removes subtitles when toggled off and only reports real DOM changes", () => {
    const container = renderLines();
    const kwargs = {
      translations: ["Lời một", "", "Xin chào", ""],
      romanizations: ["Zankoku na tenshi no tēze", "", "", ""],
    };

    expect(
      applyLyricsSubtitles(container, { ...bothVisible, ...kwargs }),
    ).toBe(true);
    // Re-applying the same state is a no-op, so we don't relayout needlessly.
    expect(
      applyLyricsSubtitles(container, { ...bothVisible, ...kwargs }),
    ).toBe(false);

    expect(
      applyLyricsSubtitles(container, {
        ...kwargs,
        showTranslation: false,
        showRomanization: false,
      }),
    ).toBe(true);
    expect(subtitles(container, 0)).toEqual([]);

    expect(
      applyLyricsSubtitles(container, {
        ...kwargs,
        showTranslation: false,
        showRomanization: false,
      }),
    ).toBe(false);
  });

  it("ignores lines without a line number", () => {
    const container = renderLines();
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="blyrics--line"><div class="blyrics-line-main">no index</div></div>`,
    );

    expect(() =>
      applyLyricsSubtitles(container, {
        ...bothVisible,
        translations: ["a"],
        romanizations: ["b"],
      }),
    ).not.toThrow();
  });
});
