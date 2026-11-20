import { useCallback, useEffect, useRef, useState } from "react";
import { prepareCoverFallback } from "../lib/coverSigner";
import { MAX_ANIMATED_BYTES, type Size } from "./coverCrop";
import { isAnimatedImage } from "./imageFormat";
import { PlaylistCoverError } from "./playlistCoverStore";

const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

export interface LoadedImage {
  blob: Blob;
  url: string;
  size: Size;
  bitmap: ImageBitmap | null;
  animated: boolean;
}

async function fetchBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (response.ok) return await response.blob();
  } catch {}
  const fallback = await prepareCoverFallback(url);
  if (!fallback) throw new PlaylistCoverError("failed");
  const response = await fetch(fallback, { mode: "cors" });
  if (!response.ok) throw new PlaylistCoverError("failed");
  return response.blob();
}

async function decode(blob: Blob): Promise<LoadedImage> {
  if (blob.size > MAX_SOURCE_BYTES) throw new PlaylistCoverError("too-large");
  const animated = isAnimatedImage(new Uint8Array(await blob.arrayBuffer()));
  if (animated && blob.size > MAX_ANIMATED_BYTES) {
    throw new PlaylistCoverError("too-large");
  }
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) throw new PlaylistCoverError("unsupported-type");
  return {
    blob,
    url: URL.createObjectURL(blob),
    size: { width: bitmap.width, height: bitmap.height },
    bitmap,
    animated,
  };
}

function release(image: LoadedImage | null) {
  if (!image) return;
  URL.revokeObjectURL(image.url);
  image.bitmap?.close();
}

export function useCoverImage(onError: (error: unknown) => void) {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const current = useRef<LoadedImage | null>(null);
  const request = useRef(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const replace = useCallback((next: LoadedImage | null) => {
    if (current.current !== next) release(current.current);
    current.current = next;
    setImage(next);
  }, []);

  const load = useCallback(
    async (source: () => Promise<Blob>) => {
      const id = ++request.current;
      setLoading(true);
      try {
        const decoded = await decode(await source());
        if (id !== request.current) {
          release(decoded);
          return;
        }
        replace(decoded);
      } catch (error) {
        if (id === request.current) onErrorRef.current(error);
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [replace],
  );

  const loadBlob = useCallback(
    (blob: Blob) => load(() => Promise.resolve(blob)),
    [load],
  );
  const loadUrl = useCallback(
    (url: string) => load(() => fetchBlob(url)),
    [load],
  );
  const clear = useCallback(() => {
    request.current += 1;
    setLoading(false);
    replace(null);
  }, [replace]);

  useEffect(
    () => () => {
      request.current += 1;
      release(current.current);
      current.current = null;
    },
    [],
  );

  return { image, loading, loadBlob, loadUrl, clear };
}
