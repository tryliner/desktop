import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { audioExtension, readLocalTrackTags } from "./metadata.js";
import { LOCAL_AUDIO_EXTENSIONS, type LocalTrackRecord } from "./types.js";

const SUPPORTED = new Set<string>(LOCAL_AUDIO_EXTENSIONS);

async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha1");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex").slice(0, 20);
}

export async function importLocalFile(
  source: string,
  root: string,
  known: Set<string>,
): Promise<LocalTrackRecord | null> {
  const real = await fsp.realpath(source);
  const extension = audioExtension(real);
  if (!SUPPORTED.has(extension) || audioExtension(source) !== extension)
    throw new Error("unsupported");
  const stat = await fsp.stat(real);
  if (!stat.isFile()) throw new Error("not a file");
  const id = await hashFile(real);
  if (known.has(id)) return null;
  const audioFile = `${id}.${extension}`;
  await fsp.copyFile(real, path.join(root, "audio", audioFile));
  const tags = await readLocalTrackTags(real);
  const coverFile = tags.cover ? `${id}.${tags.cover.extension}` : undefined;
  if (tags.cover && coverFile) {
    await fsp.writeFile(path.join(root, "covers", coverFile), tags.cover.data);
  }

  // Check for paired .lrc file in the same directory (same filename with .lrc extension)
  let lrcFile: string | undefined;
  try {
    const parsedSource = path.parse(source);
    const candidateLrc = path.join(parsedSource.dir, `${parsedSource.name}.lrc`);
    if (fs.existsSync(candidateLrc)) {
      lrcFile = `${id}.lrc`;
      await fsp.mkdir(path.join(root, "lyrics"), { recursive: true });
      await fsp.copyFile(candidateLrc, path.join(root, "lyrics", lrcFile));
    }
  } catch {
    // Non-fatal if lrc reading fails
  }

  return {
    id,
    title: tags.title,
    artist: tags.artist,
    ...(tags.album ? { album: tags.album } : {}),
    durationMs: tags.durationMs,
    fileName: path.basename(source),
    audioFile,
    mimeType: tags.mimeType,
    ...(coverFile ? { coverFile } : {}),
    ...(lrcFile ? { lrcFile } : {}),
    byteSize: stat.size,
    addedAt: Date.now(),
  };
}
