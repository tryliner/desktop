import { useEffect, useRef } from "react";
import { usePlayerState } from "@/features/player/hooks/usePlayerState";
import { playerEngine } from "@/features/player/engine/playerEngine";
import {
  useIsTrackLiked,
  useLikeTrack,
  useUnlikeTrack,
} from "@/features/library/hooks";
import { useCoverSrc } from "@/features/covers";
import { getAuthSession } from "@/shared/api";
import { showToast } from "@/shared/ui/Toast";
import type {
  OverlayAction,
  OverlayStatePayload,
} from "../contracts";
import { useOverlaySettingsStore } from "../store/overlaySettingsStore";

export function useOverlaySync() {
  const player = usePlayerState();
  const currentTrack = player.currentTrack;
  const effectiveCover = useCoverSrc(currentTrack?.coverUrl);
  const isLiked = useIsTrackLiked(currentTrack?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();
  const isTogglingLikeRef = useRef(false);

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
      if (!session) {
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

    const cleanup = window.linerElectron.onOverlayAction((action: OverlayAction) => {
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
              (action.payload as any)?.fromGlobalShortcut || (action as any).fromGlobalShortcut
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
          const current = player.volume;
          const next = Math.min(1, Math.round((current + 0.05) * 100) / 100);
          playerEngine.setVolume(next);
          break;
        }
        case "volumeDown": {
          const current = player.volume;
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
    });

    return cleanup;
  }, [currentTrack, isLiked, likeMutation, unlikeMutation]);

  // Push updates to overlay
  useEffect(() => {
    if (!window.linerElectron?.overlayUpdateState) return;

    const artistName =
      (currentTrack?.artists && typeof currentTrack.artists === "string" ? currentTrack.artists : "") ||
      ((currentTrack as any)?.artist && typeof (currentTrack as any).artist === "string" ? (currentTrack as any).artist : "") ||
      (Array.isArray(currentTrack?.artistList) && currentTrack.artistList.length > 0
        ? currentTrack.artistList
            .map((a: any) => (typeof a === "string" ? a : a?.name))
            .filter(Boolean)
            .join(", ")
        : "") ||
      "";

    const payload: OverlayStatePayload = {
      status: player.status,
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
            durationMs: currentTrack.durationMs || player.durationMs,
          }
        : null,
      positionMs: player.positionMs,
      durationMs: player.durationMs,
      volume: player.volume,
      isLiked,
    };

    window.linerElectron.overlayUpdateState(payload);
  }, [
    player.status,
    player.positionMs,
    player.durationMs,
    player.volume,
    currentTrack,
    effectiveCover,
    isLiked,
  ]);
}
