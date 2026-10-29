import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { useLyricsStore } from "@/features/lyrics";
import {
  useIsTrackLiked,
} from "@/features/library/hooks";
import { useLikeTrack } from "@/features/library/hooks/likes/useLikeTrack";
import { useUnlikeTrack } from "@/features/library/hooks/likes/useUnlikeTrack";
import {
  isWindowVisible,
  onWindowVisibilityChange,
} from "@/shared/utils/windowVisibility";
import type { Track } from "@/shared/types";
import type {
  TouchBarAction,
  TouchBarActiveLine,
  TouchBarStatePayload,
  TouchBarTrackInfo,
  TouchBarWordData,
} from "../contracts";

const LYRIC_POLL_MS = 500;

type LyricLine = ReturnType<
  typeof useLyricsStore.getState
>["syncedLines"][number];

function findActiveLineIndex(lines: LyricLine[], positionMs: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const prevEnd =
      i > 0 && lines[i - 1].words && lines[i - 1].words!.length > 0
        ? lines[i - 1].words![lines[i - 1].words!.length - 1].endMs
        : i > 0
          ? lines[i - 1].timeMs
          : 0;
    const targetEarlyMs = Math.max(prevEnd, lines[i].timeMs - 600);
    if (targetEarlyMs <= positionMs) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

function currentAudioPositionMs(): number {
  const audioEl =
    typeof document !== "undefined"
      ? (document.getElementById("liner-audio") as HTMLAudioElement | null)
      : null;
  return audioEl && !Number.isNaN(audioEl.currentTime) && !audioEl.seeking
    ? Math.round(audioEl.currentTime * 1000)
    : usePlayerStore.getState().positionMs;
}

function isInstrumentalLine(line: LyricLine): boolean {
  return Boolean(
    line.isInstrumental ||
    (line.text.trim() === "" && (!line.words || line.words.length === 0)) ||
    line.text.trim() === "♪",
  );
}

function mergeLineWords(line: LyricLine): TouchBarWordData[] {
  const words: TouchBarWordData[] = [];
  if (!line.words || line.words.length === 0) return words;
  const lineText = line.text || "";
  let charCursor = 0;

  for (const w of line.words) {
    if (!w || !w.text) continue;

    if (w.text.trim().length === 0) {
      if (words.length > 0) {
        words[words.length - 1].text += w.text;
      }
      continue;
    }

    const cleanText = w.text.trim();
    const foundIdx = lineText.indexOf(cleanText, charCursor);

    let isContinuationOfPrevWord = false;
    if (words.length > 0) {
      const prev = words[words.length - 1];
      const prevEndsSpace = /\s$/.test(prev.text);
      const currStartsSpace = /^\s/.test(w.text);

      if (foundIdx >= 0) {
        const textBetween = lineText.slice(charCursor, foundIdx);
        const hasSpaceBetween = /\s/.test(textBetween);
        if (!hasSpaceBetween && !prevEndsSpace && !currStartsSpace) {
          isContinuationOfPrevWord = true;
        }
      } else if (!prevEndsSpace && !currStartsSpace) {
        isContinuationOfPrevWord = true;
      }
    }

    if (foundIdx >= 0) {
      charCursor = foundIdx + cleanText.length;
    }

    if (isContinuationOfPrevWord && words.length > 0) {
      const prev = words[words.length - 1];
      prev.text += w.text;
      prev.endMs = Math.max(prev.endMs, w.endMs);
    } else {
      words.push({
        text: w.text,
        timeMs: w.timeMs,
        endMs: w.endMs,
      });
    }
  }
  return words;
}

function toTrackInfo(track: Track | null): TouchBarTrackInfo | null {
  return track
    ? {
        id: track.id,
        title: track.title,
        artist: track.artists || "",
        album: track.album?.title || "",
        cover: track.coverUrl,
        durationMs: track.durationMs,
      }
    : null;
}

export function useTouchBarSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMac = window.linerElectron?.platform === "darwin";
  const status = usePlayerStore((s) => s.status);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const volume = usePlayerStore((s) => s.volume);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const fullscreen = usePlayerStore((s) => s.fullscreen);
  const syncedLines = useLyricsStore((s) => s.syncedLines);
  const offsetMs = useLyricsStore((s) => s.offsetMs);
  const isLiked = useIsTrackLiked(currentTrack?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();
  const isTogglingLikeRef = useRef(false);
  const lastStateSentRef = useRef<string>("");
  const lastLinesSentRef = useRef<LyricLine[] | null>(null);
  const [syncRequestTick, setSyncRequestTick] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!window.linerElectron?.onTouchBarRequestSync) return;
    const cleanup = window.linerElectron.onTouchBarRequestSync(() => {
      lastStateSentRef.current = "";
      lastLinesSentRef.current = null;
      setSyncRequestTick((t) => t + 1);
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (!window.linerElectron?.onTouchBarAction) return;

    const cleanup = window.linerElectron.onTouchBarAction(
      (action: TouchBarAction) => {
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
            void playerEngine.skipNext(true);
            break;
          case "prev":
            void playerEngine.skipPrevious();
            break;
          case "seek":
            if (typeof action.payload?.positionMs === "number") {
              const targetMs = action.payload.positionMs;
              playerEngine.seek(targetMs);
              const lines = useLyricsStore.getState().syncedLines;
              if (lines && lines.length > 0) {
                const idx = findActiveLineIndex(lines, targetMs);
                useLyricsStore
                  .getState()
                  .setActiveLineIndex(idx >= 0 ? idx : null);
                setActiveIndex(idx);
              }
            }
            break;
          case "volume":
            if (typeof action.payload?.volume === "number") {
              playerEngine.setVolume(action.payload.volume);
            }
            break;
          case "toggleShuffle":
            playerEngine.setShuffle(!playerEngine.getSnapshot().shuffle);
            break;
          case "toggleFullscreen": {
            const currentFs =
              usePlayerStore.getState().fullscreen ||
              location.pathname === "/player";
            if (currentFs) {
              if (location.pathname === "/player") {
                navigate(-1);
              } else {
                usePlayerStore.getState().setFullscreen(false);
              }
            } else {
              usePlayerStore.getState().setFullscreen(true);
            }
            break;
          }
          case "adjustOffset":
            if (typeof action.payload?.deltaMs === "number") {
              useLyricsStore.getState().adjustOffset(action.payload.deltaMs);
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
          case "navigate":
            if (action.payload?.route) {
              navigate(action.payload.route);
            }
            break;
        }
      },
    );

    return cleanup;
  }, [
    currentTrack,
    isLiked,
    likeMutation,
    unlikeMutation,
    navigate,
    location.pathname,
  ]);

  useEffect(() => {
    if (!isMac || syncedLines.length === 0) {
      setActiveIndex(-1);
      return;
    }
    const update = () => {
      if (!isWindowVisible()) return;
      setActiveIndex(
        findActiveLineIndex(syncedLines, currentAudioPositionMs()),
      );
    };
    update();
    if (status !== "playing") return;
    const timer = setInterval(update, LYRIC_POLL_MS);
    const stopVisibility = onWindowVisibilityChange((visible) => {
      if (visible) update();
    });
    return () => {
      clearInterval(timer);
      stopVisibility();
    };
  }, [isMac, status, syncedLines]);

  useEffect(() => {
    if (isMac || !window.linerElectron?.touchbarUpdateState) return;
    const track = toTrackInfo(currentTrack);
    const key = JSON.stringify([status, track]);
    if (key === lastStateSentRef.current) return;
    lastStateSentRef.current = key;
    window.linerElectron.touchbarUpdateState({ status, track });
  }, [isMac, status, currentTrack, syncRequestTick]);

  useEffect(() => {
    if (!isMac || !window.linerElectron?.touchbarUpdateState) return;

    let activeLine: TouchBarActiveLine | null = null;
    let nextLyricText = "";
    const currentAudioMs = currentAudioPositionMs();
    const lineIndex = activeIndex < syncedLines.length ? activeIndex : -1;

    if (syncedLines.length > 0) {
      if (lineIndex >= 0) {
        const line = syncedLines[lineIndex];
        const nextLine = syncedLines[lineIndex + 1];
        const upcomingLine = syncedLines
          .slice(lineIndex + 1)
          .find((l) => Boolean(l.text && l.text.trim()));
        nextLyricText = upcomingLine?.text || "";

        const lineDurationMs = nextLine
          ? Math.max(800, nextLine.timeMs - line.timeMs)
          : 4000;

        activeLine = {
          text: line.text,
          timeMs: line.timeMs,
          durationMs: line.durationMs || lineDurationMs,
          words: mergeLineWords(line),
          isInstrumental: isInstrumentalLine(line),
        };
      } else {
        const firstLine = syncedLines[0];
        if (
          firstLine &&
          firstLine.timeMs > 3000 &&
          currentAudioMs < firstLine.timeMs - 600
        ) {
          activeLine = {
            text: "",
            timeMs: 0,
            durationMs: firstLine.timeMs,
            words: [],
            isInstrumental: true,
          };
          nextLyricText = firstLine.text || "";
        } else {
          nextLyricText = firstLine?.text || "";
        }
      }
    }

    const hasSyncedLyrics = syncedLines.some(
      (l) =>
        (l.timeMs ?? 0) > 0 ||
        Boolean((l.durationMs ?? 0) > 0 && l.isInstrumental),
    );

    const isFullscreen = location.pathname === "/player" || Boolean(fullscreen);

    const payload: TouchBarStatePayload = {
      status,
      track: toTrackInfo(currentTrack),
      positionMs: currentAudioMs,
      durationMs: durationMs || currentTrack?.durationMs || 0,
      volume,
      isLiked,
      shuffle,
      repeat,
      activeLine: hasSyncedLyrics ? activeLine : null,
      activeLyricText: hasSyncedLyrics ? activeLine?.text || "" : "",
      nextLyricText: hasSyncedLyrics ? nextLyricText : "",
      offsetMs,
      currentRoute: location.pathname,
      isFullscreen,
      hasSyncedLyrics,
      activeIndex: lineIndex,
    };

    const serialized = JSON.stringify({
      s: payload.status,
      id: payload.track?.id,
      d: payload.durationMs,
      v: Math.round(payload.volume * 100),
      l: payload.isLiked,
      sh: payload.shuffle,
      rp: payload.repeat,
      ly: payload.activeLyricText,
      li: lineIndex,
      o: offsetMs,
      fs: payload.isFullscreen,
      sl: payload.hasSyncedLyrics,
      r: payload.currentRoute,
    });

    const linesChanged = lastLinesSentRef.current !== syncedLines;
    if (serialized === lastStateSentRef.current && !linesChanged) return;
    lastStateSentRef.current = serialized;

    if (linesChanged) {
      lastLinesSentRef.current = syncedLines;
      payload.syncedLines = hasSyncedLyrics
        ? syncedLines.map((l) => ({
            text: l.text,
            timeMs: l.timeMs,
            durationMs: l.durationMs,
            isInstrumental: isInstrumentalLine(l),
            words: l.words?.map((w) => ({
              text: w.text,
              timeMs: w.timeMs,
              endMs: w.endMs,
            })),
          }))
        : [];
    }

    window.linerElectron.touchbarUpdateState(payload);
  }, [
    isMac,
    status,
    durationMs,
    volume,
    shuffle,
    repeat,
    fullscreen,
    currentTrack,
    isLiked,
    syncedLines,
    offsetMs,
    activeIndex,
    location.pathname,
    syncRequestTick,
  ]);
}
