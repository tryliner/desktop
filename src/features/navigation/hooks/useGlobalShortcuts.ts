import { useEffect, useRef } from "react";
import { playerEngine, usePlayerStore, toVolumeGain, toVolumeLevel } from "@/features/player";
import { useShortcutsStore, matchesShortcut } from "@/features/shortcuts";
import {
  isBlockingOverlayOpen,
  isKeyHandledByFocusedControl,
  isTypingTarget,
} from "../utils/shortcutGuards";

const VOLUME_STEP = 0.05;
const SEEK_STEP_MS = 5_000;
const DEFAULT_UNMUTE_LEVEL = 0.7;

function roundToPercent(level: number): number {
  return Math.round(level * 100) / 100;
}

const REPEATABLE_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export type RightPanelTab = "queue" | "lyrics";

export interface GlobalShortcutsOptions {
  enabled?: boolean;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  openRightPanel: (tab: RightPanelTab) => void;
  closeRightPanel: () => void;
  fullscreenOpen: boolean;
  openFullscreen: () => void;
  closeFullscreen: () => void;
  onEscapeFallback?: () => boolean;
}

export function useGlobalShortcuts(options: GlobalShortcutsOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const lastUnmutedLevelRef = useRef(DEFAULT_UNMUTE_LEVEL);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const opts = optionsRef.current;
      if (opts.enabled === false) return;
      if (event.defaultPrevented) return;
      if (useShortcutsStore.getState().isRecording) return;

      // ignore shortcuts if window does not have focus
      if (
        typeof document !== "undefined" &&
        typeof document.hasFocus === "function" &&
        process.env.NODE_ENV !== "test" &&
        !document.hasFocus()
      ) {
        return;
      }

      const { code } = event;
      if (event.repeat && !REPEATABLE_CODES.has(code)) return;

      if (code === "Escape" || event.key === "Escape") {
        if (isBlockingOverlayOpen()) return;
        if (opts.searchOpen) {
          event.preventDefault();
          event.stopPropagation();
          opts.closeSearch();
          return;
        }
        if (opts.rightPanelOpen) {
          event.preventDefault();
          event.stopPropagation();
          opts.closeRightPanel();
          return;
        }
        if (opts.fullscreenOpen) {
          event.preventDefault();
          event.stopPropagation();
          opts.closeFullscreen();
          return;
        }
        if (opts.onEscapeFallback?.()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (isBlockingOverlayOpen()) return;
      if (isKeyHandledByFocusedControl(event.target, code)) return;

      const { mainApp } = useShortcutsStore.getState();

      if (matchesShortcut(event, mainApp.playPause)) {
        event.preventDefault();
        playerEngine.togglePlayPause();
        return;
      }

      if (matchesShortcut(event, mainApp.nextTrack)) {
        event.preventDefault();
        void playerEngine.skipNext();
        return;
      }

      if (matchesShortcut(event, mainApp.prevTrack)) {
        event.preventDefault();
        void playerEngine.skipPrevious();
        return;
      }

      if (matchesShortcut(event, mainApp.toggleFullscreen)) {
        event.preventDefault();
        if (opts.fullscreenOpen) {
          opts.closeFullscreen();
        } else {
          const { currentTrack, status } = usePlayerStore.getState();
          if (currentTrack !== null && status !== "idle") {
            opts.openFullscreen();
          }
        }
        return;
      }

      if (matchesShortcut(event, mainApp.toggleQueue)) {
        event.preventDefault();
        if (opts.rightPanelOpen && opts.rightPanelTab === "queue") opts.closeRightPanel();
        else opts.openRightPanel("queue");
        return;
      }

      if (matchesShortcut(event, mainApp.toggleLyrics)) {
        event.preventDefault();
        if (opts.rightPanelOpen && opts.rightPanelTab === "lyrics") opts.closeRightPanel();
        else opts.openRightPanel("lyrics");
        return;
      }

      if (matchesShortcut(event, mainApp.toggleMute)) {
        event.preventDefault();
        const level = toVolumeLevel(usePlayerStore.getState().volume);
        if (level > 0) {
          lastUnmutedLevelRef.current = level;
          playerEngine.setVolume(0);
        } else {
          playerEngine.setVolume(
            toVolumeGain(lastUnmutedLevelRef.current || DEFAULT_UNMUTE_LEVEL),
          );
        }
        return;
      }

      if (matchesShortcut(event, mainApp.search)) {
        event.preventDefault();
        opts.openSearch();
        return;
      }

      if (matchesShortcut(event, mainApp.seekBackward)) {
        event.preventDefault();
        const { positionMs } = usePlayerStore.getState();
        playerEngine.seek(Math.max(0, positionMs - SEEK_STEP_MS));
        return;
      }

      if (matchesShortcut(event, mainApp.seekForward)) {
        event.preventDefault();
        const { positionMs, durationMs } = usePlayerStore.getState();
        const upperBound = durationMs > 0 ? durationMs : positionMs + SEEK_STEP_MS;
        playerEngine.seek(Math.min(upperBound, positionMs + SEEK_STEP_MS));
        return;
      }

      if (matchesShortcut(event, mainApp.volumeUp)) {
        event.preventDefault();
        const level = toVolumeLevel(usePlayerStore.getState().volume);
        const nextLevel = roundToPercent(Math.min(1, level + VOLUME_STEP));
        playerEngine.setVolume(toVolumeGain(nextLevel));
        if (nextLevel > 0) lastUnmutedLevelRef.current = nextLevel;
        return;
      }

      if (matchesShortcut(event, mainApp.volumeDown)) {
        event.preventDefault();
        const level = toVolumeLevel(usePlayerStore.getState().volume);
        const nextLevel = roundToPercent(Math.max(0, level - VOLUME_STEP));
        playerEngine.setVolume(toVolumeGain(nextLevel));
        if (nextLevel > 0) lastUnmutedLevelRef.current = nextLevel;
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
