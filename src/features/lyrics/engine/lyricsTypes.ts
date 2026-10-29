import type { Lyric } from "@braccato/parsers";

export interface WordData {
  timeMs: number;
  endMs: number;
  text: string;
  isBackground?: boolean;
}

export interface SyncedLine {
  timeMs: number;
  durationMs?: number;
  text: string;
  isInstrumental?: boolean;
  words?: WordData[];
}

export interface ParsedLyrics {
  braccatoLyrics: Lyric[];
  syncedLines: SyncedLine[];
  plainLyrics: string | null;
  language?: string;
}
