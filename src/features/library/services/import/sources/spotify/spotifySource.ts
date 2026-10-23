import type { ClientImportedPlaylist, ClientImportedTrack } from "../../importTypes";
import { rethrowIfAborted } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";
import { fetchSpotifyEmbed } from "./spotifyEmbed";
import { fetchSpotifyPlaylistTracks, type PathfinderResult } from "./spotifyPathfinder";
import { parseSpotifyUrl, resolveSpotifyUrl, toSpotifyUrl, type SpotifyEntityType } from "./spotifyUrl";

function defaultTitle(entityType: SpotifyEntityType): string {
  if (entityType === "album") return "Imported Spotify album";
  if (entityType === "track") return "Imported Spotify track";
  return "Imported Spotify playlist";
}

const EMBED_TRACK_CAP = 100;

export function sanitizeHtml(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const decoded = input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
  return decoded || undefined;
}

async function tryPathfinder(entityId: string, signal?: AbortSignal): Promise<PathfinderResult> {
  try {
    return await fetchSpotifyPlaylistTracks(entityId, signal);
  } catch (error) {
    rethrowIfAborted(signal);
    log("yellow", "import", `spotify pathfinder failed, falling back to the embed page: ${String(error)}`);
    return { tracks: [], total: undefined };
  }
}

function pickPlaylistTracks(full: PathfinderResult, embed: ClientImportedTrack[]): ClientImportedTrack[] {
  if (full.tracks.length > 0 && full.tracks.length >= embed.length) {
    if (full.total !== undefined && full.tracks.length < full.total) {
      log("yellow", "import", `spotify import is partial: ${full.tracks.length} of ${full.total} tracks`);
    }
    return full.tracks;
  }
  if (embed.length >= EMBED_TRACK_CAP) {
    log("yellow", "import", `spotify embed lists only the first ${EMBED_TRACK_CAP} tracks of this playlist`);
  }
  return embed;
}

export async function importSpotify(rawUrl: string, signal?: AbortSignal): Promise<ClientImportedPlaylist> {
  const resolvedUrl = await resolveSpotifyUrl(rawUrl, signal);
  const { type: entityType, id: entityId } = parseSpotifyUrl(resolvedUrl);

  const canonicalUrl = toSpotifyUrl(entityType, entityId);

  // Parallelize embed and Pathfinder queries concurrently
  const embedPromise = fetchSpotifyEmbed(entityType, entityId, defaultTitle(entityType), signal);
  const pathfinderPromise =
    entityType === "playlist" ? tryPathfinder(entityId, signal) : Promise.resolve({ tracks: [], total: undefined });

  const [embed, full] = await Promise.all([embedPromise, pathfinderPromise]);

  const rawTitle = embed.title ?? defaultTitle(entityType);
  const title = sanitizeHtml(rawTitle) ?? defaultTitle(entityType);
  const description = sanitizeHtml(embed.description);

  const base = {
    source: "spotify" as const,
    sourceUrl: canonicalUrl,
    title,
    ...(description ? { description } : {}),
  };

  if (entityType === "playlist") {
    const tracks = pickPlaylistTracks(full, embed.tracks);
    if (tracks.length > 0) return { ...base, tracks };
  }
  if (embed.tracks.length > 0) return { ...base, tracks: embed.tracks };
  throw new Error("No tracks found in the Spotify playlist. Make sure the playlist is public and contains available tracks.");
}
