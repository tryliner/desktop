import path from "node:path";
import { BrowserWindow, app, dialog, ipcMain } from "electron";
import { LocalTrackLibrary } from "./library.js";
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
}
