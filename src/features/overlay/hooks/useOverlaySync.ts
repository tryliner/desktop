import { useEffect, useRef } from "react";
import { usePlayerState } from "@/features/player/hooks/usePlayerState";
import { playerEngine } from "@/features/player/engine/playerEngine";
import {
  useIsTrackLiked,
  useLikeTrack,
  useUnlikeTrack,
} from "@/features/library/hooks";
import type {
  OverlayAction,
  OverlayStatePayload,
} from "../contracts";
import { useOverlaySettingsStore } from "../store/overlaySettingsStore";

export function useOverlaySync() {
  const player = usePlayerState();
  const currentTrack = player.currentTrack;
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
            const onSettled = () => {
              isTogglingLikeRef.current = false;
            };
            if (isLiked) {
              unlikeMutation.mutate(currentTrack.id, { onSettled });
            } else {
              likeMutation.mutate(currentTrack.id, { onSettled });
            }
          }
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
            cover: currentTrack.coverUrl,
            coverUrl: currentTrack.coverUrl,
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
    isLiked,
  ]);
}
