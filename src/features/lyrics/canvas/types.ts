export type LineAlign = "start" | "end" | "center";

export interface LyricToken {
  text: string;
  startMs: number;
  durationMs: number;
  background: boolean;
  space: boolean;
}

export interface LyricLineModel {
  startMs: number;
  durationMs: number;
  endMs: number;
  nextStartMs: number;
  align: LineAlign;
  rtl: boolean;
  instrumental: boolean;
  tokens: LyricToken[];
  subtitle: string | null;
}

export interface LyricsModel {
  lines: LyricLineModel[];
  shiftMs: number;
  timed: boolean;
}

export interface PlacedToken {
  token: LyricToken;
  x: number;
  baseline: number;
  width: number;
}

export interface PlacedText {
  text: string;
  x: number;
  baseline: number;
}

export interface LineLayout {
  line: LyricLineModel;
  top: number;
  height: number;
  tokens: PlacedToken[];
  subtitle: PlacedText[];
}

export interface LyricsTypography {
  family: string;
  size: number;
  weight: number;
  lineHeight: number;
  paddingY: number;
  paddingX: number;
}
