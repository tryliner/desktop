import { applyLyricsOffset } from "../engine/lyricsParser";
import type { LyricsState } from "./lyricsState";

export function getLyricsStateUpdate(
  current: LyricsState,
  state: Parameters<LyricsState["setLyricsState"]>[0],
): Partial<LyricsState> {
  const nextTrackId =
    state.currentLyricsTrackId !== undefined
      ? state.currentLyricsTrackId
      : current.currentLyricsTrackId;
  const isNewTrack =
    state.currentLyricsTrackId !== undefined &&
    state.currentLyricsTrackId !== current.currentLyricsTrackId;

  const offset =
    state.offsetMs !== undefined
      ? state.offsetMs
      : isNewTrack
        ? nextTrackId && current.trackOffsets?.[nextTrackId]
          ? current.trackOffsets[nextTrackId]
          : 0
        : current.offsetMs;

  let baseBraccato =
    state.baseBraccatoLyrics ??
    state.braccatoLyrics ??
    (isNewTrack ? [] : current.baseBraccatoLyrics);
  let baseSynced =
    state.baseSyncedLines ??
    state.syncedLines ??
    (isNewTrack ? [] : current.baseSyncedLines);

  const adjusted = applyLyricsOffset(
    { braccatoLyrics: baseBraccato, syncedLines: baseSynced },
    offset,
  );

  return {
    ...state,
    offsetMs: offset,
    baseBraccatoLyrics: baseBraccato,
    baseSyncedLines: baseSynced,
    braccatoLyrics: adjusted.braccatoLyrics,
    syncedLines: adjusted.syncedLines,
  };
}

export function getLyricsOffsetUpdate(
  current: LyricsState,
  offsetMs: number,
): Partial<LyricsState> {
  const {
    baseBraccatoLyrics,
    baseSyncedLines,
    currentLyricsTrackId,
    trackOffsets,
  } = current;

  const adjusted = applyLyricsOffset(
    { braccatoLyrics: baseBraccatoLyrics, syncedLines: baseSyncedLines },
    offsetMs,
  );

  const updatedTrackOffsets = { ...trackOffsets };
  if (currentLyricsTrackId) {
    if (offsetMs === 0) {
      delete updatedTrackOffsets[currentLyricsTrackId];
    } else {
      updatedTrackOffsets[currentLyricsTrackId] = offsetMs;
    }
  }

  return {
    offsetMs,
    braccatoLyrics: adjusted.braccatoLyrics,
    syncedLines: adjusted.syncedLines,
    trackOffsets: updatedTrackOffsets,
  };
}
