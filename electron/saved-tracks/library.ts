import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
  SavedLibraryUsage,
  SavedLyricsState,
  SavedTrackInput,
  SavedTrackRecord,
} from "./types.js";

const KEY_PATTERN = /^[a-f0-9]{20}$/;
const LIBRARY_FOLDERS = ["audio", "covers", "lyrics"] as const;

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/mp4": "m4a",
  "video/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/flac": "flac",
  "audio/wav": "wav",
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function savedTrackKey(trackId: string): string {
  return crypto.createHash("sha1").update(trackId).digest("hex").slice(0, 20);
}

function baseMime(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

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

async function writeAtomic(target: string, data: string | Uint8Array) {
  const temp = `${target}.tmp`;
  await fsp.writeFile(temp, data);
  await fsp.rename(temp, target);
}

export class SavedTrackLibrary {
  private records: SavedTrackRecord[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly root: string) {}

  private get indexPath() {
    return path.join(this.root, "library.json");
  }

  private filePath(...parts: string[]) {
    return path.join(this.root, ...parts);
  }

  private lyricsPath(key: string) {
    return this.filePath("lyrics", `${key}.json`);
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<SavedTrackRecord[]> {
    if (this.records) return this.records;
    try {
      const parsed: unknown = JSON.parse(
        await fsp.readFile(this.indexPath, "utf8"),
      );
      this.records = Array.isArray(parsed)
        ? (parsed as SavedTrackRecord[])
        : [];
    } catch {
      this.records = [];
    }
    return this.records;
  }

  private async save(records: SavedTrackRecord[]) {
    await fsp.mkdir(this.root, { recursive: true });
    await writeAtomic(this.indexPath, JSON.stringify(records));
    this.records = records;
  }

  private async deleteFiles(record: SavedTrackRecord) {
    await fsp.rm(this.filePath("audio", record.audioFile), { force: true });
    if (record.coverFile) {
      await fsp.rm(this.filePath("covers", record.coverFile), { force: true });
    }
    await fsp.rm(this.lyricsPath(record.key), { force: true });
  }

  list(): Promise<SavedTrackRecord[]> {
    return this.serialized(() => this.load());
  }

  saveTrack(input: SavedTrackInput): Promise<SavedTrackRecord | null> {
    return this.serialized(async () => {
      const extension = AUDIO_EXTENSIONS[baseMime(input.mimeType)];
      if (!extension || input.audio.byteLength === 0) return null;
      const key = savedTrackKey(input.meta.trackId);
      const records = await this.load();
      const previous = records.find((record) => record.key === key);
      await fsp.mkdir(this.filePath("audio"), { recursive: true });
      const audioFile = `${key}.${extension}`;
      await writeAtomic(this.filePath("audio", audioFile), input.audio);
      if (previous && previous.audioFile !== audioFile) {
        await fsp.rm(this.filePath("audio", previous.audioFile), {
          force: true,
        });
      }
      let coverFile: string | undefined;
      const coverExtension = input.cover
        ? IMAGE_EXTENSIONS[baseMime(input.cover.mimeType)]
        : undefined;
      if (input.cover && coverExtension && input.cover.data.byteLength > 0) {
        await fsp.mkdir(this.filePath("covers"), { recursive: true });
        coverFile = `${key}.${coverExtension}`;
        await writeAtomic(this.filePath("covers", coverFile), input.cover.data);
      } else if (previous?.coverFile) {
        coverFile = previous.coverFile;
      }
      let lyrics = previous?.lyrics;
      if (input.lyricsState === "found" && input.lyrics) {
        await fsp.mkdir(this.filePath("lyrics"), { recursive: true });
        await writeAtomic(this.lyricsPath(key), JSON.stringify(input.lyrics));
        lyrics = "found";
      } else if (input.lyricsState === "missing") {
        lyrics = "missing";
      }
      const record: SavedTrackRecord = {
        ...input.meta,
        key,
        audioFile,
        mimeType: baseMime(input.mimeType).replace(/^video\//, "audio/"),
        ...(coverFile ? { coverFile } : {}),
        byteSize: input.audio.byteLength,
        savedAt: previous?.savedAt ?? Date.now(),
        ...(lyrics ? { lyrics } : {}),
      };
      await this.save([
        ...records.filter((entry) => entry.key !== key),
        record,
      ]);
      return record;
    });
  }

  remove(trackIds: string[]): Promise<number> {
    return this.serialized(async () => {
      const removing = new Set(trackIds);
      const records = await this.load();
      const gone = records.filter((record) => removing.has(record.trackId));
      if (gone.length === 0) return 0;
      await this.save(
        records.filter((record) => !removing.has(record.trackId)),
      );
      for (const record of gone) await this.deleteFiles(record);
      return gone.length;
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

  usage(): Promise<SavedLibraryUsage> {
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
      let freeBytes: number | null = null;
      try {
        await fsp.mkdir(this.root, { recursive: true });
        const stats = await fsp.statfs(this.root);
        freeBytes = Number(stats.bavail) * Number(stats.bsize);
      } catch {}
      return { count: records.length, bytes, freeBytes };
    });
  }

  async readLyrics(trackId: string): Promise<unknown | null> {
    const key = savedTrackKey(trackId);
    try {
      return JSON.parse(await fsp.readFile(this.lyricsPath(key), "utf8"));
    } catch {
      return null;
    }
  }

  setLyrics(
    trackId: string,
    state: SavedLyricsState,
    lyrics?: unknown,
  ): Promise<boolean> {
    return this.serialized(async () => {
      const key = savedTrackKey(trackId);
      const records = await this.load();
      const index = records.findIndex((record) => record.key === key);
      if (index === -1) return false;
      if (state === "found") {
        if (lyrics === undefined || lyrics === null) return false;
        await fsp.mkdir(this.filePath("lyrics"), { recursive: true });
        await writeAtomic(this.lyricsPath(key), JSON.stringify(lyrics));
      } else {
        await fsp.rm(this.lyricsPath(key), { force: true });
      }
      const next = [...records];
      next[index] = { ...records[index], lyrics: state };
      await this.save(next);
      return true;
    });
  }

  async locate(kind: "audio" | "cover", key: string) {
    if (!KEY_PATTERN.test(key)) return null;
    const record = (await this.list()).find((entry) => entry.key === key);
    const file = kind === "audio" ? record?.audioFile : record?.coverFile;
    if (!record || !file) return null;
    return {
      path: this.filePath(kind === "audio" ? "audio" : "covers", file),
      mimeType: kind === "audio" ? record.mimeType : undefined,
    };
  }
}
