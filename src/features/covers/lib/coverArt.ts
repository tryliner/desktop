/**
 * Shared cover-art loader.
 *
 * Every cover is fetched exactly once, as a CORS request, and its readiness is
 * tracked in a module-level registry. All UI that renders the same cover URL
 * (mini player, fullscreen cover, blurred background, the Kawarp WebGL layer)
 * therefore hits a single browser/service-worker cache entry instead of racing
 * each other with mismatched request modes.
 *
 * Standardizing on `crossOrigin = "anonymous"` is deliberate: the WebGL
 * background needs a non-tainted texture and the mini player samples pixels for
 * its accent color, both of which require CORS. The cover CDNs all return
 * `Access-Control-Allow-Origin: *`, so this never costs us a request.
 */

import { useCallback, useSyncExternalStore } from "react";
import { prepareCoverFallback } from "./coverSigner";

type CoverStatus = "loading" | "loaded" | "error";

interface CoverEntry {
  status: CoverStatus;
  /**
   * The URL that actually decoded — the direct CDN `url` when it loads, or the
   * covers proxy when the direct URL failed and the fallback succeeded. Lets
   * surfaces that can't self-swap on error (CSS backgrounds, the WebGL texture)
   * read the working URL up front via `useCoverSrc`.
   */
  effectiveUrl?: string;
  /** Resolves once the load settles (loaded or errored); never rejects. */
  promise: Promise<void>;
  element?: HTMLImageElement;
}

const entries = new Map<string, CoverEntry>();
const listeners = new Map<string, Set<() => void>>();

function notify(url: string): void {
  const set = listeners.get(url);
  if (set) for (const listener of set) listener();
}

function subscribe(url: string, listener: () => void): () => void {
  let set = listeners.get(url);
  if (!set) {
    set = new Set();
    listeners.set(url, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(url);
  };
}

/** True once the cover has successfully decoded (a strict, no-fade success). */
export function isCoverReady(url: string | undefined): boolean {
  return !!url && entries.get(url)?.status === "loaded";
}

export function getCoverElement(url: string | undefined): HTMLImageElement | undefined {
  if (!url) return undefined;
  const entry = entries.get(url);
  return entry?.status === "loaded" ? entry.element : undefined;
}

/**
 * True once the cover load has settled — decoded OR failed. UI uses this to
 * stop the loading placeholder: a cover that 404s or is rate-limited still
 * settles, so the placeholder never pulses forever.
 */
function isCoverSettled(url: string | undefined): boolean {
  const status = url ? entries.get(url)?.status : undefined;
  return status === "loaded" || status === "error";
}

/**
 * Record a cover as ready. Call from an `<img>`'s `onLoad` so a natural render
 * populates the same registry a `preloadCoverArt` call would. `effectiveUrl` is
 * the URL that actually decoded (the proxy when a `CoverImage` swapped to it),
 * so `useCoverSrc` consumers pick up the working URL.
 */
export function markCoverReady(url: string | undefined, effectiveUrl?: string): void {
  if (!url) return;
  const resolved = effectiveUrl ?? url;
  const entry = entries.get(url);
  if (entry) {
    entry.effectiveUrl = resolved;
    if (entry.status !== "loaded") {
      entry.status = "loaded";
      notify(url);
    }
    return;
  }
  entries.set(url, { status: "loaded", effectiveUrl: resolved, promise: Promise.resolve() });
  notify(url);
}

/**
 * Begin loading a cover if it isn't already tracked. Idempotent: repeated calls
 * for the same URL return the original in-flight promise.
 *
 * The covers.tryliner.fun proxy fallback (derived from `url`, see
 * `coverSigner`) is tried exactly once if the direct `url` fails to load, so
 * the registry only settles as "error" when both the direct CDN and the proxy
 * are unreachable (or the host isn't proxyable). Readiness stays keyed by the
 * primary `url`, so every surface observing it agrees regardless of which URL
 * ultimately decoded.
 */
export function preloadCoverArt(url: string | undefined): Promise<void> {
  if (!url || typeof window === "undefined") return Promise.resolve();

  const existing = entries.get(url);
  if (existing) return existing.promise;

  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";

  // mint and sign proxy fallback in parallel with direct cdn load
  void prepareCoverFallback(url);

  const promise = new Promise<void>((resolve) => {
    let triedFallback = false;
    const settle = (status: CoverStatus, effectiveUrl?: string) => {
      const entry = entries.get(url);
      if (entry) {
        entry.status = status;
        if (effectiveUrl) entry.effectiveUrl = effectiveUrl;
        if (status === "loaded") entry.element = img;
      }
      notify(url);
      resolve();
    };
    img.onload = () => settle("loaded", img.src);
    img.onerror = () => {
      // Direct CDN URL failed (e.g. Google blocked by RKN). Retry once through
      // the proxy (derived from this URL, HMAC-signed on desktop) before
      // reporting the cover unavailable. A non-proxyable host yields no
      // fallback, so it settles as an error immediately.
      if (!triedFallback) {
        triedFallback = true;
        void prepareCoverFallback(url).then((fallback) => {
          if (fallback) img.src = fallback;
          else settle("error");
        });
        return;
      }
      settle("error");
    };
  });

  entries.set(url, { status: "loading", promise });
  img.src = url;
  return promise;
}

/**
 * Subscribe a component to a cover's readiness. Returns `true` synchronously
 * (via useSyncExternalStore) the moment the URL is already cached, so
 * revisiting a played track shows its art with no placeholder and no fade, and
 * a mid-render URL change never leaks the previous cover's state.
 */
export function useCoverReady(url: string | undefined): boolean {
  const subscribeToUrl = useCallback(
    (onChange: () => void) => {
      if (!url) return () => {};
      // Kick off the fetch here so simply rendering a cover loads it, without
      // callers needing a separate preload call.
      void preloadCoverArt(url);
      return subscribe(url, onChange);
    },
    [url],
  );

  return useSyncExternalStore(
    subscribeToUrl,
    () => isCoverSettled(url),
    () => false,
  );
}

/** The effective URL for a cover: the proxy once a direct load has failed over
 * to it, otherwise the direct `url` itself. */
function effectiveCoverSrc(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return entries.get(url)?.effectiveUrl ?? url;
}

/**
 * Resolve the URL a surface should actually render for `url`, following the
 * direct→proxy fallback. For consumers that can't self-swap on a load error —
 * CSS `background-image`, the Kawarp WebGL texture — this returns the direct
 * URL first, then re-renders with the covers proxy once the direct URL is known
 * to have failed. Shares the single registry/loader, so it costs no extra
 * request beyond what `CoverImage`/`useCoverReady` already issue for the cover.
 */
export function useCoverSrc(url: string | undefined): string | undefined {
  const subscribeToUrl = useCallback(
    (onChange: () => void) => {
      if (!url) return () => {};
      void preloadCoverArt(url);
      return subscribe(url, onChange);
    },
    [url],
  );

  return useSyncExternalStore(
    subscribeToUrl,
    () => effectiveCoverSrc(url),
    () => url,
  );
}
