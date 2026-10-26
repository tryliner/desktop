export {
  parseRawLyrics,
  applyLyricsOffset,
  type ParsedLyrics,
  type WordData,
} from "./engine/lyricsParser";
export { braccatoThemeCss } from "./engine/braccatoTheme";
export { decorateLyricsLines } from "./engine/lyricsAnnotations";
export {
  useLyricsStore,
  hasSyncedLyricsSources,
  type LyricsProviderOption,
} from "./store/lyricsStore";
export {
  lyricsCache,
  shouldCacheLyricsCandidate,
  compareLyricsCandidates,
  isBetterLyricsCandidate,
  isWordLevelSync,
  type CachedLyricsItem,
} from "./store/lyricsCache";
export {
  useLyricsAnimator,
  type LyricsWord,
  type SyncedLine,
} from "./hooks/useLyricsAnimator";
export { LyricsProviderIsland } from "./ui/LyricsProviderIsland";
export { LyricsPronunciationToggle } from "./ui/LyricsPronunciationToggle";
