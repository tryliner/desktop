/**
 * Decides a file's type from its first bytes. The renderer's MIME claim is
 * never trusted for what gets written to disk and served back.
 */

export type MediaMime =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "image/avif"
  | "video/mp4"
  | "video/webm";

const EXTENSIONS: Record<MediaMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function extensionFor(mime: MediaMime): string {
  return EXTENSIONS[mime];
}

export const MEDIA_MIME_BY_EXTENSION: Record<string, MediaMime> =
  Object.fromEntries(
    Object.entries(EXTENSIONS).map(([mime, ext]) => [`.${ext}`, mime]),
  ) as Record<string, MediaMime>;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function sniffMediaType(bytes: Uint8Array): MediaMime | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  const head6 = ascii(bytes, 0, 6);
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    // heic/heif can't be shown by Chromium, so don't accept them as video
    if (["heic", "heix", "mif1", "msf1"].includes(brand)) return null;
    return "video/mp4";
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  return null;
}
