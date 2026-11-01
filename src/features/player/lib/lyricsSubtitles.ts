/**
 * Braccato renders one `.blyrics--line` per lyric, in input order, and exposes
 * that index as `data-line-number`. It has no built-in translation or
 * romanization support in the version we ship, so we layer subtitle rows into
 * each line ourselves.
 *
 * Keeping this as a plain DOM function (rather than inline in the React
 * component) makes the rendering rules testable: output order, blank and
 * instrumental lines, and toggling subtitles back off.
 */
export interface LyricsSubtitleOptions {
  translations?: string[];
  romanizations?: string[];
  showTranslation: boolean;
  showRomanization: boolean;
}

const LINE_SELECTOR = ".blyrics--line";
const MAIN_SELECTOR = ".blyrics-line-main";
const TRANSLATED_SELECTOR = ".blyrics--translated";
const ROMANIZED_SELECTOR = ".blyrics--romanized";

function writeSubtitle(
  lineEl: HTMLElement,
  selector: string,
  className: string,
  text: string,
  insertBeforeTranslation: boolean,
): boolean {
  const existing = lineEl.querySelector<HTMLElement>(selector);

  if (!text) {
    if (!existing) return false;
    existing.remove();
    return true;
  }

  let el = existing;
  let changed = false;

  if (!el) {
    el = document.createElement("div");
    el.className = `${className} blyrics-content-line`;
    el.dir = "auto";
    // Romanization sits directly under the original line, translation below
    // it, no matter which of the two was fetched first.
    if (insertBeforeTranslation) {
      const translated = lineEl.querySelector<HTMLElement>(TRANSLATED_SELECTOR);
      if (translated) lineEl.insertBefore(el, translated);
      else lineEl.appendChild(el);
    } else {
      lineEl.appendChild(el);
    }
    changed = true;
  }

  if (el.textContent !== text) {
    el.textContent = text;
    changed = true;
  }

  return changed;
}

/**
 * Applies the current subtitle state to an already-rendered Braccato view.
 * Returns true when the DOM changed, so the caller can ask the renderer to
 * re-measure the now-taller lines (otherwise scroll targets drift).
 */
export function applyLyricsSubtitles(
  container: HTMLElement,
  {
    translations,
    romanizations,
    showTranslation,
    showRomanization,
  }: LyricsSubtitleOptions,
): boolean {
  let changed = false;

  for (const lineEl of container.querySelectorAll<HTMLElement>(LINE_SELECTOR)) {
    const index = Number(lineEl.dataset.lineNumber);
    if (!Number.isFinite(index)) continue;

    const isBlank = lineEl.dataset.blank === "true";
    const isInstrumental = lineEl.dataset.instrumental === "true";
    const mainText =
      lineEl.querySelector<HTMLElement>(MAIN_SELECTOR)?.textContent?.trim() ??
      "";

    const romanization =
      isBlank || isInstrumental || !showRomanization
        ? ""
        : (romanizations?.[index]?.trim() ?? "");
    changed =
      writeSubtitle(
        lineEl,
        ROMANIZED_SELECTOR,
        "blyrics--romanized",
        romanization,
        true,
      ) || changed;

    const candidate =
      isBlank || isInstrumental || !showTranslation
        ? ""
        : (translations?.[index]?.trim() ?? "");
    // Never repeat the original line (e.g. when the target language matches
    // the song's language).
    const translation = candidate && candidate !== mainText ? candidate : "";
    changed =
      writeSubtitle(
        lineEl,
        TRANSLATED_SELECTOR,
        "blyrics--translated",
        translation,
        false,
      ) || changed;
  }

  return changed;
}
