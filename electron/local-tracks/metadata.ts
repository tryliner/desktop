import path from "node:path";
import { parseFile } from "music-metadata";

export interface LocalTrackTags {
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
  mimeType: string;
  cover?: { data: Uint8Array; extension: string };
}

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

const EXTENSION_BY_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/jfif": "jpg",
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

export function imageExtensionFor(
  format: string | undefined,
): string | undefined {
  if (!format) return undefined;
  const f = format.toLowerCase().trim();
  if (EXTENSION_BY_IMAGE_MIME[f]) return EXTENSION_BY_IMAGE_MIME[f];
  if (f.includes("jpeg") || f.includes("jpg")) return "jpg";
  if (f.includes("png")) return "png";
  if (f.includes("webp")) return "webp";
  if (f.includes("gif")) return "gif";
  return undefined;
}

export function audioExtension(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}

export function mimeTypeFor(filePath: string): string {
  return (
    MIME_BY_EXTENSION[audioExtension(filePath)] ?? "application/octet-stream"
  );
}

function namesFromFileName(filePath: string): {
  title: string;
  artist: string;
} {
  const base = path.basename(filePath, path.extname(filePath)).trim();
  const cleaned = base.replace(/^\d{1,3}[\s.\-_]+/, "").trim() || base;
  const separator = cleaned.indexOf(" - ");
  if (separator > 0) {
    return {
      artist: cleaned.slice(0, separator).trim(),
      title: cleaned.slice(separator + 3).trim(),
    };
  }
  return { title: cleaned, artist: "" };
}

export async function readLocalTrackTags(
  filePath: string,
): Promise<LocalTrackTags> {
  const fallback = namesFromFileName(filePath);
  const mimeType = mimeTypeFor(filePath);
  try {
    const { common, format } = await parseFile(filePath, { duration: true });
    const picture = common.picture?.[0];
    const coverExtension = imageExtensionFor(picture?.format);
    return {
      title: common.title?.trim() || fallback.title,
      artist:
        common.artists?.join(", ").trim() ||
        common.artist?.trim() ||
        fallback.artist,
      ...(common.album?.trim() ? { album: common.album.trim() } : {}),
      durationMs: Math.round((format.duration ?? 0) * 1000),
      mimeType,
      ...(picture && coverExtension
        ? { cover: { data: picture.data, extension: coverExtension } }
        : {}),
    };
  } catch {
    return { ...fallback, durationMs: 0, mimeType };
  }
}
