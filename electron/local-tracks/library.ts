import fsp from "node:fs/promises";
import path from "node:path";
import { importLocalFile } from "./importer.js";
import type {
  LocalImportResult,
  LocalLibraryUsage,
  LocalLyricsState,
  LocalTrackRecord,
} from "./types.js";

const ID_PATTERN = /^[a-f0-9]{20}$/;
const LIBRARY_FOLDERS = ["audio", "covers", "lyrics"] as const;

async function folderBytes(folder: string): Promise<number> {
  try {
    const entries = await fsp.readdir(folder, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      try {
        total += (await fsp.stat(path.join(folder, entry.name))).size;
      } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

export class LocalTrackLibrary {
  private records: LocalTrackRecord[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly root: string) {}

  private get indexPath() {
    return path.join(this.root, "library.json");
  }

  private filePath(...parts: string[]) {
    return path.join(this.root, ...parts);
  }

  private lyricsPath(id: string) {
    return this.filePath("lyrics", `${id}.json`);
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<LocalTrackRecord[]> {
    if (this.records) return this.records;
    try {
      const parsed: unknown = JSON.parse(
        await fsp.readFile(this.indexPath, "utf8"),
      );
      this.records = Array.isArray(parsed)
        ? (parsed as LocalTrackRecord[])
        : [];
    } catch {
      this.records = [];
    }
    return this.records;
  }

  private async save(records: LocalTrackRecord[]) {
    await fsp.mkdir(this.root, { recursive: true });
    const temp = `${this.indexPath}.tmp`;
    await fsp.writeFile(temp, JSON.stringify(records));
    await fsp.rename(temp, this.indexPath);
    this.records = records;
  }

  list(): Promise<LocalTrackRecord[]> {
    return this.serialized(() => this.load());
  }

  importFiles(paths: string[]): Promise<LocalImportResult> {
    return this.serialized(async () => {
      const records = [...(await this.load())];
      const known = new Set(records.map((record) => record.id));
      const result: LocalImportResult = {
        added: [],
        duplicates: 0,
        failed: [],
      };
      await fsp.mkdir(this.filePath("audio"), { recursive: true });
      await fsp.mkdir(this.filePath("covers"), { recursive: true });
      for (const source of paths) {
        try {
          const record = await importLocalFile(source, this.root, known);
          if (!record) result.duplicates += 1;
          else {
            known.add(record.id);
            records.push(record);
            result.added.push(record);
          }
        } catch {
          result.failed.push(path.basename(source));
        }
      }
      if (result.added.length > 0) await this.save(records);
      return result;
    });
  }

  remove(ids: string[]): Promise<void> {
    return this.serialized(async () => {
      const removing = new Set(ids);
      const records = await this.load();
      const gone = records.filter((record) => removing.has(record.id));
      if (gone.length === 0) return;
      await this.save(records.filter((record) => !removing.has(record.id)));
      for (const record of gone) {
        await fsp.rm(this.filePath("audio", record.audioFile), { force: true });
        if (record.coverFile) {
          await fsp.rm(this.filePath("covers", record.coverFile), {
            force: true,
          });
        }
        await fsp.rm(this.lyricsPath(record.id), { force: true });
      }
    });
  }

  removeAll(): Promise<number> {
    return this.serialized(async () => {
      const count = (await this.load()).length;
      await this.save([]);
      for (const folder of LIBRARY_FOLDERS) {
        await fsp.rm(this.filePath(folder), { recursive: true, force: true });
      }
      return count;
    });
  }

  usage(): Promise<LocalLibraryUsage> {
    return this.serialized(async () => {
      const records = await this.load();
      let bytes = 0;
      for (const folder of LIBRARY_FOLDERS) {
        bytes += await folderBytes(this.filePath(folder));
      }
      if (records.length > 0) {
        try {
          bytes += (await fsp.stat(this.indexPath)).size;
        } catch {}
      }
      return { count: records.length, bytes };
    });
  }

  async readLyrics(id: string): Promise<unknown | null> {
    if (!ID_PATTERN.test(id)) return null;
    try {
      return JSON.parse(await fsp.readFile(this.lyricsPath(id), "utf8"));
    } catch {
      return null;
    }
  }

  setLyrics(
    id: string,
    state: LocalLyricsState,
    lyrics?: unknown,
  ): Promise<boolean> {
    return this.serialized(async () => {
      if (!ID_PATTERN.test(id)) return false;
      const records = await this.load();
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) return false;
      if (state === "found") {
        if (lyrics === undefined || lyrics === null) return false;
        await fsp.mkdir(this.filePath("lyrics"), { recursive: true });
        const target = this.lyricsPath(id);
        const temp = `${target}.tmp`;
        await fsp.writeFile(temp, JSON.stringify(lyrics));
        await fsp.rename(temp, target);
      } else {
        await fsp.rm(this.lyricsPath(id), { force: true });
      }
      const next = [...records];
      next[index] = { ...records[index], lyrics: state };
      await this.save(next);
      return true;
    });
  }

  async locate(kind: "audio" | "cover", id: string) {
    if (!ID_PATTERN.test(id)) return null;
    const record = (await this.list()).find((entry) => entry.id === id);
    const file = kind === "audio" ? record?.audioFile : record?.coverFile;
    if (!record || !file) return null;
    return {
      path: this.filePath(kind === "audio" ? "audio" : "covers", file),
      record,
    };
  }
}
