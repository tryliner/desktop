import crypto from "node:crypto";
import fsp from "node:fs/promises";
import { sniffMediaType, type MediaMime } from "./sniff.js";

export interface UserMediaRecord {
  key: string;
  owner: string;
  ref: string;
  file: string;
  mimeType: MediaMime;
  byteSize: number;
  updatedAt: number;
}

export interface UserMediaOptions {
  accept: ReadonlySet<MediaMime>;
  maxBytes: number;
  maxPerOwner?: number;
}

export type UserMediaError = "unsupported-type" | "too-large" | "empty";

export class UserMediaRejection extends Error {
  constructor(readonly reason: UserMediaError) {
    super(reason);
  }
}

export const KEY_PATTERN = /^[a-f0-9]{20}$/;

export function userMediaKey(owner: string, ref: string): string {
  return crypto
    .createHash("sha1")
    .update(`${owner}\u0000${ref}`)
    .digest("hex")
    .slice(0, 20);
}

export async function writeAtomic(target: string, data: string | Uint8Array) {
  const temp = `${target}.tmp`;
  await fsp.writeFile(temp, data);
  await fsp.rename(temp, target);
}

export function isRecord(value: unknown): value is UserMediaRecord {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.key === "string" &&
    KEY_PATTERN.test(raw.key) &&
    typeof raw.owner === "string" &&
    typeof raw.ref === "string" &&
    typeof raw.file === "string" &&
    raw.file.startsWith(`${raw.key}.`) &&
    !raw.file.includes("/") &&
    !raw.file.includes("\\") &&
    typeof raw.mimeType === "string" &&
    typeof raw.byteSize === "number" &&
    typeof raw.updatedAt === "number"
  );
}

export function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function acceptedType(
  bytes: Uint8Array,
  options: UserMediaOptions,
): MediaMime {
  if (bytes.byteLength === 0) throw new UserMediaRejection("empty");
  if (bytes.byteLength > options.maxBytes) {
    throw new UserMediaRejection("too-large");
  }
  const mimeType = sniffMediaType(bytes);
  if (!mimeType || !options.accept.has(mimeType)) {
    throw new UserMediaRejection("unsupported-type");
  }
  return mimeType;
}

export function nextUpdatedAt(records: UserMediaRecord[]): number {
  return Math.max(
    Date.now(),
    records.reduce((max, r) => Math.max(max, r.updatedAt), 0) + 1,
  );
}

export function capPerOwner(
  records: UserMediaRecord[],
  owner: string,
  cap: number | undefined,
): { kept: UserMediaRecord[]; evicted: UserMediaRecord[] } {
  if (!cap) return { kept: records, evicted: [] };
  const evicted = records
    .filter((r) => r.owner === owner)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(cap);
  const gone = new Set(evicted.map((r) => r.key));
  return { kept: records.filter((r) => !gone.has(r.key)), evicted };
}
