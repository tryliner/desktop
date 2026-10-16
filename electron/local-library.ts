import { dialog, ipcMain, protocol, type BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";

/**
 * Local music library support.
 *
 * - `liner-local://a/<base64url path>`  -> streams an audio file (with Range support, so seeking works)
 * - `liner-local://c/<base64url path>`  -> serves the embedded cover (or folder.jpg / cover.jpg)
 *
 * Only files with an audio extension (or, for covers, an image extension) are ever served.
 */

export const LOCAL_SCHEME = "liner-local";
export const LOCAL_ID_PREFIX = "local:";

const AUDIO_MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg; codecs=opus",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
};

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const SIDECAR_COVER_NAMES = ["cover", "folder", "front", "album", "albumart"];
const MAX_FILES = 50_000;
const SCAN_CONCURRENCY = 8;

export interface LocalTrackInfo {
  id: string;
  path: string;
  url: string;
  coverUrl: string;
  title: string;
  artists: string;
  album: string;
  albumId: string;
  year?: string;
  durationMs: number;
}

const toB64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const fromB64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

const audioUrl = (p: string) => `${LOCAL_SCHEME}://a/${toB64(p)}`;
const coverUrl = (p: string) => `${LOCAL_SCHEME}://c/${toB64(p)}`;

/** Must run before `app.whenReady()`. */
export function registerLocalScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
        bypassCSP: true,
      },
    },
  ]);
}

async function* walk(dir: string, budget: { left: number }): AsyncGenerator<string> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (budget.left <= 0) return;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, budget);
    } else if (entry.isFile() && AUDIO_MIME[path.extname(entry.name).toLowerCase()]) {
      budget.left -= 1;
      yield full;
    }
  }
}

const sidecarCache = new Map<string, string | null>();

async function findSidecarCover(dir: string): Promise<string | null> {
  if (sidecarCache.has(dir)) return sidecarCache.get(dir) ?? null;
  let found: string | null = null;
  try {
    const names = await fs.promises.readdir(dir);
    for (const base of SIDECAR_COVER_NAMES) {
      const hit = names.find((n) => {
        const ext = path.extname(n).toLowerCase();
        return IMAGE_MIME[ext] && path.basename(n, path.extname(n)).toLowerCase() === base;
      });
      if (hit) {
        found = path.join(dir, hit);
        break;
      }
    }
  } catch {
    found = null;
  }
  sidecarCache.set(dir, found);
  return found;
}

type MusicMetadata = typeof import("music-metadata");
let mmPromise: Promise<MusicMetadata> | null = null;
const loadMusicMetadata = () => (mmPromise ??= import("music-metadata"));

async function readTrack(file: string): Promise<LocalTrackInfo> {
  const { parseFile } = await loadMusicMetadata();
  const fallbackTitle = path.basename(file, path.extname(file));
  let title = fallbackTitle;
  let artists = "Unknown Artist";
  let album = "";
  let year: string | undefined;
  let durationMs = 0;
  let hasEmbeddedCover = false;

  try {
    const meta = await parseFile(file, { skipPostHeaders: true });
    title = meta.common.title?.trim() || fallbackTitle;
    const artistList = meta.common.artists?.length ? meta.common.artists : meta.common.artist ? [meta.common.artist] : [];
    if (artistList.length) artists = artistList.join(", ");
    album = meta.common.album?.trim() ?? "";
    if (meta.common.year) year = String(meta.common.year);
    durationMs = Math.round((meta.format.duration ?? 0) * 1000);
    hasEmbeddedCover = Boolean(meta.common.picture?.length);
  } catch {
    // unreadable tags: still list the file with its file name
  }

  const hasCover = hasEmbeddedCover || (await findSidecarCover(path.dirname(file))) !== null;
  const albumKey = `${album}|${artists}|${path.dirname(file)}`;

  return {
    id: LOCAL_ID_PREFIX + hash(file),
    path: file,
    url: audioUrl(file),
    coverUrl: hasCover ? coverUrl(file) : "",
    title,
    artists,
    album,
    albumId: album ? `local-album:${hash(albumKey)}` : "",
    year,
    durationMs,
  };
}

