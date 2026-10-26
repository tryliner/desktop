export type {
  ClientImportedTrack,
  ClientImportedPlaylist,
} from "./importTypes";
export { detectImportSource, ImportUrlError } from "./detectImportSource";
export { parseImportSource } from "./parseImportSource";
export {
  evaluateImportedTrack,
  matchImportedTrack,
  type Match,
  type MatchDecision,
  type MatchRejectionReason,
} from "@/shared/media/matching";
export {
  cleanSoundCloudMetadata,
  parseArtistAndTitle,
  type ParsedArtistTitle,
  type SoundCloudMetadata,
} from "@/shared/media/matching";
export {
  cleanBaseTitle,
  cleanSearchTitle,
  cleanTitle,
  stripJunk,
} from "@/shared/media/matching";
export { importYoutube } from "./sources/youtube/youtubeSource";
export { importDeezer } from "./sources/deezerSource";
export {
  importSoundCloud,
  type SoundCloudImportOptions,
} from "./sources/soundcloud/soundcloudSource";
export { importSpotify } from "./sources/spotify/spotifySource";
export { importAppleMusic } from "./sources/appleMusic/appleMusicSource";
