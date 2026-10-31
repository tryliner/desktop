import { mkdir } from "node:fs/promises";
import path from "node:path";
import { app, ipcMain, shell } from "electron";
import { SavedTrackLibrary } from "./library.js";
import type {
  SavedLyricsState,
  SavedTrackInput,
  SavedTrackMeta,
} from "./types.js";

const MAX_LYRICS_JSON_LENGTH = 2_000_000;
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_COVER_BYTES = 10 * 1024 * 1024;
const LYRICS_STATES = new Set<SavedLyricsState>(["found", "missing"]);

const text = (value: unknown, max = 500): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : undefined;

function toMeta(value: unknown): SavedTrackMeta | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const trackId = text(raw.trackId, 200);
  const title = text(raw.title);
  if (!trackId || !title) return null;
  const durationMs =
    typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs)
      ? Math.max(0, Math.round(raw.durationMs))
      : 0;
  const optional = {
    album: text(raw.album),
    albumId: text(raw.albumId, 200),
    artistId: text(raw.artistId, 200),
    coverUrl: text(raw.coverUrl, 2000),
  };
  return {
    trackId,
    title,
    artists: text(raw.artists) ?? "",
    durationMs,
    ...Object.fromEntries(
      Object.entries(optional).filter(([, entry]) => entry !== undefined),
    ),
    ...(raw.explicit === true ? { explicit: true } : {}),
  };
}

function toBytes(value: unknown, max: number): Uint8Array | null {
  if (!(value instanceof Uint8Array)) return null;
  if (value.byteLength === 0 || value.byteLength > max) return null;
  return value;
}

function acceptableLyrics(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  try {
    return JSON.stringify(value).length <= MAX_LYRICS_JSON_LENGTH;
  } catch {
    return false;
  }
}

function toInput(value: unknown): SavedTrackInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const meta = toMeta(raw.meta);
  const audio = toBytes(raw.audio, MAX_AUDIO_BYTES);
  const mimeType = text(raw.mimeType, 100);
  if (!meta || !audio || !mimeType) return null;
  const rawCover = raw.cover as Record<string, unknown> | undefined;
  const coverData = rawCover ? toBytes(rawCover.data, MAX_COVER_BYTES) : null;
  const coverMime = rawCover ? text(rawCover.mimeType, 100) : undefined;
  const lyricsState = LYRICS_STATES.has(raw.lyricsState as SavedLyricsState)
    ? (raw.lyricsState as SavedLyricsState)
    : undefined;
  const lyricsOk = lyricsState === "found" && acceptableLyrics(raw.lyrics);
  return {
    meta,
    audio,
    mimeType,
    ...(coverData && coverMime
      ? { cover: { data: coverData, mimeType: coverMime } }
      : {}),
    ...(lyricsState === "missing" ? { lyricsState } : {}),
    ...(lyricsOk ? { lyricsState: "found" as const, lyrics: raw.lyrics } : {}),
  };
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];

const savedTracksRoot = () =>
  path.join(app.getPath("userData"), "saved-tracks");

export function createSavedTrackLibrary() {
  return new SavedTrackLibrary(savedTracksRoot());
}

export function setupSavedTracks(library: SavedTrackLibrary) {
  ipcMain.handle("saved-tracks:list", () => library.list());

  ipcMain.handle("saved-tracks:save", (_event, input: unknown) => {
    const parsed = toInput(input);
    return parsed ? library.saveTrack(parsed) : null;
  });

  ipcMain.handle("saved-tracks:remove", (_event, trackIds: unknown) =>
    library.remove(stringList(trackIds)),
  );

  ipcMain.handle("saved-tracks:remove-all", () => library.removeAll());

  ipcMain.handle("saved-tracks:usage", () => library.usage());

  ipcMain.handle("saved-tracks:open-folder", async () => {
    try {
      const root = savedTracksRoot();
      await mkdir(root, { recursive: true });
      return (await shell.openPath(root)) === "";
    } catch {
      return false;
    }
  });

  ipcMain.handle("saved-tracks:lyrics-get", (_event, trackId: unknown) =>
    typeof trackId === "string" ? library.readLyrics(trackId) : null,
  );

  ipcMain.handle(
    "saved-tracks:lyrics-set",
    (_event, trackId: unknown, state: unknown, lyrics: unknown) => {
      if (typeof trackId !== "string") return false;
      if (!LYRICS_STATES.has(state as SavedLyricsState)) return false;
      if (state === "found" && !acceptableLyrics(lyrics)) return false;
      return library.setLyrics(
        trackId,
        state as SavedLyricsState,
        state === "found" ? lyrics : undefined,
      );
    },
  );
}
