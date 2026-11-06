import { ApiError } from "../apiError";
import { call } from "../call";
import { clientCatalog } from "../clientCatalog";
import { toApiTrack } from "../apiTrack";
import { DEFAULT_TIMEOUT_MS } from "../http/fetchWithTimeout";
import { isLocalTrackId } from "@/shared/media/local";
import type {
  AddItemsResult,
  ApiBody,
  ApiRoute,
  Track,
  UserPlaylist,
  UserPlaylistDetails,
} from "@/shared/contracts";

export type UserPlaylistRead =
  | { notModified: true }
  | ({ notModified: false; etag?: string } & UserPlaylistDetails);

const ADD_ITEMS = "POST /v1/playlists/:playlistId/items" satisfies ApiRoute;

function addItems(
  playlistId: string,
  tracks: ApiBody<typeof ADD_ITEMS>["tracks"],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AddItemsResult> {
  return call(
    ADD_ITEMS,
    { params: { playlistId }, body: { tracks } },
    { timeoutMs },
  );
}

export const playlistsApi = {
  listPlaylists(): Promise<{ items: UserPlaylist[] }> {
    return call("GET /v1/me/playlists");
  },

  async readUserPlaylist(
    id: string,
    options: { limit?: number; etag?: string } = {},
  ): Promise<UserPlaylistRead> {
    let status = 200;
    let etag: string | undefined;
    const body = await call(
      "GET /v1/playlists/:playlistId",
      {
        params: { playlistId: id },
        query: { limit: options.limit || undefined },
      },
      {
        ...(options.etag ? { headers: { "If-None-Match": options.etag } } : {}),
        onResponse: (res) => {
          status = res.status;
          etag = res.headers?.get?.("etag") ?? undefined;
        },
      },
    );
    if (status === 304 || !body) return { notModified: true };
    return { notModified: false, etag, ...body };
  },

  getSharedPlaylist(id: string): Promise<UserPlaylistDetails> {
    return call("GET /v1/playlists/:playlistId", {
      params: { playlistId: id },
    });
  },

  createPlaylist(
    input: ApiBody<"POST /v1/me/playlists">,
  ): Promise<UserPlaylist> {
    return call("POST /v1/me/playlists", { body: input });
  },

  updatePlaylist(
    id: string,
    input: ApiBody<"PATCH /v1/playlists/:playlistId">,
  ): Promise<UserPlaylist> {
    return call("PATCH /v1/playlists/:playlistId", {
      params: { playlistId: id },
      body: input,
    });
  },

  // public: anyone signed in can open it and its share link; private: owner only
  setPlaylistVisibility(id: string, isPublic: boolean): Promise<UserPlaylist> {
    return call("PUT /v1/playlists/:playlistId/visibility", {
      params: { playlistId: id },
      body: { public: isPublic },
    });
  },

  async deletePlaylist(id: string): Promise<void> {
    await call("DELETE /v1/playlists/:playlistId", {
      params: { playlistId: id },
    });
  },

  async addPlaylistTrack(
    playlistId: string,
    trackId: string,
  ): Promise<AddItemsResult> {
    if (isLocalTrackId(trackId))
      throw new Error("Local tracks stay on this device");
    const track = toApiTrack(await clientCatalog.resolveSnapshot(trackId));
    return addItems(playlistId, [track ?? { id: trackId }]);
  },

  addPlaylistTrackSnapshots(
    playlistId: string,
    tracks: Track[],
  ): Promise<AddItemsResult> {
    return addItems(
      playlistId,
      tracks.map((track) => toApiTrack(track) ?? track),
      60_000,
    );
  },

  async removePlaylistItem(playlistId: string, itemId: string): Promise<void> {
    try {
      await call("DELETE /v1/playlists/:playlistId/items/:itemId", {
        params: { playlistId, itemId },
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "ITEM_NOT_FOUND") return;
      throw err;
    }
  },

  movePlaylistItem(
    playlistId: string,
    itemId: string,
    beforeItemId: string | null,
    revision: number,
  ): Promise<UserPlaylist> {
    return call("POST /v1/playlists/:playlistId/items/:itemId/move", {
      params: { playlistId, itemId },
      body: { beforeItemId, revision },
    });
  },
};
