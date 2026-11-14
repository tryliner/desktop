import path from "node:path";
import { BrowserWindow, app, dialog } from "electron";
import { handleTrusted } from "../ipc-guard.js";
import { LocalTrackLibrary } from "./library.js";
import { LocalPlaylistLinkStore } from "./playlist-links.js";
import { handleLocalTrackScheme } from "./protocol.js";
import type { SavedTrackLibrary } from "../saved-tracks/library.js";
import { LOCAL_AUDIO_EXTENSIONS } from "./types.js";

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

  const playlistLinks = new LocalPlaylistLinkStore(
    path.join(app.getPath("userData"), "local-tracks"),
  );

  handleTrusted("local-tracks:list", () => library.list());

  handleTrusted("local-tracks:import", (_event, paths: unknown) =>
    library.importFiles(stringList(paths)),
  );

  handleTrusted("local-tracks:pick", async (event) => {
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

  handleTrusted("local-tracks:remove", (_event, ids: unknown) =>
    library.remove(stringList(ids)),
  );

  handleTrusted("local-tracks:remove-all", () => library.removeAll());

  handleTrusted("local-tracks:usage", () => library.usage());

  handleTrusted("local-playlist-links:list", () => playlistLinks.list());

  handleTrusted(
    "local-playlist-links:add",
    (_event, playlistId: unknown, entry: unknown) =>
      typeof playlistId === "string"
        ? playlistLinks.add(playlistId, entry)
        : false,
  );

  handleTrusted(
    "local-playlist-links:remove",
    (_event, playlistId: unknown, fileId: unknown) =>
      typeof playlistId === "string" && typeof fileId === "string"
        ? playlistLinks.remove(playlistId, fileId)
        : undefined,
  );

  handleTrusted(
    "local-playlist-links:remove-playlist",
    (_event, id: unknown) =>
      typeof id === "string" ? playlistLinks.removePlaylist(id) : undefined,
  );
}
