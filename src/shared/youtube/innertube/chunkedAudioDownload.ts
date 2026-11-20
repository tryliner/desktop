import { runWorkerPool } from "@/shared/utils/workerPool";

export interface AudioDownloadOptions {
  contentLength?: number;
  signal?: AbortSignal;
  chunkSize?: number;
  concurrency?: number;
  onProgress?: (received: number, total: number | null) => void;
}

const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const DEFAULT_CONCURRENCY = 4;
const MAX_CHUNK_ATTEMPTS = 2;

export function isGoogleVideoUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".googlevideo.com");
  } catch {
    return false;
  }
}

function withRange(url: string, start: number, end: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("range", `${start}-${end}`);
  return parsed.toString();
}

async function fetchChunk(
  url: string,
  start: number,
  end: number,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const expected = end - start + 1;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(withRange(url, start, end), { signal });
      if (!response.ok)
        throw new Error(
          `chunk ${start}-${end} returned HTTP ${response.status}`,
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== expected)
        throw new Error(
          `chunk ${start}-${end} returned ${bytes.byteLength} of ${expected} bytes`,
        );
      return bytes;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

async function downloadInChunks(
  url: string,
  total: number,
  options: AudioDownloadOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const starts = Array.from(
    { length: Math.ceil(total / chunkSize) },
    (_, index) => index * chunkSize,
  );
  const output = new Uint8Array(total);
  let received = 0;
  options.onProgress?.(0, total);
  await runWorkerPool(
    starts,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (start) => {
      const end = Math.min(start + chunkSize, total) - 1;
      const chunk = await fetchChunk(url, start, end, options.signal);
      output.set(chunk, start);
      received += chunk.byteLength;
      options.onProgress?.(received, total);
    },
  );
  return output;
}

async function readWithProgress(
  response: Response,
  expected: number | null,
  onProgress: NonNullable<AudioDownloadOptions["onProgress"]>,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body!.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  onProgress(0, expected);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.byteLength;
    onProgress(received, expected);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

async function downloadWhole(
  url: string,
  signal?: AbortSignal,
  onProgress?: AudioDownloadOptions["onProgress"],
): Promise<Uint8Array<ArrayBuffer> | null> {
  const response = await fetch(url, { signal });
  if (!response.ok && response.status !== 206) return null;
  const totalBytes = Number(
    /\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1],
  );
  const length = Number(response.headers.get("content-length"));
  const expected = Number.isFinite(totalBytes)
    ? totalBytes
    : Number.isFinite(length) && length > 0
      ? length
      : null;
  const bytes =
    onProgress && response.body
      ? await readWithProgress(response, expected, onProgress)
      : new Uint8Array(await response.arrayBuffer());
  if (Number.isFinite(totalBytes) && bytes.byteLength < totalBytes) return null;
  return bytes;
}

export async function downloadAudioBytes(
  url: string,
  options: AudioDownloadOptions = {},
): Promise<Uint8Array<ArrayBuffer> | null> {
  const total = options.contentLength;
  const bytes =
    total && total > 0 && isGoogleVideoUrl(url)
      ? await downloadInChunks(url, total, options)
      : await downloadWhole(url, options.signal, options.onProgress);
  return bytes && bytes.byteLength > 0 ? bytes : null;
}
