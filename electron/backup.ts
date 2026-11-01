import fs from "node:fs/promises";
import { BrowserWindow, dialog, ipcMain } from "electron";

export interface BackupExportResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export interface BackupImportResult {
  ok: boolean;
  data?: string;
  error?: string;
}

export function setupBackup() {
  ipcMain.handle(
    "backup:export",
    async (event, payload: unknown): Promise<BackupExportResult> => {
      if (typeof payload !== "string" || payload.length === 0) {
        return { ok: false, error: "Nothing to export" };
      }
      const owner = BrowserWindow.fromWebContents(event.sender);
      const options: Electron.SaveDialogOptions = {
        title: "Export Liner backup",
        defaultPath: `liner-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Liner backup", extensions: ["json"] }],
      };
      const picked = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options);
      if (picked.canceled || !picked.filePath) return { ok: false };
      try {
        await fs.writeFile(picked.filePath, payload, "utf8");
        return { ok: true, path: picked.filePath };
      } catch {
        return { ok: false, error: "Could not write the backup file" };
      }
    },
  );

  ipcMain.handle("backup:import", async (event): Promise<BackupImportResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: "Restore Liner backup",
      properties: ["openFile"],
      filters: [{ name: "Liner backup", extensions: ["json"] }],
    };
    const picked = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (picked.canceled || picked.filePaths.length === 0) return { ok: false };
    try {
      const data = await fs.readFile(picked.filePaths[0], "utf8");
      if (data.length > 5_000_000) {
        return { ok: false, error: "Backup file is too large" };
      }
      return { ok: true, data };
    } catch {
      return { ok: false, error: "Could not read the backup file" };
    }
  });
}
