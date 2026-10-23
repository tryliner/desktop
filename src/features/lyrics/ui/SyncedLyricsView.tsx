import React, { useRef, useEffect, useCallback, useMemo } from "react";
import type { SyncedLrcLine } from "@/shared/contracts/lyrics";
import { getActiveLyricIndex, computeLyricScrollOffset } from "../engine/lrcParser";
import { useLyricsScrollOverride } from "../hooks/useLyricsScrollOverride";
import { usePlayerState } from "@/features/player/hooks/usePlayerState";
import { playerEngine } from "@/features/player/engine/playerEngine";

export interface SyncedLyricsViewProps {
  lines: SyncedLrcLine[];
  currentPositionMs?: number;
  onSeek?: (timeMs: number) => void;
  lineHeightPx?: number;
  className?: string;
}

export function SyncedLyricsView({
  lines,
  currentPositionMs,
  onSeek,
  lineHeightPx = 56,
  className = "",
}: SyncedLyricsViewProps): React.ReactElement {
  const player = usePlayerState();
  const positionMs = currentPositionMs ?? player.positionMs;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const activeIndex = useMemo(
    () => getActiveLyricIndex(lines, positionMs),
    [lines, positionMs],
  );

  const scrollToActive = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container || activeIndex < 0) return;

      const viewportHeight = container.clientHeight;
      if (viewportHeight === 0) return;

      const activeEl = lineRefs.current.get(activeIndex);
      let targetScrollTop = 0;

      if (activeEl) {
        const offsetTop = activeEl.offsetTop;
        const lineH = activeEl.clientHeight || lineHeightPx;
        targetScrollTop = Math.max(0, offsetTop - viewportHeight / 2 + lineH / 2);
      } else {
        targetScrollTop = computeLyricScrollOffset(activeIndex, lineHeightPx, viewportHeight);
      }

      container.scrollTo({
        top: targetScrollTop,
        behavior,
      });
    },
    [activeIndex, lineHeightPx],
  );

  const { isUserScrolling, handleUserInteraction, resumeImmediately } = useLyricsScrollOverride({
    resumeDelayMs: 3000,
    onResume: () => {
      scrollToActive("smooth");
    },
  });

  // Auto-scroll when activeIndex updates and user is not manually scrolling
  useEffect(() => {
    if (!isUserScrolling && activeIndex >= 0) {
      scrollToActive("smooth");
    }
  }, [activeIndex, isUserScrolling, scrollToActive]);

  const handleLineClick = (line: SyncedLrcLine, index: number) => {
    resumeImmediately();
    if (onSeek) {
      onSeek(line.timeMs);
    } else {
      playerEngine.seek(line.timeMs, true);
    }
    requestAnimationFrame(() => {
      scrollToActive("smooth");
    });
  };

  if (!lines || lines.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full text-white/50 text-base ${className}`}
        data-testid="synced-lyrics-empty"
      >
        No synced lyrics available
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full min-h-0 flex flex-col ${className}`}
      data-testid="synced-lyrics-view"
    >
      <div
        ref={containerRef}
        onWheel={handleUserInteraction}
        onTouchMove={handleUserInteraction}
        className="flex-1 w-full overflow-y-auto scroll-smooth px-6 py-28 flex flex-col gap-4 focus:outline-none"
        tabIndex={0}
        aria-label="Synced lyrics"
        role="region"
      >
        {lines.map((line, index) => {
          const isActive = index === activeIndex;
          const isPast = activeIndex >= 0 && index < activeIndex;

          return (
            <div
              key={line.id || `line-${index}`}
              ref={(el) => {
                if (el) lineRefs.current.set(index, el);
                else lineRefs.current.delete(index);
              }}
              onClick={() => handleLineClick(line, index)}
              data-active={isActive ? "true" : undefined}
              data-testid={`lyric-line-${index}`}
              className={`cursor-pointer transition-all duration-300 select-none py-1.5 px-3 rounded-lg ${
                isActive
                  ? "text-white text-2xl font-bold tracking-tight scale-[1.03] origin-left drop-shadow-[0_0_16px_rgba(0,240,255,0.7)] bg-white/5"
                  : isPast
                  ? "text-white/45 text-lg font-medium hover:text-white/70"
                  : "text-white/25 text-lg font-medium hover:text-white/50"
              }`}
            >
              {line.text}
            </div>
          );
        })}
      </div>

      {isUserScrolling && (
        <button
          type="button"
          onClick={() => {
            resumeImmediately();
            scrollToActive("smooth");
          }}
          className="absolute bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 border border-cyan-500/50 text-cyan-400 backdrop-blur-xl shadow-lg shadow-cyan-950/50 hover:bg-black/90 hover:border-cyan-300 active:scale-95 transition-all text-xs font-semibold cursor-pointer"
          data-testid="sync-lyrics-button"
        >
          <svg
            className="w-3.5 h-3.5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Sync lyrics
        </button>
      )}
    </div>
  );
}
