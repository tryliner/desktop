export interface TouchBarWordData {
  timeMs: number;
  endMs: number;
  text: string;
}

export interface TouchBarActiveLine {
  text: string;
  timeMs: number;
  durationMs?: number;
  words?: TouchBarWordData[];
  isInstrumental?: boolean;
}

export interface TouchBarTrackInfo {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string | null;
  durationMs?: number;
}

export interface TouchBarStatePayload {
  status: "playing" | "paused" | "loading" | "buffering" | "idle" | "error";
  track: TouchBarTrackInfo | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  isLiked: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  activeLine: TouchBarActiveLine | null;
  activeLyricText?: string;
  nextLyricText?: string;
  offsetMs?: number;
  currentRoute?: string;
  isFullscreen?: boolean;
  hasSyncedLyrics?: boolean;
}

export interface TouchBarAction {
  type:
    | "togglePlay"
    | "play"
    | "pause"
    | "next"
    | "prev"
    | "seek"
    | "like"
    | "volume"
    | "adjustOffset"
    | "navigate"
    | "toggleShuffle"
    | "toggleFullscreen";
  payload?: any;
}
