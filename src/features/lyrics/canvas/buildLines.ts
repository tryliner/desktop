import type { Lyric } from "@braccato/parsers";
import { lineSyncedParts, tokenize } from "./tokens";
import type { LineAlign, LyricLineModel, LyricsModel } from "./types";

const RICHSYNC_SHIFT_MS = 150;
const LINE_SYNC_SHIFT_MS = 115;
const RTL =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Mandaic}\p{Script=Hanifi_Rohingya}\p{Script=Samaritan}\p{Script=Yezidi}\p{Script=Mende_Kikakui}\p{Script=Old_Hungarian}]/u;
const LTR =
  /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u;

function alignFor(agent: string | undefined): LineAlign {
  if (agent === "v2" || agent === "v3") return "end";
  if (agent === "v1000") return "center";
  return "start";
}

function isRtl(text: string): boolean {
  for (const char of text) {
    if (RTL.test(char)) return true;
    if (LTR.test(char)) return false;
  }
  return false;
}

function hasTimedParts(lyrics: Lyric[]): boolean {
  return lyrics.some(
    (line) =>
      !line.isInstrumental &&
      line.parts?.some((part) => part.durationMs !== 0) === true,
  );
}

function subtitleOf(line: Lyric): string | null {
  const text = line.translation?.text ?? line.romanization ?? null;
  return text && text.trim() ? text.trim() : null;
}

function hasTiming(lyrics: Lyric[]): boolean {
  return lyrics.some((line) => line.startTimeMs !== 0 || line.durationMs !== 0);
}

export function buildLines(lyrics: Lyric[]): LyricsModel {
  const lines = lyrics.map((line, index): LyricLineModel => {
    const words = line.words ?? "";
    const parts =
      line.parts && line.parts.length > 0
        ? line.parts
        : lineSyncedParts(words, line.startTimeMs);
    return {
      startMs: line.startTimeMs,
      durationMs: line.durationMs,
      endMs: line.startTimeMs + line.durationMs,
      nextStartMs: lyrics[index + 1]?.startTimeMs ?? Number.POSITIVE_INFINITY,
      align: alignFor(line.agent),
      rtl: isRtl(words),
      instrumental: Boolean(line.isInstrumental),
      tokens: line.isInstrumental ? [] : tokenize(parts),
      subtitle: subtitleOf(line),
    };
  });
  return {
    lines,
    shiftMs: hasTimedParts(lyrics) ? RICHSYNC_SHIFT_MS : LINE_SYNC_SHIFT_MS,
    timed: hasTiming(lyrics),
  };
}
