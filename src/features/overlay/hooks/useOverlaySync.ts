import { useEffect, useRef, useState } from "react";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  useIsTrackLiked,
} from "@/features/library/hooks";
import { useLikeTrack } from "@/features/library/hooks/likes/useLikeTrack";
import { useUnlikeTrack } from "@/features/library/hooks/likes/useUnlikeTrack";
import { useCoverSrc } from "@/features/covers";
import { getAuthSession } from "@/shared/api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { showToast } from "@/shared/ui/Toast";
import type { OverlayAction, OverlayStatePayload } from "../contracts";
import { useOverlaySettingsStore } from "../store/overlaySettingsStore";

const PLAYING_RESYNC_DRIFT_MS = 1_500;
const PAUSED_RESYNC_DRIFT_MS = 250;

interface SentPosition {
  positionMs: number;
  at: number;
  rate: number;
  playing: boolean;
}

export function useOverlaySync() {
  const authStatus = useAuthStore((s) => s.status);
  const isAuthenticated =
    authStatus === "authenticated" || Boolean(getAuthSession());
  const status = usePlayerStore((s) => s.status);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const volume = usePlayerStore((s) => s.volume);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const effectiveCover = useCoverSrc(currentTrack?.coverUrl);
  const isLiked = useIsTrackLiked(currentTrack?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();
  const isTogglingLikeRef = useRef(false);
  const sentPositionRef = useRef<SentPosition | null>(null);
  const [seekTick, setSeekTick] = useState(0);

  // Sync auth status to Electron overlay manager
  useEffect(() => {
    window.linerElectron?.setOverlayAuthenticated?.(isAuthenticated);
    if (!isAuthenticated) {
      window.linerElectron?.closeOverlay?.();
    }
  }, [isAuthenticated]);

  // Sync settings on mount
  useEffect(() => {
    const s = useOverlaySettingsStore.getState();
    window.linerElectron?.updateOverlaySettings?.({
      enabled: s.enabled,
      position: s.position,
      shortcut: s.shortcut,
      autoShowOnMinimize: s.autoShowOnMinimize,
      alwaysOnTop: s.alwaysOnTop,
    });
  }, []);

  // Hide overlay when user logs out or session is cleared
  useEffect(() => {
    const handleAuthChange = () => {
      const session = getAuthSession();
      const authed = Boolean(session);
      window.linerElectron?.setOverlayAuthenticated?.(authed);
      if (!authed) {
        window.linerElectron?.closeOverlay?.();
        window.linerElectron?.sendOverlayAction?.({ type: "closeOverlay" });
      }
    };
    window.addEventListener("auth:changed", handleAuthChange);
    return () => {
      window.removeEventListener("auth:changed", handleAuthChange);
    };
  }, []);

  // Listen for actions from overlay
  useEffect(() => {
    if (!window.linerElectron?.onOverlayAction) return;

    const cleanup = window.linerElectron.onOverlayAction(
      (action: OverlayAction) => {
        switch (action.type) {
          case "togglePlay":
            void playerEngine.togglePlayPause();
            break;
          case "play":
            void playerEngine.resume();
            break;
          case "pause":
            playerEngine.pause();
            break;
          case "next":
            void playerEngine.skipNext();
            break;
          case "prev":
            void playerEngine.skipPrevious();
            break;
          case "seek":
            if (typeof action.payload?.positionMs === "number") {
              playerEngine.seek(action.payload.positionMs);
            }
            break;
          case "like":
            if (currentTrack && !isTogglingLikeRef.current) {
              isTogglingLikeRef.current = true;
              const fromGlobal = Boolean(
                (action.payload as any)?.fromGlobalShortcut ||
                (action as any).fromGlobalShortcut,
              );
              const onSettled = () => {
                isTogglingLikeRef.current = false;
              };
              if (isLiked) {
                unlikeMutation.mutate(currentTrack.id, {
                  onSuccess: () => {
                    if (fromGlobal) {
                      showToast(currentTrack.title || "Song", "info", {
                        description: "Removed from favorites",
                      });
                    }
                  },
                  onSettled,
                });
              } else {
                likeMutation.mutate(currentTrack.id, {
                  onSuccess: () => {
                    if (fromGlobal) {
                      showToast(currentTrack.title || "Song", "checkmark", {
                        description: "Added to favorites",
                      });
                    }
                  },
                  onSettled,
                });
              }
            }
            break;
          case "volumeUp": {
            const current = usePlayerStore.getState().volume;
            const next = Math.min(1, Math.round((current + 0.05) * 100) / 100);
            playerEngine.setVolume(next);
            break;
          }
          case "volumeDown": {
            const current = usePlayerStore.getState().volume;
            const next = Math.max(0, Math.round((current - 0.05) * 100) / 100);
            playerEngine.setVolume(next);
            break;
          }
          case "setVolume": {
            if (typeof action.payload?.volume === "number") {
              const next = Math.min(1, Math.max(0, action.payload.volume));
              playerEngine.setVolume(next);
            }
            break;
          }
          case "focusMainWindow":
            break;
        }
      },
    );

    return cleanup;
  }, [currentTrack, isLiked, likeMutation, unlikeMutation]);

  useEffect(() => {
    return usePlayerStore.subscribe((state, prev) => {
      if (state.positionMs === prev.positionMs) return;
      const sent = sentPositionRef.current;
      if (!sent) return;
      const expected = sent.playing
        ? sent.positionMs + (Date.now() - sent.at) * sent.rate
        : sent.positionMs;
      const allowedDrift = sent.playing
        ? PLAYING_RESYNC_DRIFT_MS
        : PAUSED_RESYNC_DRIFT_MS;
      if (Math.abs(state.positionMs - expected) > allowedDrift) {
        sentPositionRef.current = null;
        setSeekTick((t) => t + 1);
      }
    });
  }, []);

  useEffect(() => {
    if (!window.linerElectron?.overlayUpdateState) return;
    if (!isAuthenticated) return;

    const artistName =
      (currentTrack?.artists && typeof currentTrack.artists === "string"
        ? currentTrack.artists
        : "") ||
      ((currentTrack as any)?.artist &&
      typeof (currentTrack as any).artist === "string"
        ? (currentTrack as any).artist
        : "") ||
      (Array.isArray(currentTrack?.artistList) &&
      currentTrack.artistList.length > 0
        ? currentTrack.artistList
            .map((a: any) => (typeof a === "string" ? a : a?.name))
            .filter(Boolean)
            .join(", ")
        : "") ||
      "";

    const positionMs = usePlayerStore.getState().positionMs;
    const positionAt = Date.now();
    const rate = playbackRate > 0 ? playbackRate : 1;

    const payload: OverlayStatePayload = {
      status,
      track: currentTrack
        ? {
            id: currentTrack.id,
            title: currentTrack.title,
            artist: artistName,
            album:
              typeof currentTrack.album === "string"
                ? currentTrack.album
                : currentTrack.album?.title,
            cover: effectiveCover || currentTrack.coverUrl,
            coverUrl: effectiveCover || currentTrack.coverUrl,
            durationMs: currentTrack.durationMs || durationMs,
          }
        : null,
      positionMs,
      positionAt,
      playbackRate: rate,
      durationMs,
      volume,
      isLiked,
    };

    sentPositionRef.current = {
      positionMs,
      at: positionAt,
      rate,
      playing: status === "playing",
    };
    window.linerElectron.overlayUpdateState(payload);
  }, [
    isAuthenticated,
    status,
    durationMs,
    volume,
    playbackRate,
    currentTrack,
    effectiveCover,
    isLiked,
    seekTick,
  ]);
}
