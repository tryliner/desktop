import type { LineLayout } from "./types";

export const SCROLL_TIME_OFFSET_MS = 500;
export const TARGET_RATIO = 0.37;
const EARLY_SCROLL_CONSIDER_MS = 540;
const ENDING_THRESHOLD_MS = 500;

export interface ScrollTarget {
  active: number[];
  scrollTop: number;
  anchor: number;
  overflows: boolean;
}

export function activeLineIndices(layouts: LineLayout[], scrollTime: number) {
  const active: number[] = [];
  layouts.forEach(({ line }, index) => {
    if (
      scrollTime >= line.startMs - EARLY_SCROLL_CONSIDER_MS &&
      (scrollTime < line.nextStartMs || scrollTime < line.endMs)
    ) {
      active.push(index);
    }
  });
  return active.length > 0 || layouts.length === 0 ? active : [0];
}

function findAnchor(layouts: LineLayout[], sung: number[], scrollTime: number) {
  const running = sung.filter((index) => {
    const { line } = layouts[index];
    return line.startMs <= scrollTime && scrollTime < line.endMs;
  });
  const started = sung.filter(
    (index) => layouts[index].line.startMs <= scrollTime,
  );
  return running.at(-1) ?? started.at(-1) ?? sung[0];
}

export function scrollTarget(
  layouts: LineLayout[],
  scrollTime: number,
  viewportHeight: number,
): ScrollTarget {
  const active = activeLineIndices(layouts, scrollTime);
  const sung = active.filter(
    (index, position) =>
      scrollTime < layouts[index].line.endMs - ENDING_THRESHOLD_MS ||
      position === active.length - 1,
  );
  const anchorIndex = findAnchor(layouts, sung, scrollTime);
  const first = layouts[sung[0]];
  const last = layouts[sung[sung.length - 1]];
  const anchor = layouts[anchorIndex];
  const centre =
    sung.reduce(
      (total, index) => total + layouts[index].top + layouts[index].height / 2,
      0,
    ) / sung.length;
  let scrollTop = centre - viewportHeight * TARGET_RATIO;
  scrollTop = Math.max(scrollTop, last.top + last.height - viewportHeight);
  scrollTop = Math.min(scrollTop, last.top);
  scrollTop = Math.min(scrollTop, first.top);
  scrollTop = Math.max(scrollTop, anchor.top + anchor.height - viewportHeight);
  scrollTop = Math.min(scrollTop, anchor.top);
  return {
    active,
    scrollTop,
    anchor: anchorIndex,
    overflows: last.top + last.height - first.top > viewportHeight,
  };
}

export function maxScrollFor(layouts: LineLayout[], viewportHeight: number) {
  const last = layouts[layouts.length - 1];
  if (!last) return 0;
  const content = last.top + last.height;
  const tail = 1 - TARGET_RATIO;
  const bottom = Math.max(
    last.top + last.height / 2 + viewportHeight * tail - content,
    viewportHeight - content,
    viewportHeight * tail - last.height / 2,
    0,
  );
  return Math.max(0, content + Math.ceil(bottom) - viewportHeight);
}
