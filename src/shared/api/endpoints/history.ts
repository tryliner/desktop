import { call } from "../call";
import type {
  DailyMixesResponse,
  MostSavedResponse,
  MostSavedType,
  PlaybackHistoryResponse,
  PopularAlbumsResponse,
  PopularTimeWindow,
  PopularTracksResponse,
  RecordPlaybackEventRequest,
} from "@/shared/contracts";

export const historyApi = {
  async recordPlaybackEvent(
    payload: RecordPlaybackEventRequest,
  ): Promise<void> {
    await call("POST /v1/me/history", { body: payload });
  },

  getHistory(cursor?: string, limit = 30): Promise<PlaybackHistoryResponse> {
    return call("GET /v1/me/history", { query: { limit, cursor } });
  },

  getPopularTracks(
    window: PopularTimeWindow = "7d",
    limit = 50,
  ): Promise<PopularTracksResponse> {
    return call("GET /v1/charts/tracks", { query: { window, limit } });
  },

  getPopularAlbums(
    window: PopularTimeWindow = "7d",
    limit = 20,
  ): Promise<PopularAlbumsResponse> {
    return call("GET /v1/charts/albums", { query: { window, limit } });
  },

  getMostSaved(
    type: MostSavedType = "all",
    limit = 20,
  ): Promise<MostSavedResponse> {
    return call("GET /v1/charts/saved", { query: { type, limit } });
  },

  getDailyMixes(): Promise<DailyMixesResponse> {
    return call("GET /v1/me/mixes");
  },
};
