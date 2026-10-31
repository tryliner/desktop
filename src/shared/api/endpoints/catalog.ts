import { call } from "../call";
import { clientCatalog } from "../clientCatalog";
import type {
  AlbumDetails,
  ArtistDetails,
  CatalogPlaylistDetails,
  RadioResponse,
  SearchResponse,
  SearchType,
  TrackDetails,
} from "@/shared/contracts";

export const catalogApi = {
  search(q: string, type: SearchType = "all"): Promise<SearchResponse> {
    return clientCatalog.search(q, type, () =>
      call("GET /v1/catalog/search", { query: { q, type } }),
    );
  },

  getTrack(id: string): Promise<TrackDetails> {
    return clientCatalog.getTrack(id, () =>
      call("GET /v1/catalog/tracks/:id", { params: { id } }),
    );
  },

  getRadio(
    id: string,
    options?: { history?: string[]; k?: number },
  ): Promise<RadioResponse> {
    const history = new Set(options?.history ?? []);
    return clientCatalog.getRadio(id, options?.k).then((response) => ({
      items: response.items.filter((item) => !history.has(item.id)),
    }));
  },

  getAlbum(id: string): Promise<AlbumDetails> {
    return clientCatalog.getAlbum(id, () =>
      call("GET /v1/catalog/albums/:id", { params: { id } }),
    );
  },

  getArtistImage(id: string): Promise<string | undefined> {
    return clientCatalog.getArtistImage(id);
  },

  getArtist(id: string): Promise<ArtistDetails> {
    return clientCatalog.getArtist(id, () =>
      call("GET /v1/catalog/artists/:id", { params: { id } }),
    );
  },

  getPlaylist(id: string): Promise<CatalogPlaylistDetails> {
    return clientCatalog.getPlaylist(id, () =>
      call("GET /v1/catalog/playlists/:id", { params: { id } }),
    );
  },
};
