export interface MediaSourceFeed {
  url: string;
  append: (chunk: Uint8Array<ArrayBuffer>) => void;
  end: () => void;
  fail: () => void;
  overflowed: () => boolean;
  dispose: () => void;
}

const QUOTA_RETRY_MS = 2000;

export function canFeedMediaSource(mimeType: string): boolean {
  return (
    typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(mimeType)
  );
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "QuotaExceededError";
}

export function createMediaSourceFeed(
  mimeType: string,
  durationSeconds: number,
): MediaSourceFeed {
  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);
  const queue: Uint8Array<ArrayBuffer>[] = [];
  let buffer: SourceBuffer | null = null;
  let ending = false;
  let complete = false;
  let stopped = false;
  let overflow = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (complete || stopped || mediaSource.readyState !== "open") return;
    try {
      mediaSource.endOfStream();
      complete = true;
    } catch {
      complete = false;
    }
  };

  const flush = () => {
    if (!buffer || buffer.updating || stopped || retryTimer) return;
    const next = queue.shift();
    if (!next) {
      if (ending) finish();
      return;
    }
    try {
      buffer.appendBuffer(next);
    } catch (error) {
      queue.unshift(next);
      if (!isQuotaError(error)) return;
      overflow = true;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        flush();
      }, QUOTA_RETRY_MS);
    }
  };

  mediaSource.addEventListener(
    "sourceopen",
    () => {
      buffer = mediaSource.addSourceBuffer(mimeType);
      if (durationSeconds > 0) mediaSource.duration = durationSeconds;
      buffer.addEventListener("updateend", flush);
      flush();
    },
    { once: true },
  );

  const stop = () => {
    stopped = true;
    queue.length = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  return {
    url,
    append: (chunk) => {
      queue.push(chunk);
      flush();
    },
    end: () => {
      ending = true;
      flush();
    },
    fail: () => {
      if (mediaSource.readyState === "open" && !complete) {
        try {
          mediaSource.endOfStream("network");
        } catch {
          complete = false;
        }
      }
      stop();
    },
    overflowed: () => overflow,
    dispose: () => {
      stop();
      URL.revokeObjectURL(url);
    },
  };
}
