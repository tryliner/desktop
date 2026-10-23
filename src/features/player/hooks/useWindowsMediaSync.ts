import { useEffect, useRef } from "react";
import { usePlayerState } from "./usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { usePlayerStore } from "../store/playerStore";
import type { Track } from "@/shared/types";
import type {
  SmtcMediaAction,
  SmtcMediaUpdatePayload,
} from "@/electron";

export type { SmtcMediaAction, SmtcMediaUpdatePayload };

/**
 * Truncates and sanitizes text for SMTC display (R3-C3).
 * If text exceeds maxLen (default 100), truncates to (maxLen - 3) + "...".
 */
export function sanitizeForSmtc(text?: string | null, maxLen = 100): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length > maxLen) {
    return trimmed.slice(0, maxLen - 3) + "...";
  }
  return trimmed;
}

/**
 * Normalizes artist information into a display string.
 */
export function formatArtistString(track: Track | null): string {
  if (!track) return "";
  if (typeof track.artists === "string" && track.artists.trim().length > 0) {
    return track.artists.trim();
  }
  if (Array.isArray(track.artistList) && track.artistList.length > 0) {
    return track.artistList
      .map((a) => (typeof a === "string" ? a : a?.name))
      .filter(Boolean)
      .join(", ");
  }
  return "Unknown Artist";
}

/**
 * Maps player state snapshot into SmtcMediaUpdatePayload (R3-C1, R3-C3, R3-C4).
 */
export function createSmtcPayload(
  status: string,
  currentTrack: Track | null,
  positionMs: number,
  durationMs: number,
): SmtcMediaUpdatePayload {
  if (!currentTrack || status === "idle") {
    return {
      status: "idle",
      track: null,
      positionMs: 0,
      durationMs: 0,
    };
  }

  let mappedStatus: SmtcMediaUpdatePayload["status"] = "idle";
  if (status === "playing") mappedStatus = "playing";
  else if (status === "paused") mappedStatus = "paused";
  else if (status === "loading") mappedStatus = "loading";
  else mappedStatus = "idle";

  const cleanTitle = sanitizeForSmtc(currentTrack.title, 100);
  const cleanArtists = sanitizeForSmtc(formatArtistString(currentTrack), 100);
  const cleanCover = currentTrack.coverUrl?.trim() ? currentTrack.coverUrl.trim() : undefined;
  const effectiveDuration = currentTrack.durationMs || durationMs || 0;

  return {
    status: mappedStatus,
    track: {
      id: currentTrack.id,
      title: cleanTitle,
      artists: cleanArtists,
      coverUrl: cleanCover,
      durationMs: effectiveDuration,
    },
    positionMs: Math.max(0, positionMs),
    durationMs: effectiveDuration,
  };
}

/**
 * Dispatches SMTC action to player store or engine.
 */
export function handleSmtcAction(action: SmtcMediaAction): void {
  const store = usePlayerStore.getState() as any;

  switch (action) {
    case "togglePlay":
      if (typeof store.togglePlay === "function") {
        store.togglePlay();
      } else {
        void playerEngine.togglePlayPause();
      }
      break;

    case "play":
      if (typeof store.play === "function") {
        store.play();
      } else {
        void playerEngine.resume();
      }
      break;

    case "pause":
      if (typeof store.pause === "function") {
        store.pause();
      } else {
        playerEngine.pause();
      }
      break;

    case "next":
      if (typeof store.next === "function") {
        store.next();
      } else {
        void playerEngine.skipNext();
      }
      break;

    case "prev":
      if (typeof store.prev === "function") {
        store.prev();
      } else {
        void playerEngine.skipPrevious();
      }
      break;

    case "stop":
      if (typeof store.stop === "function") {
        store.stop();
      } else {
        void playerEngine.stopAndClear();
      }
      break;
  }
}

/**
 * React hook that coordinates bidirectional synchronization between Liner renderer
 * and Windows SMTC / Taskbar thumbnail controls via Electron IPC.
 */
export function useWindowsMediaSync(): void {
  const player = usePlayerState();
  const lastStateSentRef = useRef<string>("");
  const lastPositionRef = useRef<number>(0);

  // 1. Listen for incoming media actions from Windows SMTC / Taskbar
  useEffect(() => {
    if (!window.linerElectron?.onMediaAction) return;

    const cleanup = window.linerElectron.onMediaAction((action: SmtcMediaAction) => {
      handleSmtcAction(action);
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // 2. Broadcast playback and metadata updates to Windows SMTC
  useEffect(() => {
    if (!window.linerElectron?.sendMediaUpdate) return;

    const payload = createSmtcPayload(
      player.status,
      player.currentTrack,
      player.positionMs,
      player.durationMs,
    );

    // Throttle continuous progress ticks (1Hz / 1000ms), but immediately emit upon
    // track change, status change, or seek.
    const positionSec = Math.floor(payload.positionMs / 1000);
    const isSeek = Math.abs(payload.positionMs - lastPositionRef.current) > 1500;
    lastPositionRef.current = payload.positionMs;

    const serializationKey = JSON.stringify({
      status: payload.status,
      trackId: payload.track?.id,
      title: payload.track?.title,
      artists: payload.track?.artists,
      posSec: isSeek ? payload.positionMs : positionSec,
      durationMs: payload.durationMs,
    });

    if (serializationKey !== lastStateSentRef.current) {
      lastStateSentRef.current = serializationKey;
      window.linerElectron.sendMediaUpdate(payload);
    }
  }, [player.status, player.currentTrack, player.positionMs, player.durationMs]);
}

export function WindowsMediaSync() {
  useWindowsMediaSync();
  return null;
}
