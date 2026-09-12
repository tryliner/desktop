import { useEffect, useRef } from "react";
import { playerEngine, usePlayerStore, toVolumeGain, toVolumeLevel } from "@/features/player";
import {
  hasBlockingModifier,
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

const NON_REPEATABLE_CODES = new Set([
  "Space",
  "KeyF",
  "KeyQ",
  "KeyL",
  "KeyM",
  "Slash",
  "Escape",
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
      if (event.repeat && NON_REPEATABLE_CODES.has(code)) return;

      if (code === "Escape") {
        if (isBlockingOverlayOpen()) return;
        if (opts.searchOpen) {
          event.preventDefault();
          opts.closeSearch();
          return;
        }
        if (opts.rightPanelOpen) {
          event.preventDefault();
          opts.closeRightPanel();
          return;
        }
        if (opts.fullscreenOpen) {
          event.preventDefault();
          opts.closeFullscreen();
          return;
        }
        if (opts.onEscapeFallback?.()) {
          event.preventDefault();
        }
        return;
      }

      if (hasBlockingModifier(event)) return;
      if (isTypingTarget(event.target)) return;
      if (isBlockingOverlayOpen()) return;
      if (isKeyHandledByFocusedControl(event.target, code)) return;

      switch (code) {
        case "Space": {
          event.preventDefault();
          playerEngine.togglePlayPause();
          return;
        }
        case "KeyF": {
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
        case "KeyQ": {
          event.preventDefault();
          if (opts.rightPanelOpen && opts.rightPanelTab === "queue") opts.closeRightPanel();
          else opts.openRightPanel("queue");
          return;
        }
        case "KeyL": {
          event.preventDefault();
          if (opts.rightPanelOpen && opts.rightPanelTab === "lyrics") opts.closeRightPanel();
          else opts.openRightPanel("lyrics");
          return;
        }
        case "KeyM": {
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
        case "Slash": {
          event.preventDefault();
          opts.openSearch();
          return;
        }
        case "ArrowLeft": {
          event.preventDefault();
          const { positionMs } = usePlayerStore.getState();
          playerEngine.seek(Math.max(0, positionMs - SEEK_STEP_MS));
          return;
        }
        case "ArrowRight": {
          event.preventDefault();
          const { positionMs, durationMs } = usePlayerStore.getState();
          const upperBound = durationMs > 0 ? durationMs : positionMs + SEEK_STEP_MS;
          playerEngine.seek(Math.min(upperBound, positionMs + SEEK_STEP_MS));
          return;
        }
        case "ArrowUp": {
          event.preventDefault();
          const level = toVolumeLevel(usePlayerStore.getState().volume);
          const nextLevel = roundToPercent(Math.min(1, level + VOLUME_STEP));
          playerEngine.setVolume(toVolumeGain(nextLevel));
          if (nextLevel > 0) lastUnmutedLevelRef.current = nextLevel;
          return;
        }
        case "ArrowDown": {
          event.preventDefault();
          const level = toVolumeLevel(usePlayerStore.getState().volume);
          const nextLevel = roundToPercent(Math.max(0, level - VOLUME_STEP));
          playerEngine.setVolume(toVolumeGain(nextLevel));
          if (nextLevel > 0) lastUnmutedLevelRef.current = nextLevel;
          return;
        }
        default:
          return;
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
