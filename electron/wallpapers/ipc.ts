import crypto from "node:crypto";
import path from "node:path";
import { app } from "electron";
import { handleTrusted } from "../ipc-guard.js";
import {
  UserMediaLibrary,
  UserMediaRejection,
  type UserMediaRecord,
} from "../user-media/library.js";
import type { MediaMime } from "../user-media/sniff.js";
import type { WallpaperAddResult, WallpaperView } from "./types.js";

export const MAX_WALLPAPER_BYTES = 60 * 1024 * 1024;
export const MAX_WALLPAPERS = 8;
const OWNER = "device";

const ACCEPT = new Set<MediaMime>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
]);

function toView(record: UserMediaRecord): WallpaperView {
  return {
    key: record.key,
    kind: record.mimeType.startsWith("video/") ? "video" : "image",
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    addedAt: record.updatedAt,
  };
}

export function createWallpaperLibrary() {
  return new UserMediaLibrary(
    path.join(app.getPath("userData"), "wallpapers"),
    {
      accept: ACCEPT,
      maxBytes: MAX_WALLPAPER_BYTES,
      maxPerOwner: MAX_WALLPAPERS,
    },
  );
}

export function setupWallpapers(library: UserMediaLibrary) {
  handleTrusted(
    "wallpapers:add",
    async (_event, bytes: unknown): Promise<WallpaperAddResult> => {
      if (!(bytes instanceof Uint8Array))
        return { ok: false, reason: "invalid" };
      const ref = crypto.createHash("sha1").update(bytes).digest("hex");
      try {
        return {
          ok: true,
          wallpaper: toView(await library.set(OWNER, ref, bytes)),
        };
      } catch (error) {
        return {
          ok: false,
          reason:
            error instanceof UserMediaRejection ? error.reason : "write-failed",
        };
      }
    },
  );

  handleTrusted("wallpapers:list", async () =>
    (await library.list(OWNER)).map(toView),
  );

  handleTrusted("wallpapers:remove", (_event, key: unknown) =>
    typeof key === "string" ? library.removeKey(key, OWNER) : false,
  );
}
