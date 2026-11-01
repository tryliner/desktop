import { groupTokens, isGroup } from "./tokens";
import type { TextMeasure } from "./textMeasure";
import type { LyricLineModel, LyricToken, PlacedToken } from "./types";
import { alignOffset, rowExtents, wrapRuns, type Run } from "./wrapRuns";

export interface BlockFrame {
  left: number;
  width: number;
}

export interface PlacedBlock {
  tokens: PlacedToken[];
  rows: number;
}

interface BlockRun extends Run {
  tokens: LyricToken[];
}

function blockRuns(tokens: LyricToken[], font: string, measure: TextMeasure) {
  const runs: BlockRun[] = [];
  let pendingSpace = "";
  for (const item of groupTokens(tokens)) {
    if (!isGroup(item)) {
      pendingSpace += item.text;
      continue;
    }
    if (runs.length > 0 && pendingSpace) {
      const width = measure.width(font, " ");
      runs.push({ width, inkWidth: 0, breakAfter: true, tokens: [] });
    }
    pendingSpace = "";
    const width = item.tokens.reduce(
      (total, token) => total + measure.width(font, token.text),
      0,
    );
    runs.push({
      width,
      inkWidth: width,
      breakAfter: false,
      tokens: item.tokens,
    });
  }
  return runs;
}

export function layoutBlock(
  line: LyricLineModel,
  tokens: LyricToken[],
  font: string,
  measure: TextMeasure,
  frame: BlockFrame,
  baselineAt: (row: number) => number,
): PlacedBlock {
  const runs = blockRuns(tokens, font, measure);
  const placed = wrapRuns(runs, frame.width);
  const extents = rowExtents(runs, placed);
  const align = line.rtl && line.align === "start" ? "end" : line.align;
  const result: PlacedToken[] = [];
  for (const item of placed) {
    const run = runs[item.index];
    const rowWidth = extents[item.row] ?? 0;
    const shift = frame.left + alignOffset(align, rowWidth, frame.width);
    let cursor = item.x;
    for (const token of run.tokens) {
      const width = measure.width(font, token.text);
      const logical = line.rtl ? rowWidth - cursor - width : cursor;
      result.push({
        token,
        x: shift + logical,
        baseline: baselineAt(item.row),
        width,
      });
      cursor += width;
    }
  }
  return { tokens: result, rows: extents.length };
}
