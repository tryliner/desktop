import fsp from "node:fs/promises";
import path from "node:path";
import { importLocalFile } from "./importer.js";
import type { LocalImportResult, LocalTrackRecord } from "./types.js";

const ID_PATTERN = /^[a-f0-9]{20}$/;

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