async function serveAudio(req: Request, file: string): Promise<Response> {
  const mime = AUDIO_MIME[path.extname(file).toLowerCase()];
  if (!mime) return new Response("Forbidden", { status: 403 });

  let size: number;
  try {
    const st = await fs.promises.stat(file);
    if (!st.isFile()) return new Response("Not found", { status: 404 });
    size = st.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "content-type": mime,
    "accept-ranges": "bytes",
    "access-control-allow-origin": "*",
  };

  const range = req.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;

  if (!match) {
    const stream = Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream;
    return new Response(stream, { status: 200, headers: { ...baseHeaders, "content-length": String(size) } });
  }

  let start: number;
  let end: number;
  if (match[1] === "") {
    // suffix range: last N bytes
    const n = Number(match[2]);
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { ...baseHeaders, "content-range": `bytes */${size}` },
    });
  }

  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as unknown as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      ...baseHeaders,
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": String(end - start + 1),
    },
  });
}

async function serveCover(file: string): Promise<Response> {
  if (!AUDIO_MIME[path.extname(file).toLowerCase()]) return new Response("Forbidden", { status: 403 });
  const headers = { "access-control-allow-origin": "*", "cache-control": "max-age=86400" };

  try {
    const { parseFile, selectCover } = await loadMusicMetadata();
    const meta = await parseFile(file, { skipPostHeaders: true });
    const pic = selectCover(meta.common.picture);
    if (pic) {
      return new Response(new Uint8Array(pic.data), { status: 200, headers: { ...headers, "content-type": pic.format || "image/jpeg" } });
    }
  } catch {
    // fall through to the sidecar image
  }

  const sidecar = await findSidecarCover(path.dirname(file));
  if (sidecar) {
    try {
      const data = await fs.promises.readFile(sidecar);
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: { ...headers, "content-type": IMAGE_MIME[path.extname(sidecar).toLowerCase()] ?? "image/jpeg" },
      });
    } catch {
      // ignore
    }
  }
  return new Response("No cover", { status: 404, headers });
}

/** Call inside `app.whenReady()`. */
export function registerLocalLibrary(getWindow: () => BrowserWindow | null): void {
  protocol.handle(LOCAL_SCHEME, async (req) => {
    try {
      const url = new URL(req.url);
      const kind = url.hostname;
      const encoded = url.pathname.replace(/^\//, "");
      const file = fromB64(encoded);
      if (!path.isAbsolute(file)) return new Response("Bad request", { status: 400 });
      if (kind === "a") return await serveAudio(req, file);
      if (kind === "c") return await serveCover(file);
      return new Response("Not found", { status: 404 });
    } catch {
      return new Response("Bad request", { status: 400 });
    }
  });

  ipcMain.handle("local:pick-folder", async () => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = { properties: ["openDirectory"] };
    const result = win && !win.isDestroyed() ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle("local:scan", async (event, folder: unknown): Promise<LocalTrackInfo[]> => {
    if (typeof folder !== "string" || !path.isAbsolute(folder)) return [];
    sidecarCache.clear();

    const files: string[] = [];
    for await (const f of walk(folder, { left: MAX_FILES })) files.push(f);

    const results: LocalTrackInfo[] = new Array(files.length);
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= files.length) return;
        results[i] = await readTrack(files[i]);
        done += 1;
        if (done % 25 === 0 || done === files.length) {
          event.sender.send("local:scan-progress", { done, total: files.length });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, files.length) }, worker));

    return results.sort((a, b) => a.artists.localeCompare(b.artists) || a.album.localeCompare(b.album) || a.title.localeCompare(b.title));
  });
}
