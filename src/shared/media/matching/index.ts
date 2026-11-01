export {
  evaluateImportedTrack,
  matchImportedTrack,
  type Match,
  type MatchDecision,
  type MatchRejectionReason,
} from "./evaluate";
export {
  cleanSoundCloudMetadata,
  parseArtistAndTitle,
  type ParsedArtistTitle,
  type SoundCloudMetadata,
} from "./artistTitle";
export {
  cleanBaseTitle,
  cleanSearchTitle,
  cleanTitle,
  stripJunk,
} from "./junk";
export { normalizeWords } from "./phonetic";
export { findCatalogMatch, type TrackMatchOutcome } from "./findCatalogMatch";
export {
  isSameRecording,
  recordingProfile,
  type RecordingProfile,
} from "./sameRecording";
export { getVersionTags } from "./versionTags";
export { artistsMatch } from "./artists";
