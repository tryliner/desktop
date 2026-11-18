import path from "node:path";
import { app } from "electron";
import { handleTrusted } from "../ipc-guard.js";
import {
  UserMediaLibrary,
  UserMediaRejection,
  type UserMediaRecord,
} from "../user-media/library.js";
import type { MediaMime } from "../user-media/sniff.js";
import type { PlaylistCoverSetResult, PlaylistCoverView } from "./types.js";

/** the renderer crops + re-encodes, so 8 MB is plenty (animated GIFs stay as is) */
export const MAX_PLAYLIST_COVER_BYTES = 8 * 1024 * 1024;

const ACCEPT = new Set<MediaMime>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const id = (value: unknown, max = 200): string | null =>
  typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : null;

function toView(record: UserMediaRecord): PlaylistCoverView {
  return {
    key: record.key,
    playlistId: record.ref,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    updatedAt: record.updatedAt,
  };
}

export function createPlaylistCoverLibrary() {
  return new UserMediaLibrary(
    path.join(app.getPath("userData"), "playlist-covers"),
    { accept: ACCEPT, maxBytes: MAX_PLAYLIST_COVER_BYTES },
  );
}

export function setupPlaylistCovers(library: UserMediaLibrary) {
  handleTrusted(
    "playlist-covers:set",
    async (_event, input: unknown): Promise<PlaylistCoverSetResult> => {
      const raw = (input ?? {}) as Record<string, unknown>;
      const userId = id(raw.userId);
      const playlistId = id(raw.playlistId);
      if (!userId || !playlistId || !(raw.bytes instanceof Uint8Array)) {
        return { ok: false, reason: "invalid" };
      }
      try {
        const record = await library.set(userId, playlistId, raw.bytes);
        return { ok: true, cover: toView(record) };
      } catch (error) {
        return {
          ok: false,
          reason:
            error instanceof UserMediaRejection ? error.reason : "write-failed",
        };
      }
    },
  );

  handleTrusted("playlist-covers:remove", (_event, input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const userId = id(raw.userId);
    const playlistId = id(raw.playlistId);
    if (!userId || !playlistId) return false;
    return library.remove(userId, playlistId);
  });

  handleTrusted("playlist-covers:list", async (_event, userId: unknown) => {
    const owner = id(userId);
    if (!owner) return [];
    return (await library.list(owner)).map(toView);
  });

  handleTrusted("playlist-covers:usage", () => library.usage());
}
