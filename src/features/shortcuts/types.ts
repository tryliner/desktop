export interface GlobalShortcutsSettings {
  toggleOverlay: string; // e.g. "Alt+Shift+O"
  quickLikeSong: string; // e.g. "Alt+Shift+L"
}

export interface MainAppShortcutsSettings {
  playPause: string;        // e.g. "Space" (1 button)
  nextTrack: string;        // e.g. "Control+Right" (2 buttons)
  prevTrack: string;        // e.g. "Control+Left" (2 buttons)
  seekForward: string;      // e.g. "Right" (1 button)
  seekBackward: string;     // e.g. "Left" (1 button)
  volumeUp: string;         // e.g. "Up" (1 button)
  volumeDown: string;       // e.g. "Down" (1 button)
  toggleMute: string;       // e.g. "M" (1 button)
  search: string;           // e.g. "/" (1 button)
  toggleQueue: string;      // e.g. "Q" (1 button)
  toggleLyrics: string;     // e.g. "L" (1 button)
  toggleFullscreen: string; // e.g. "F" (1 button)
}

export interface MiniplayerShortcutsSettings {
  playPause: string;        // e.g. "Space" (1 button)
  nextTrack: string;        // e.g. "]" (1 button)
  prevTrack: string;        // e.g. "[" (1 button)
  likeTrack: string;        // e.g. "L" (1 button)
  seekForward: string;      // e.g. "Right" (1 button)
  seekBackward: string;     // e.g. "Left" (1 button)
  volumeUp: string;         // e.g. "Up" (1 button)
  volumeDown: string;       // e.g. "Down" (1 button)
  focusMainWindow: string;  // e.g. "F" (1 button)
}

export interface ShortcutsSettings {
  global: GlobalShortcutsSettings;
  mainApp: MainAppShortcutsSettings;
  miniplayer: MiniplayerShortcutsSettings;
}

export const DEFAULT_SHORTCUTS: ShortcutsSettings = {
  global: {
    toggleOverlay: "Alt+Shift+O",
    quickLikeSong: "Alt+Shift+L",
  },
  mainApp: {
    playPause: "Space",
    nextTrack: "Control+Right",
    prevTrack: "Control+Left",
    seekForward: "Right",
    seekBackward: "Left",
    volumeUp: "Up",
    volumeDown: "Down",
    toggleMute: "M",
    search: "/",
    toggleQueue: "Q",
    toggleLyrics: "L",
    toggleFullscreen: "F",
  },
  miniplayer: {
    playPause: "Space",
    nextTrack: "]",
    prevTrack: "[",
    likeTrack: "L",
    seekForward: "Right",
    seekBackward: "Left",
    volumeUp: "Up",
    volumeDown: "Down",
    focusMainWindow: "F",
  },
};

export type ShortcutScope = "global" | "mainApp" | "miniplayer";
