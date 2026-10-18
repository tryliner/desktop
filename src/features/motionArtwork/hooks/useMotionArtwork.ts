import { useEffect, useState } from "react";
import type { MotionArtworkResolution } from "../contracts";
import { useMotionArtworkSettingsStore } from "../store/motionArtworkSettingsStore";

export interface MotionArtworkTrackInput {
  title: string;
  artists: string;
  albumTitle?: string;
}

// Session-level cache so reopening the fullscreen player does not re-query
// main for a track that already resolved during this app run.
const SESSION_CACHE = new Map<string, MotionArtworkResolution>();

const DEBOUNCE_MS = 600;

export function useMotionArtwork(
  track: MotionArtworkTrackInput | null,
): MotionArtworkResolution | null {
  const enabled = useMotionArtworkSettingsStore((s) => s.enabled);
  const [resolution, setResolution] = useState<MotionArtworkResolution | null>(null);

  const requestKey =
    track && track.title && track.artists
      ? `${track.title}|${track.artists}|${track.albumTitle ?? ""}`
      : "";

  useEffect(() => {
    if (!enabled || !requestKey || !track) {
      setResolution(null);
      return;
    }
    const { title, artists, albumTitle } = track;
    const cached = SESSION_CACHE.get(requestKey);
    if (cached) {
      setResolution(cached);
      return;
    }
    setResolution(null);

    let cancelled = false;
    const timer = setTimeout(() => {
      const electron = typeof window !== "undefined" ? window.linerElectron : undefined;
      if (!electron?.getMotionArtwork) return;
      electron
        .getMotionArtwork({
          title,
          artist: artists,
          album: albumTitle,
        })
        .then((result) => {
          if (cancelled || !result) return;
          SESSION_CACHE.set(requestKey, result);
          setResolution(result);
        })
        .catch(() => {
          // resolution stays null; the static artwork keeps showing
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enabled]);

  return resolution;
}

export function clearMotionArtworkSessionCache(): void {
  SESSION_CACHE.clear();
}
