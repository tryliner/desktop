import type { Lyric } from "@braccato/parsers";
import { buildLines } from "./buildLines";
import { LYRICS_TYPOGRAPHY, loadLyricsFonts, resolveFamily } from "./fonts";
import { layoutLines, type LayoutFrame } from "./layoutLines";
import { createTextMeasure, type TextMeasure } from "./textMeasure";
import { maxScrollFor } from "./scrollPlan";
import type { LineLayout, LyricLineModel, LyricsTypography } from "./types";

const SIDE_INSET = 24;
const TOP_INSET = 32;

export class LyricsScene {
  lines: LyricLineModel[] = [];
  shiftMs = 0;
  timed = true;
  layouts: LineLayout[] = [];
  width = 0;
  height = 0;
  typography: LyricsTypography = LYRICS_TYPOGRAPHY;
  measure: TextMeasure;
  version = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    host: Element,
    private readonly onFontsReady: () => void,
  ) {
    this.typography = { ...LYRICS_TYPOGRAPHY, family: resolveFamily(host) };
    this.measure = createTextMeasure(ctx);
    document.fonts?.addEventListener("loadingdone", this.remeasure);
    void loadLyricsFonts(this.typography).then(this.remeasure);
  }

  private readonly remeasure = () => {
    this.measure = createTextMeasure(this.ctx);
    this.relayout();
    this.onFontsReady();
  };

  dispose() {
    document.fonts?.removeEventListener("loadingdone", this.remeasure);
  }

  get frame(): LayoutFrame {
    const left = SIDE_INSET + this.typography.paddingX;
    return { left, width: Math.max(1, this.width - left * 2), top: TOP_INSET };
  }

  setLyrics(lyrics: Lyric[]) {
    const model = buildLines(lyrics);
    this.lines = model.lines;
    this.shiftMs = model.shiftMs;
    this.timed = model.timed;
    this.relayout();
    const text = lyrics.map((line) => line.words ?? "").join("\n");
    void loadLyricsFonts(this.typography, text);
  }

  setSize(width: number, height: number) {
    const widthChanged = width !== this.width;
    this.width = width;
    this.height = height;
    if (widthChanged) this.relayout();
  }

  relayout() {
    this.version += 1;
    this.layouts =
      this.width > 0
        ? layoutLines(this.lines, this.measure, this.typography, this.frame)
        : [];
  }

  maxScroll(): number {
    return maxScrollFor(this.layouts, this.height);
  }

  lineAt(y: number, scroll: number): number | null {
    const contentY = y + scroll;
    const index = this.layouts.findIndex(
      (layout) =>
        contentY >= layout.top && contentY < layout.top + layout.height,
    );
    return index >= 0 ? index : null;
  }
}
