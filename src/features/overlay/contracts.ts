export type OverlayPosition = "top-left" | "top-center" | "top-right";

export interface OverlaySettings {
  enabled: boolean;
  position: OverlayPosition;
  shortcut: string;
  autoShowOnMinimize: boolean;
  alwaysOnTop: boolean;
}

export interface OverlayTrackInfo {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string | null;
  coverUrl?: string;
  durationMs?: number;
}

export interface OverlayStatePayload {
  status: "playing" | "paused" | "loading" | "buffering" | "idle" | "error";
  track: OverlayTrackInfo | null;
  positionMs: number;
  positionAt?: number;
  playbackRate?: number;
  durationMs: number;
  volume: number;
  isLiked: boolean;
}

export interface OverlayAction {
  type:
    | "togglePlay"
    | "play"
    | "pause"
    | "next"
    | "prev"
    | "seek"
    | "seekBy"
    | "toggleMute"
    | "like"
    | "volumeUp"
    | "volumeDown"
    | "setVolume"
    | "focusMainWindow"
    | "closeOverlay";
  payload?: any;
}
