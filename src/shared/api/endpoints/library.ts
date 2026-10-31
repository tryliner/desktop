import { call } from "../call";
import { clientCatalog } from "../clientCatalog";
import { toApiTrack } from "../apiTrack";
import { isLocalTrackId } from "@/shared/media/local";
import type {
  ArtistSnapshotInput,
  CollectionSnapshotInput,
  LikedTracksPage,
  SavedArtists,
  SavedCollections,
} from "@/shared/contracts";

type CollectionKind = "albums" | "artists" | "playlists";

type SaveArgs =
  | [type: "artists", id: string, snapshot: ArtistSnapshotInput]
  | [
      type: "albums" | "playlists",
      id: string,
      snapshot: CollectionSnapshotInput,
    ];

function listSavedCollections(type: "artists"): Promise<SavedArtists>;
function listSavedCollections(
  type: "albums" | "playlists",
): Promise<SavedCollections>;
function listSavedCollections(
  type: CollectionKind,
): Promise<SavedArtists | SavedCollections> {
  if (type === "artists") return call("GET /v1/me/saved/artists");
  if (type === "albums") return call("GET /v1/me/saved/albums");
  return call("GET /v1/me/saved/playlists");
}

export const libraryApi = {
  listLikedTracks(limit = 100, cursor?: string): Promise<LikedTracksPage> {
    return call("GET /v1/me/likes", { query: { limit, cursor } });
  },

  async likeTrack(id: string): Promise<void> {
    if (isLocalTrackId(id)) throw new Error("Local tracks stay on this device");
    const track = toApiTrack(await clientCatalog.resolveSnapshot(id));
    await call("PUT /v1/me/likes/:trackId", {
      params: { trackId: id },
      body: track ? { track } : null,
    });
  },

  async unlikeTrack(id: string): Promise<void> {
    await call("DELETE /v1/me/likes/:trackId", { params: { trackId: id } });
  },

  listSavedCollections,

  async saveCollection(...args: SaveArgs): Promise<void> {
    const [type, id, snapshot] = args;
    if (type === "artists") {
      await call("PUT /v1/me/saved/artists/:artistId", {
        params: { artistId: id },
        body: { snapshot },
      });
    } else if (type === "albums") {
      await call("PUT /v1/me/saved/albums/:albumId", {
        params: { albumId: id },
        body: { snapshot },
      });
    } else {
      await call("PUT /v1/me/saved/playlists/:playlistId", {
        params: { playlistId: id },
        body: { snapshot },
      });
    }
  },

  async removeCollection(type: CollectionKind, id: string): Promise<void> {
    if (type === "artists") {
      await call("DELETE /v1/me/saved/artists/:artistId", {
        params: { artistId: id },
      });
    } else if (type === "albums") {
      await call("DELETE /v1/me/saved/albums/:albumId", {
        params: { albumId: id },
      });
    } else {
      await call("DELETE /v1/me/saved/playlists/:playlistId", {
        params: { playlistId: id },
      });
    }
  },
};
