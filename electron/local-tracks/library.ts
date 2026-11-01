import fsp from "node:fs/promises";
import path from "node:path";
import { importLocalFile } from "./importer.js";
import type {
  LocalImportResult,
  LocalLibraryUsage,
  LocalTrackRecord,
} from "./types.js";

const ID_PATTERN = /^[a-f0-9]{20}$/;
const LIBRARY_FOLDERS = ["audio", "covers"] as const;

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
        if (record.lrcFile) {
          await fsp.rm(this.filePath("lyrics", record.lrcFile), {
            force: true,
          });
        }
      }
    });
  }

  removeAll(): Promise<number> {
    return this.serialized(async () => {
      const records = await this.load();
      const count = records.length;
      try {
        for (const folder of LIBRARY_FOLDERS) {
          await fsp.rm(this.filePath(folder), { recursive: true, force: true });
        }
        await this.save([]);
        return count;
      } catch (error) {
        try {
          await this.reconcile();
        } catch {}
        throw error;
      }
    });
  }

  private async reconcile(): Promise<LocalTrackRecord[]> {
    const records = await this.load();
    const surviving: LocalTrackRecord[] = [];
    for (const record of records) {
      let audioExists = true;
      try {
        await fsp.stat(this.filePath("audio", record.audioFile));
      } catch (err: any) {
        if (err?.code === "ENOENT") {
          audioExists = false;
        }
      }
      if (!audioExists) continue;

      let coverFile = record.coverFile;
      if (coverFile) {
        const coverExists = await fsp
          .stat(this.filePath("covers", coverFile))
          .then(() => true)
          .catch(() => false);
        if (!coverExists) coverFile = undefined;
      }

      let lrcFile = record.lrcFile;
      if (lrcFile) {
        const lrcExists = await fsp
          .stat(this.filePath("lyrics", lrcFile))
          .then(() => true)
          .catch(() => false);
        if (!lrcExists) lrcFile = undefined;
      }

      surviving.push({
        ...record,
        coverFile,
        lrcFile,
      });
    }
    await this.save(surviving);
    return surviving;
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

  async locate(kind: "audio" | "cover" | "lyrics", id: string) {
    if (!ID_PATTERN.test(id)) return null;
    const record = (await this.list()).find((entry) => entry.id === id);
    const file =
      kind === "audio"
        ? record?.audioFile
        : kind === "cover"
          ? record?.coverFile
          : record?.lrcFile;
    if (!record || !file) return null;
    return {
      path: this.filePath(
        kind === "audio" ? "audio" : kind === "cover" ? "covers" : "lyrics",
        file,
      ),
      record,
    };
  }
}
