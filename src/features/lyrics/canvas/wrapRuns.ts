export interface Run {
  width: number;
  inkWidth: number;
  breakAfter: boolean;
}

export interface PlacedRun {
  index: number;
  row: number;
  x: number;
}

function chunkRuns(runs: Run[]): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  runs.forEach((run, index) => {
    current.push(index);
    if (run.breakAfter) {
      chunks.push(current);
      current = [];
    }
  });
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function chunkInk(runs: Run[], chunk: number[]): number {
  let width = 0;
  chunk.forEach((index, position) => {
    width +=
      position === chunk.length - 1 ? runs[index].inkWidth : runs[index].width;
  });
  return width;
}

export function wrapRuns(runs: Run[], maxWidth: number): PlacedRun[] {
  const placed: PlacedRun[] = [];
  let row = 0;
  let x = 0;
  for (const chunk of chunkRuns(runs)) {
    if (x > 0 && x + chunkInk(runs, chunk) > maxWidth) {
      row += 1;
      x = 0;
    }
    for (const index of chunk) {
      if (x > 0 && x + runs[index].inkWidth > maxWidth) {
        row += 1;
        x = 0;
      }
      placed.push({ index, row, x });
      x += runs[index].width;
    }
  }
  return placed;
}

export function rowExtents(runs: Run[], placed: PlacedRun[]): number[] {
  const extents: number[] = [];
  for (const item of placed) {
    const end = item.x + runs[item.index].inkWidth;
    extents[item.row] = Math.max(extents[item.row] ?? 0, end);
  }
  return extents;
}

export function alignOffset(
  align: "start" | "end" | "center",
  rowWidth: number,
  maxWidth: number,
): number {
  if (align === "end") return maxWidth - rowWidth;
  if (align === "center") return (maxWidth - rowWidth) / 2;
  return 0;
}
