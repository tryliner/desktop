import fsp from "node:fs/promises";
import path from "node:path";
import { extensionFor } from "./sniff.js";

import {
  KEY_PATTERN,
  acceptedType,
  capPerOwner,
  nextUpdatedAt,
  isMissingFile,
  isRecord,
  userMediaKey,
  writeAtomic,
  type UserMediaOptions,
  type UserMediaRecord,
} from "./records.js";

export {
  UserMediaRejection,
  userMediaKey,
  type UserMediaError,
  type UserMediaOptions,
  type UserMediaRecord,
} from "./records.js";

export class UserMediaLibrary {
  private records: UserMediaRecord[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly root: string,
    private readonly options: UserMediaOptions,
  ) {}

  private get indexPath() {
    return path.join(this.root, "index.json");
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<UserMediaRecord[]> {
    if (this.records) return this.records;
    let text: string;
    try {
      text = await fsp.readFile(this.indexPath, "utf8");
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      this.records = [];
      return this.records;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      this.records = Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    } catch {
      this.records = [];
    }
    return this.records;
  }

  private async save(records: UserMediaRecord[]) {
    await fsp.mkdir(this.root, { recursive: true });
    await writeAtomic(this.indexPath, JSON.stringify(records));
    this.records = records;
  }

  private async deleteFile(record: UserMediaRecord) {
    await fsp.rm(path.join(this.root, record.file), { force: true });
  }

  set(owner: string, ref: string, bytes: Uint8Array): Promise<UserMediaRecord> {
    return this.serialized(async () => {
      const mimeType = acceptedType(bytes, this.options);
      const records = await this.load();
      const key = userMediaKey(owner, ref);
      const file = `${key}.${extensionFor(mimeType)}`;
      await fsp.mkdir(this.root, { recursive: true });
      await writeAtomic(path.join(this.root, file), bytes);

      const previous = records.find((record) => record.key === key);
      if (previous && previous.file !== file) await this.deleteFile(previous);
      const record: UserMediaRecord = {
        key,
        owner,
        ref,
        file,
        mimeType,
        byteSize: bytes.byteLength,
        updatedAt: nextUpdatedAt(records),
      };
      const { kept, evicted } = capPerOwner(
        [...records.filter((r) => r.key !== key), record],
        owner,
        this.options.maxPerOwner,
      );
      for (const old of evicted) await this.deleteFile(old);
      await this.save(kept);
      return record;
    });
  }

  remove(owner: string, ref: string): Promise<boolean> {
    return this.removeKey(userMediaKey(owner, ref), owner);
  }

  removeKey(key: string, owner: string): Promise<boolean> {
    return this.serialized(async () => {
      const records = await this.load();
      const target = records.find((r) => r.key === key && r.owner === owner);
      if (!target) return false;
      await this.deleteFile(target);
      await this.save(records.filter((r) => r !== target));
      return true;
    });
  }

  list(owner: string): Promise<UserMediaRecord[]> {
    return this.serialized(async () =>
      (await this.load())
        .filter((record) => record.owner === owner)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }

  usage(): Promise<{ count: number; bytes: number }> {
    return this.serialized(async () => {
      const records = await this.load();
      return {
        count: records.length,
        bytes: records.reduce((sum, record) => sum + record.byteSize, 0),
      };
    });
  }

  locate(key: string): Promise<{ path: string; mimeType: string } | null> {
    if (!KEY_PATTERN.test(key)) return Promise.resolve(null);
    return this.serialized(async () => {
      const record = (await this.load()).find((r) => r.key === key);
      if (!record) return null;
      return {
        path: path.join(this.root, record.file),
        mimeType: record.mimeType,
      };
    });
  }
}
