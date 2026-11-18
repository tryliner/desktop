import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { extensionFor, sniffMediaType, type MediaMime } from "./sniff.js";

/**
 * User-picked images and videos kept on disk (playlist covers, wallpapers).
 * Files are addressed by an opaque 20-hex key derived from (owner, ref), so
 * the liner-local:// protocol can serve them without ever mapping a request
 * to an arbitrary path. The file type is decided by its bytes, not by what
 * the renderer claims.
 */

export interface UserMediaRecord {
  key: string;
  /** account the item belongs to, so switching accounts keeps them apart */
  owner: string;
  /** what it's for: a playlist id, or a content hash for gallery items */
  ref: string;
  file: string;
  mimeType: MediaMime;
  byteSize: number;
  /** epoch ms; renderers append it to the url to bust caches */
  updatedAt: number;
}

export interface UserMediaOptions {
  accept: ReadonlySet<MediaMime>;
  maxBytes: number;
  /** most items one owner may keep; oldest go first (wallpaper gallery) */
  maxPerOwner?: number;
}

export type UserMediaError = "unsupported-type" | "too-large" | "empty";

export class UserMediaRejection extends Error {
  constructor(readonly reason: UserMediaError) {
    super(reason);
  }
}

const KEY_PATTERN = /^[a-f0-9]{20}$/;

export function userMediaKey(owner: string, ref: string): string {
  return crypto
    .createHash("sha1")
    .update(`${owner}\u0000${ref}`)
    .digest("hex")
    .slice(0, 20);
}

async function writeAtomic(target: string, data: string | Uint8Array) {
  const temp = `${target}.tmp`;
  await fsp.writeFile(temp, data);
  await fsp.rename(temp, target);
}

function isRecord(value: unknown): value is UserMediaRecord {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.key === "string" &&
    KEY_PATTERN.test(raw.key) &&
    typeof raw.owner === "string" &&
    typeof raw.ref === "string" &&
    typeof raw.file === "string" &&
    // the file name is always `<key>.<ext>`, never a path
    raw.file.startsWith(`${raw.key}.`) &&
    !raw.file.includes("/") &&
    !raw.file.includes("\\") &&
    typeof raw.mimeType === "string" &&
    typeof raw.byteSize === "number" &&
    typeof raw.updatedAt === "number"
  );
}

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
    try {
      const parsed: unknown = JSON.parse(
        await fsp.readFile(this.indexPath, "utf8"),
      );
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

  /** stores (or replaces) the item for (owner, ref) */
  set(owner: string, ref: string, bytes: Uint8Array): Promise<UserMediaRecord> {
    return this.serialized(async () => {
      if (bytes.byteLength === 0) throw new UserMediaRejection("empty");
      if (bytes.byteLength > this.options.maxBytes) {
        throw new UserMediaRejection("too-large");
      }
      const mimeType = sniffMediaType(bytes);
      if (!mimeType || !this.options.accept.has(mimeType)) {
        throw new UserMediaRejection("unsupported-type");
      }
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
        // strictly increasing, so "newest" is never a tie (and urls always change)
        updatedAt: Math.max(
          Date.now(),
          records.reduce((max, r) => Math.max(max, r.updatedAt), 0) + 1,
        ),
      };
      let next = [...records.filter((r) => r.key !== key), record];

      const cap = this.options.maxPerOwner;
      if (cap) {
        const mine = next
          .filter((r) => r.owner === owner)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        const evicted = mine.slice(cap);
        for (const old of evicted) await this.deleteFile(old);
        const gone = new Set(evicted.map((r) => r.key));
        next = next.filter((r) => !gone.has(r.key));
      }
      await this.save(next);
      return record;
    });
  }

  remove(owner: string, ref: string): Promise<boolean> {
    return this.removeKey(userMediaKey(owner, ref), owner);
  }

  /** removes by key, only when it belongs to `owner` */
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

  /** newest first */
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

  /** the protocol's only way in: a known key maps to its own file */
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
