import { useState } from "react";

export interface SettledLyricsLayoutInput {
  isMatchingTrack: boolean;
  lyricsLoading: boolean;
  hasLyrics: boolean;
}

export function useSettledLyricsLayout({
  isMatchingTrack,
  lyricsLoading,
  hasLyrics,
}: SettledLyricsLayoutInput): boolean {
  const isResolved = isMatchingTrack && !lyricsLoading;
  const resolvedCompact = isResolved && !hasLyrics;
  const [isCompact, setIsCompact] = useState(resolvedCompact);
  if (isResolved && isCompact !== resolvedCompact) {
    setIsCompact(resolvedCompact);
  }
  return isResolved ? resolvedCompact : isCompact;
}
