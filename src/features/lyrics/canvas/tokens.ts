import type { LyricPart } from "@braccato/parsers";
import type { LyricToken } from "./types";

const LINE_SYNCED_DELAY_MS = 50;
const SPACE = /^\s+$/u;

export interface WordGroup {
  background: boolean;
  tokens: LyricToken[];
}

export type LineItem = WordGroup | LyricToken;

function splitPart(part: LyricPart): LyricToken[] {
  const chunks = part.words.match(/\s+|\S+/gu) ?? [];
  const letters = chunks
    .filter((chunk) => !SPACE.test(chunk))
    .reduce((total, chunk) => total + chunk.length, 0);
  let cursor = 0;
  return chunks.map((chunk): LyricToken => {
    const background = part.isBackground === true;
    if (SPACE.test(chunk)) {
      return {
        text: chunk,
        startMs: 0,
        durationMs: 0,
        background,
        space: true,
      };
    }
    const at = (offset: number) =>
      part.startTimeMs + Math.round((part.durationMs * offset) / letters);
    const startMs = at(cursor);
    cursor += chunk.length;
    return {
      text: chunk,
      startMs,
      durationMs: at(cursor) - startMs,
      background,
      space: false,
    };
  });
}

export function lineSyncedParts(text: string, startMs: number): LyricPart[] {
  let wordIndex = 0;
  return (text.match(/\s+|\S+/gu) ?? []).map((chunk): LyricPart => {
    const part = {
      startTimeMs: startMs + wordIndex * LINE_SYNCED_DELAY_MS,
      words: chunk,
      durationMs: 0,
    };
    if (!SPACE.test(chunk)) wordIndex += 1;
    return part;
  });
}

export function tokenize(parts: LyricPart[]): LyricToken[] {
  return parts.flatMap(splitPart);
}

export function groupTokens(tokens: LyricToken[]): LineItem[] {
  const items: LineItem[] = [];
  let current: WordGroup | null = null;
  for (const token of tokens) {
    if (token.space) {
      current = null;
      items.push(token);
      continue;
    }
    if (!current || current.background !== token.background) {
      current = { background: token.background, tokens: [] };
      items.push(current);
    }
    current.tokens.push(token);
  }
  return items;
}

export function isGroup(item: LineItem): item is WordGroup {
  return "tokens" in item;
}
