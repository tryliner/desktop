import { innertubeCatalog } from "@/shared/youtube";
import {
  isSoundCloudCatalogId,
  isSoundCloudUrl,
  resolveSoundCloudUrl,
  soundcloudCatalog,
} from "@/shared/media/soundcloud";
import { isAbortError } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";
import { withSoundCloudTracks } from "./catalogSearch";
import type {
  AlbumDetails,
  ArtistDetails,
  CatalogPlaylistDetails,
  RadioResponse,
  SearchResponse,
  SearchType,
  Track,
  TrackDetails,
} from "@/shared/contracts";

export function isClientCatalogId(id: string): boolean {
  return !isSoundCloudCatalogId(id);
}

async function preferClient<T>(
  label: string,
  client: () => Promise<T>,
  server: () => Promise<T>,
): Promise<T> {
  try {
    return await client();
  } catch (error) {
    if (isAbortError(error)) throw error;
    log(
      "yellow",
      "catalog",
      `${label} failed on client, using server fallback`,
      error,
    );
    return server();
  }
}

const SNAPSHOT_TIMEOUT_MS = 4000;

async function resolveSnapshot(id: string): Promise<Track | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);
  const catalog = isSoundCloudCatalogId(id)
    ? soundcloudCatalog
    : innertubeCatalog;
  try {
    const details = await catalog.getTrack(id, controller.signal);
    return {
      // keep the id the caller asked for: the server files a like under the
      // snapshot id, and the heart is looked up by the playing track's id, so
      // a canonicalised id here makes the like vanish on the next refetch
      id,
      title: details.title,
      artists: details.artists,
      durationMs: details.durationMs,
      ...(details.album ? { album: details.album } : {}),
      ...(details.cover ? { cover: details.cover } : {}),
      ...(details.explicit !== undefined ? { explicit: details.explicit } : {}),
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export const clientCatalog = {
  resolveSnapshot,

  async search(
    query: string,
    type: SearchType,
    server: () => Promise<SearchResponse>,
  ): Promise<SearchResponse> {
    if (isSoundCloudUrl(query))
      return { items: await resolveSoundCloudUrl(query, type).catch(() => []) };
    return withSoundCloudTracks(
      query,
      type,
      preferClient(
        "search",
        async () => ({ items: await innertubeCatalog.search(query, type) }),
        server,
      ),
    );
  },

  getTrack(
    id: string,
    server: () => Promise<TrackDetails>,
  ): Promise<TrackDetails> {
    if (isSoundCloudCatalogId(id)) return soundcloudCatalog.getTrack(id);
    return preferClient("track", () => innertubeCatalog.getTrack(id), server);
  },

  getRadio(
    id: string,
    k: number | undefined,
    server: () => Promise<RadioResponse>,
  ): Promise<RadioResponse> {
    if (isSoundCloudCatalogId(id)) return soundcloudCatalog.getRadio(id, k);
    return preferClient(
      "radio",
      () => innertubeCatalog.getRadio(id, { k }),
      server,
    );
  },

  getAlbum(
    id: string,
    server: () => Promise<AlbumDetails>,
  ): Promise<AlbumDetails> {
    if (isSoundCloudCatalogId(id)) return soundcloudCatalog.getAlbum(id);
    return preferClient("album", () => innertubeCatalog.getAlbum(id), server);
  },

  async getArtistImage(id: string): Promise<string | undefined> {
    if (isSoundCloudCatalogId(id))
      return soundcloudCatalog.getArtistImage(id).catch(() => undefined);
    return innertubeCatalog.getArtistImage(id).catch(() => undefined);
  },

  getArtist(
    id: string,
    server: () => Promise<ArtistDetails>,
  ): Promise<ArtistDetails> {
    if (isSoundCloudCatalogId(id)) return soundcloudCatalog.getArtist(id);
    return preferClient("artist", () => innertubeCatalog.getArtist(id), server);
  },

  getPlaylist(
    id: string,
    server: () => Promise<CatalogPlaylistDetails>,
  ): Promise<CatalogPlaylistDetails> {
    if (isSoundCloudCatalogId(id)) return soundcloudCatalog.getPlaylist(id);
    return preferClient(
      "playlist",
      () => innertubeCatalog.getPlaylist(id),
      server,
    );
  },
};
