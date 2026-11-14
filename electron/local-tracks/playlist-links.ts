import fsp from "node:fs/promises";
import path from "node:path";
import type { LocalPlaylistEntry, LocalPlaylistLinks } from "./types.js";

const ID_PATTERN = /^[a-f0-9]{20}$/;

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

function sanitize(raw: unknown): LocalPlaylistEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Partial<LocalPlaylistEntry>;
  if (typeof entry.fileId !== "string" || !ID_PATTERN.test(entry.fileId))
    return null;
  const duration = Number(entry.durationMs);
  const addedAt = Number(entry.addedAt);
  return {
    fileId: entry.fileId,
    title: text(entry.title, 500),
    artist: text(entry.artist, 500),
    durationMs: Number.isFinite(duration) && duration > 0 ? duration : 0,
    addedAt: Number.isFinite(addedAt) ? addedAt : Date.now(),
  };
}

function parseLinks(raw: string): LocalPlaylistLinks {
  const links: LocalPlaylistLinks = {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return links;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return links;
  for (const [playlistId, list] of Object.entries(parsed)) {
    if (!Array.isArray(list)) continue;
    const entries = list
      .map(sanitize)
      .filter((e): e is LocalPlaylistEntry => e !== null);
    if (entries.length > 0) links[playlistId] = entries;
  }
  return links;
}

export class LocalPlaylistLinkStore {
  private links: LocalPlaylistLinks | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly root: string) {}

  private get filePath() {
    return path.join(this.root, "playlist-links.json");
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<LocalPlaylistLinks> {
    if (this.links) return this.links;
    let raw: string | null = null;
    try {
      raw = await fsp.readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const links = raw === null ? {} : parseLinks(raw);
    this.links = links;
    return links;
  }

  private async save(links: LocalPlaylistLinks): Promise<void> {
    await fsp.mkdir(this.root, { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(links), "utf8");
    await fsp.rename(tmp, this.filePath);
  }

  list(): Promise<LocalPlaylistLinks> {
    return this.serialized(async () => structuredClone(await this.load()));
  }

  add(playlistId: string, entry: unknown): Promise<boolean> {
    return this.serialized(async () => {
      const clean = sanitize(entry);
      if (!clean || !playlistId) return false;
      const links = await this.load();
      const current = links[playlistId] ?? [];
      if (current.some((e) => e.fileId === clean.fileId)) return false;
      const next = { ...links, [playlistId]: [...current, clean] };
      await this.save(next);
      this.links = next;
      return true;
    });
  }

  remove(playlistId: string, fileId: string): Promise<void> {
    return this.serialized(async () => {
      const links = await this.load();
      const current = links[playlistId];
      if (!current) return;
      const filtered = current.filter((e) => e.fileId !== fileId);
      if (filtered.length === current.length) return;
      const next = { ...links };
      if (filtered.length > 0) next[playlistId] = filtered;
      else delete next[playlistId];
      await this.save(next);
      this.links = next;
    });
  }

  removePlaylist(playlistId: string): Promise<void> {
    return this.serialized(async () => {
      const links = await this.load();
      if (!(playlistId in links)) return;
      const next = { ...links };
      delete next[playlistId];
      await this.save(next);
      this.links = next;
    });
  }
}
