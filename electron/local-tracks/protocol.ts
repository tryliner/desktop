import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { protocol } from "electron";
import type { LocalTrackLibrary } from "./library.js";

export const LOCAL_TRACK_SCHEME = "liner-local";

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const BASE_HEADERS = {
  "access-control-allow-origin": "*",
  "accept-ranges": "bytes",
  "cache-control": "no-cache",
};

export function registerLocalTrackScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_TRACK_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function parseRange(header: string | null, size: number) {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start > end || start >= size) return null;
  return { start, end };
}

async function fileResponse(
  filePath: string,
  mimeType: string,
  request: Request,
) {
  const { size } = await fsp.stat(filePath);
  const range = parseRange(request.headers.get("range"), size);
  if (!range) {
    const body = Readable.toWeb(
      fs.createReadStream(filePath),
    ) as ReadableStream;
    return new Response(body, {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        "content-type": mimeType,
        "content-length": String(size),
      },
    });
  }
  const stream = fs.createReadStream(filePath, {
    start: range.start,
    end: range.end,
  });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 206,
    headers: {
      ...BASE_HEADERS,
      "content-type": mimeType,
      "content-length": String(range.end - range.start + 1),
      "content-range": `bytes ${range.start}-${range.end}/${size}`,
    },
  });
}

export function handleLocalTrackScheme(library: LocalTrackLibrary) {
  protocol.handle(LOCAL_TRACK_SCHEME, async (request) => {
    const url = new URL(request.url);
    const kind =
      url.hostname === "audio"
        ? "audio"
        : url.hostname === "cover"
          ? "cover"
          : url.hostname === "lyrics"
            ? "lyrics"
            : null;
    const id = url.pathname.replace(/^\/+/, "");
    const located = kind ? await library.locate(kind, id) : null;
    if (!kind || !located)
      return new Response(null, { status: 404, headers: BASE_HEADERS });
    const mimeType =
      kind === "audio"
        ? located.record.mimeType
        : kind === "lyrics"
          ? "text/plain; charset=utf-8"
          : (IMAGE_MIME[path.extname(located.path)] ??
            "application/octet-stream");
    try {
      return await fileResponse(located.path, mimeType, request);
    } catch {
      return new Response(null, { status: 404, headers: BASE_HEADERS });
    }
  });
}
