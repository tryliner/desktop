import { useMemo } from "react";
import type { Lyric } from "@braccato/parsers";
import { romanizationKey } from "../engine/romanizationPreference";
import { useLyricsDisplayStore } from "../store/lyricsDisplayStore";
import { useLyricsStore } from "../store/lyricsStore";

export function useRomanizationPreference(lyrics: Lyric[]) {
  const trackId = useLyricsStore((state) => state.currentLyricsTrackId);
  const key = useMemo(
    () => romanizationKey(trackId, lyrics),
    [trackId, lyrics],
  );
  const mode = useLyricsDisplayStore(
    (state) => state.languageOverrides[key] ?? "auto",
  );
  return { key, mode };
}
