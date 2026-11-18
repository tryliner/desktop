export interface PlaylistCoverView {
  /** 20-hex key; served as liner-local://playlist-cover/<key> */
  key: string;
  playlistId: string;
  mimeType: string;
  byteSize: number;
  /** epoch ms, appended to the url to bust caches */
  updatedAt: number;
}

export type PlaylistCoverSetResult =
  | { ok: true; cover: PlaylistCoverView }
  | {
      ok: false;
      reason:
        "invalid" | "unsupported-type" | "too-large" | "empty" | "write-failed";
    };

export interface PlaylistCoverSetInput {
  userId: string;
  playlistId: string;
  bytes: Uint8Array;
}
