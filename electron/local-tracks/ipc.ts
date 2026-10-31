import path from "node:path";
import { BrowserWindow, app, dialog, ipcMain } from "electron";
import { LocalTrackLibrary } from "./library.js";
import { handleLocalTrackScheme } from "./protocol.js";
import type { SavedTrackLibrary } from "../saved-tracks/library.js";
import { LOCAL_AUDIO_EXTENSIONS, type LocalLyricsState } from "./types.js";

const LYRICS_STATES = new Set<LocalLyricsState>([
  "found",
  "missing",
  "untagged",
]);
const MAX_LYRICS_JSON_LENGTH = 2_000_000;

function acceptableLyrics(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  try {
    return JSON.stringify(value).length <= MAX_LYRICS_JSON_LENGTH;
  } catch {
    return false;
  }
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];

export function setupLocalTracks(saved: SavedTrackLibrary) {
  const library = new LocalTrackLibrary(
    path.join(app.getPath("userData"), "local-tracks"),
  );
  handleLocalTrackScheme(library, saved);

  ipcMain.handle("local-tracks:list", () => library.list());

  ipcMain.handle("local-tracks:import", (_event, paths: unknown) =>
    library.importFiles(stringList(paths)),
  );

  ipcMain.handle("local-tracks:pick", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Audio", extensions: [...LOCAL_AUDIO_EXTENSIONS] }],
    };
    const picked = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (picked.canceled || picked.filePaths.length === 0) return null;
    return library.importFiles(picked.filePaths);
  });

  ipcMain.handle("local-tracks:remove", (_event, ids: unknown) =>
    library.remove(stringList(ids)),
  );

  ipcMain.handle("local-tracks:remove-all", () => library.removeAll());

  ipcMain.handle("local-tracks:usage", () => library.usage());

  ipcMain.handle("local-tracks:lyrics-get", (_event, id: unknown) =>
    typeof id === "string" ? library.readLyrics(id) : null,
  );

  ipcMain.handle(
    "local-tracks:lyrics-set",
    (_event, id: unknown, state: unknown, lyrics: unknown) => {
      if (typeof id !== "string") return false;
      if (!LYRICS_STATES.has(state as LocalLyricsState)) return false;
      if (state === "found" && !acceptableLyrics(lyrics)) return false;
      return library.setLyrics(
        id,
        state as LocalLyricsState,
        state === "found" ? lyrics : undefined,
      );
    },
  );
}
