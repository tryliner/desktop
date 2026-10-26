import type { Lyric } from "@braccato/parsers";
import type {
  LyricsCandidate,
  LyricsSyncLevel,
} from "@/shared/contracts/lyrics";
import type { SyncedLine } from "../engine/lyricsParser";

export interface LyricsProviderOption {
  provider: string;
  syncLevel: LyricsSyncLevel;
  quality: number;
  candidate: LyricsCandidate;
}

export function hasSyncedLyricsSources(
  availableProviders: LyricsProviderOption[] = [],
  braccatoLyrics: Lyric[] = [],
  rawFormat: string | null = null,
): boolean {
  if (
    availableProviders.some(
      (p) =>
        (p.syncLevel && p.syncLevel !== "plain") ||
        (p.candidate?.syncLevel && p.candidate.syncLevel !== "plain") ||
        (p.candidate?.lyrics?.format &&
          p.candidate.lyrics.format !== "plain") ||
        (p.candidate?.contentKind && p.candidate.contentKind !== "plain") ||
        (p.candidate?.syncHint && p.candidate.syncHint !== "plain"),
    )
  ) {
    return true;
  }
  if (
    braccatoLyrics.some(
      (l) => (l.startTimeMs ?? 0) > 0 || (l.durationMs ?? 0) > 0,
    )
  ) {
    return true;
  }
  if (rawFormat !== null && rawFormat !== "plain") {
    return true;
  }
  return false;
}

export interface LyricsState {
  lyricsLoading: boolean;
  lyricsError: string | null;
  rawLyrics: string | null;
  rawFormat: string | null;
  baseBraccatoLyrics: Lyric[];
  baseSyncedLines: SyncedLine[];
  braccatoLyrics: Lyric[];
  syncedLines: SyncedLine[];
  plainLyrics: string | null;
  lyricsQuality: number;
  currentLyricsTrackId: string | null;
  activeProvider: string | null;
  availableProviders: LyricsProviderOption[];
  offsetMs: number;
  trackOffsets: Record<string, number>;
  activeLineIndex: number | null;
  showPronunciation: boolean;

  setLyricsState: (
    state: Partial<
      Omit<
        LyricsState,
        | "setLyricsState"
        | "reset"
        | "selectProvider"
        | "setOffset"
        | "adjustOffset"
        | "resetOffset"
        | "setActiveLineIndex"
        | "setShowPronunciation"
      >
    >,
  ) => void;
  setActiveLineIndex: (index: number | null) => void;
  setShowPronunciation: (show: boolean) => void;
  selectProvider: (providerName: string) => void;
  setOffset: (offsetMs: number) => void;
  adjustOffset: (deltaMs: number) => void;
  resetOffset: () => void;
  reset: () => void;
}
