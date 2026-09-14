import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerState, playerEngine } from "@/features/player";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useLyricsStore, type WordData, useLyricsAnimator } from "@/features/lyrics";
import { useTranslation } from "@/languages";
import { useToast, ReorderDropPlaceholder, FloatingDragCard } from "@/shared/ui";
import { useListReorder } from "@/shared/hooks";
import { FiMusic } from "react-icons/fi";
import { ArrowLeftLine } from "@mingcute/react";

const QUEUE_ITEM_HEIGHT = 68;

const QueueList = memo(function QueueList({
  queue,
  queueLimit,
  currentIndex,
  playbackContext,
  playbackContextCover,
  scrollContainerRef,
}: {
  queue: any[];
  queueLimit: number;
  currentIndex: number;
  playbackContext: any;
  playbackContextCover: any;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const effectiveLimit = Math.max(
    queueLimit,
    currentIndex >= 0 ? currentIndex + 25 : 0,
  );
  const visibleQueue = useMemo(
    () => queue.slice(0, effectiveLimit),
    [queue, effectiveLimit],
  );

  const queueContainerRef = useRef<HTMLDivElement>(null);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    playerEngine.reorderQueue(fromIndex, toIndex);
  }, []);

  const {
    isDragging,
    dragIndex,
    dropIndex,
    draggedItem,
    pointerPos,
    grabOffset,
    itemWidth,
    handleCardGrab,
  } = useListReorder<any>({
    items: visibleQueue,
    scrollContainerRef,
    listContainerRef: queueContainerRef,
    itemHeight: QUEUE_ITEM_HEIGHT,
    onReorder: handleReorder,
    edgeThreshold: QUEUE_ITEM_HEIGHT,
    maxScrollSpeed: 18,
  });

  return (
    <div
      ref={queueContainerRef}
      className="relative w-full"
      style={{ height: `${visibleQueue.length * QUEUE_ITEM_HEIGHT}px` }}
    >
      {isDragging && dropIndex !== null && (
        <div
          style={{
            position: "absolute",
            top: `${dropIndex * QUEUE_ITEM_HEIGHT}px`,
            left: 0,
            width: "100%",
            height: `${QUEUE_ITEM_HEIGHT}px`,
            pointerEvents: "none",
            zIndex: 0,
          }}
          className="px-0 py-[2px]"
        >
          <ReorderDropPlaceholder />
        </div>
      )}

      {visibleQueue.map((item, index) => {
        const isCurrent = index === currentIndex;
        const isThisDragged = isDragging && index === dragIndex;

        let shiftY = 0;
        if (isDragging && dragIndex !== null && dropIndex !== null && index !== dragIndex) {
          if (dragIndex < dropIndex) {
            if (index > dragIndex && index <= dropIndex) shiftY = -QUEUE_ITEM_HEIGHT;
          } else if (dragIndex > dropIndex) {
            if (index >= dropIndex && index < dragIndex) shiftY = QUEUE_ITEM_HEIGHT;
          }
        }

        return (
          <div
            key={`${item.id}-${index}`}
            style={{
              position: "absolute",
              top: `${index * QUEUE_ITEM_HEIGHT}px`,
              left: 0,
              width: "100%",
              height: `${QUEUE_ITEM_HEIGHT}px`,
              transform: shiftY ? `translateY(${shiftY}px)` : undefined,
              transition: isDragging
                ? "transform 180ms cubic-bezier(0.2, 0, 0, 1)"
                : undefined,
              opacity: isThisDragged ? 0 : 1,
              zIndex: 1,
            }}
            className="px-0 py-[2px]"
          >
            <SongCardWithMenu
              id={item.id}
              title={item.title}
              artists={item.artists}
              artistId={item.artistId}
              artistList={item.artistList}
              explicit={item.explicit}
              durationMs={item.durationMs}
              coverUrl={
                item.coverUrl ?? (item as { cover_url?: string }).cover_url ?? ""
              }
              showReorderHandle
              onGrabStart={
                !isDragging
                  ? (e) => handleCardGrab(index, item, e)
                  : undefined
              }
              className={`p-[8px] rounded-[10px] transition-colors duration-150 ${
                isCurrent
                  ? "bg-white/[0.08]"
                  : "bg-transparent hover:bg-border-alpha-14"
              }`}
              imageShape="square"
              onPlay={() => {
                if (typeof window !== "undefined" && window.__linerWasDragging) return;
                void playerEngine.playTrack(
                  item,
                  queue,
                  playbackContext,
                  playbackContextCover,
                  index,
                  true,
                );
              }}
            />
          </div>
        );
      })}

      {isDragging && draggedItem && (
        <FloatingDragCard
          x={pointerPos.x}
          y={pointerPos.y}
          offsetX={grabOffset.x}
          offsetY={grabOffset.y}
          width={itemWidth}
        >
          <SongCardWithMenu
            id={draggedItem.id}
            title={draggedItem.title}
            artists={draggedItem.artists}
            artistId={draggedItem.artistId}
            artistList={draggedItem.artistList}
            explicit={draggedItem.explicit}
            durationMs={draggedItem.durationMs}
            coverUrl={
              draggedItem.coverUrl ??
              (draggedItem as { cover_url?: string }).cover_url ??
              ""
            }
            className="p-[8px] rounded-[10px] bg-bg-elevated border border-white/10"
            imageShape="square"
          />
        </FloatingDragCard>
      )}
    </div>
  );
});

export interface RightDrawerProps {
  activeTab: "queue" | "lyrics";
  onTabChange: (tab: "queue" | "lyrics") => void;
  onClose?: () => void;
}

function RightDrawer({ activeTab, onTabChange, onClose }: RightDrawerProps) {
  const player = usePlayerState();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<"queue" | "lyrics">(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [queueLimit, setQueueLimit] = useState(() =>
    Math.max(50, Math.ceil(((player.currentIndex >= 0 ? player.currentIndex : 0) + 30) / 50) * 50),
  );
  const [isQueueScrolled, setIsQueueScrolled] = useState(false);
  const [isLyricsScrolled, setIsLyricsScrolled] = useState(false);
  const isScrolled = activeTab === "queue" ? isQueueScrolled : isLyricsScrolled;

  useEffect(() => {
    if (player.currentIndex >= 0) {
      setQueueLimit((prev) =>
        Math.max(
          prev,
          Math.min(player.queue.length, Math.ceil((player.currentIndex + 30) / 50) * 50),
        ),
      );
    }
  }, [player.currentIndex, player.queue.length]);

  const scrollQueueToCurrent = useCallback(
    (smooth = false) => {
      const container = queueScrollRef.current;
      if (!container || player.currentIndex < 0 || player.queue.length === 0) return;
      const targetY = Math.max(
        0,
        Math.round(6 + player.currentIndex * QUEUE_ITEM_HEIGHT + QUEUE_ITEM_HEIGHT / 2 - (container.clientHeight || 500) / 2),
      );
      setIsQueueScrolled(targetY > 2);
      if (smooth) {
        container.scrollTo({ top: targetY, behavior: "smooth" });
      } else {
        container.scrollTop = targetY;
      }
    },
    [player.currentIndex, player.queue.length],
  );

  const queueScrollCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      queueScrollRef.current = node;
      if (node && player.currentIndex >= 0 && player.queue.length > 0) {
        const targetY = Math.max(
          0,
          Math.round(6 + player.currentIndex * QUEUE_ITEM_HEIGHT + QUEUE_ITEM_HEIGHT / 2 - (node.clientHeight || 500) / 2),
        );
        node.scrollTop = targetY;
        setIsQueueScrolled(targetY > 2);
        requestAnimationFrame(() => {
          if (queueScrollRef.current) {
            const h = queueScrollRef.current.clientHeight || 500;
            const finalY = Math.max(
              0,
              Math.round(6 + player.currentIndex * QUEUE_ITEM_HEIGHT + QUEUE_ITEM_HEIGHT / 2 - h / 2),
            );
            queueScrollRef.current.scrollTop = finalY;
            setIsQueueScrolled(finalY > 2);
          }
        });
        setTimeout(() => {
          if (queueScrollRef.current) {
            const h = queueScrollRef.current.clientHeight || 500;
            const finalY = Math.max(
              0,
              Math.round(6 + player.currentIndex * QUEUE_ITEM_HEIGHT + QUEUE_ITEM_HEIGHT / 2 - h / 2),
            );
            queueScrollRef.current.scrollTop = finalY;
            setIsQueueScrolled(finalY > 2);
          }
        }, 50);
        setTimeout(() => {
          if (queueScrollRef.current) {
            const h = queueScrollRef.current.clientHeight || 500;
            const finalY = Math.max(
              0,
              Math.round(6 + player.currentIndex * QUEUE_ITEM_HEIGHT + QUEUE_ITEM_HEIGHT / 2 - h / 2),
            );
            queueScrollRef.current.scrollTop = finalY;
            setIsQueueScrolled(finalY > 2);
          }
        }, 150);
      }
    },
    [player.currentIndex, player.queue.length],
  );

  const prevQueueTrackIdRef = useRef<string | null>(player.currentTrack?.id ?? null);

  useEffect(() => {
    const currentId = player.currentTrack?.id ?? null;
    if (activeTab === "queue" && currentId !== null && currentId !== prevQueueTrackIdRef.current) {
      prevQueueTrackIdRef.current = currentId;
      scrollQueueToCurrent(true);
    } else {
      prevQueueTrackIdRef.current = currentId;
    }
  }, [activeTab, player.currentTrack?.id, scrollQueueToCurrent]);

  const {
    lyricsLoading,
    syncedLines,
    plainLyrics,
    lyricsQuality,
    currentLyricsTrackId,
  } = useLyricsStore();
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerCallbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      lyricsContainerRef.current = el;
    },
    [],
  );

  const prevTrackIdRef = useRef<string | null>(null);
  const prevQualityRef = useRef(lyricsQuality);

  const isMatchingTrack = Boolean(
    player.currentTrack?.id && currentLyricsTrackId === player.currentTrack.id,
  );
  const effectiveSyncedLines = isMatchingTrack ? syncedLines : [];
  const effectivePlainLyrics = isMatchingTrack ? plainLyrics : null;
  const effectiveLoading = lyricsLoading || !isMatchingTrack;

  useEffect(() => {
    const trackId = player.currentTrack?.id || null;
    if (trackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = trackId;
      prevQualityRef.current = lyricsQuality;
      return;
    }

    if (
      activeTab === "lyrics" &&
      lyricsQuality > prevQualityRef.current &&
      prevQualityRef.current > 0
    ) {
      toast(t("player.lyrics_upgraded"), "success");
    }
    prevQualityRef.current = lyricsQuality;
  }, [lyricsQuality, activeTab, player.currentTrack?.id, t, toast]);

  const isPlaying = player.status === "playing";

  const [activeLineIndices, setActiveLineIndices] = useState<number[]>([]);
  const activeLineIndicesRef = useRef<number[]>([]);

  const handleActiveLineChange = useCallback((indices: number[]) => {
    activeLineIndicesRef.current = indices;
    setActiveLineIndices(indices);
  }, []);

  const isActuallySynced = effectiveSyncedLines.some((line) => line.timeMs > 0);

  const { registerWordSpan, setWordData, clearWordSpans } = useLyricsAnimator({
    syncedLines: effectiveSyncedLines,
    isActuallySynced,
    isPlaying,
    positionMs: player.positionMs,
    durationMs: player.durationMs,
    onActiveLineChange: handleActiveLineChange,
  });

  // Track changed: instant scroll to top & reset active lines
  useEffect(() => {
    setActiveLineIndices([]);
    activeLineIndicesRef.current = [];
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTop = 0;
      setIsLyricsScrolled(false);
    }
  }, [player.currentTrack?.id]);

  // Feed word timings whenever effectiveSyncedLines changes (not inside render)
  useEffect(() => {
    effectiveSyncedLines.forEach((line, i) => {
      const words = line.words || [];
      const animatedWords = words.filter((w) => w.text.trim().length > 0);
      if (animatedWords.length > 0) {
        setWordData(
          i,
          animatedWords.map((w) => ({ timeMs: w.timeMs, endMs: w.endMs })),
        );
      } else {
        clearWordSpans(i);
      }
    });
  }, [effectiveSyncedLines, setWordData, clearWordSpans]);

  // Active line scrolling during playback
  useEffect(() => {
    if (
      activeTab === "lyrics" &&
      activeLineIndices.length > 0 &&
      lyricsContainerRef.current &&
      player.status === "playing"
    ) {
      const container = lyricsContainerRef.current;
      const latestActiveIndex = activeLineIndices[activeLineIndices.length - 1];
      const activeEl = container.querySelector<HTMLElement>(
        `[data-line-index="${latestActiveIndex}"]`,
      );
      if (activeEl) {
        const containerRect = container.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        const offset = elRect.top - containerRect.top + container.scrollTop;
        const targetScrollTop =
          offset - container.clientHeight / 2 + elRect.height / 2;
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth",
        });
      }
    }
  }, [activeLineIndices, activeTab, player.status]);

  const renderWordLevel = (
    line: { timeMs: number; text: string; words?: WordData[] },
    i: number,
    isActiveLine: boolean,
  ) => {
    if (!isActiveLine) {
      if (!line.words?.some((w) => w.isBackground)) {
        return line.text;
      }
      const mainWords = line.words.filter((w) => !w.isBackground);
      const bgWords = line.words.filter((w) => w.isBackground);
      return (
        <>
          <span className="inline">
            {mainWords.map((w) => w.text).join("")}
          </span>
          <div className="text-[14px] font-[500] leading-[1.15]">
            {bgWords.map((w) => w.text).join("")}
          </div>
        </>
      );
    }

    let wordsToRender =
      line.words && line.words.length > 0 ? line.words : [];

    if (wordsToRender.length === 0) {
      return line.text;
    }

    const words = wordsToRender;
    const hasBg = words.some((w) => w.isBackground);
    const animatedWords = words.filter((word) => word.text.trim().length > 0);

    const renderPart = (word: WordData, key: number, className = "") => {
      if (!word.text.trim()) return word.text;
      const animIdx = animatedWords.indexOf(word);
      return (
        <span key={key} className="inline">
          <span
            className={`bg-clip-text text-transparent ${className}`}
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--color-text-primary) 0%, var(--color-text-tertiary) 0%)",
              transform: "none",
            }}
            ref={(el) => {
              if (animIdx >= 0) {
                registerWordSpan(i, animIdx, animatedWords.length, el);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              playerEngine.seek(word.timeMs, true);
            }}
          >
            {word.text}
          </span>
        </span>
      );
    };

    if (!hasBg) {
      return words.map((word, index) => renderPart(word, index, "font-[700]"));
    }

    const mainWords = words.filter((word) => !word.isBackground);
    const bgWords = words.filter((word) => word.isBackground);

    return (
      <>
        {mainWords.map((word, index) =>
          renderPart(word, index, "font-[700]"),
        )}
        <div className="text-[14px] font-[500] leading-[1.15]">
          {bgWords.map((word, index) =>
            renderPart(
              word,
              mainWords.length + index,
              "text-[14px] font-[500]",
            ),
          )}
        </div>
      </>
    );
  };

  const lastIdx = syncedLines.length - 1;
  const lastLine = syncedLines[lastIdx];
  const lastWordEndMs = lastLine?.words?.[lastLine.words.length - 1]?.endMs;
  const prevLine = syncedLines.length > 1 ? syncedLines[lastIdx - 1] : null;
  const prevDuration = prevLine ? lastLine.timeMs - prevLine.timeMs : 5000;
  const dotsActivateMs =
    lastWordEndMs ??
    (lastLine?.timeMs != null ? lastLine.timeMs + prevDuration : null);
  const showOutroDots =
    player.durationMs > 0 &&
    lastLine?.timeMs > 0 &&
    player.durationMs - lastLine.timeMs > 5000 &&
    lastLine?.text;

  return (
    <div className="flex flex-col h-full w-full bg-bg-primary border-l border-border-secondary/60 overflow-hidden select-none">
      <div className="relative shrink-0 z-20">
        <div
          data-window-drag
          className="relative flex items-center justify-between px-[16px] h-[56px] select-none"
        >
          <div className="flex items-center min-w-0">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title={t("common.back") || "Back"}
                aria-label={t("common.back") || "Back"}
                data-no-window-drag
                className="group inline-flex h-[32px] shrink-0 items-center gap-[6px] rounded-md px-[10px] bg-bg-panel/90 border border-border-primary/60 backdrop-blur-md text-text-primary hover:bg-border-alpha-14 active:scale-[0.94] transition-all cursor-pointer select-none pointer-events-auto text-[13px] font-[500]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                <ArrowLeftLine
                  size={16}
                  className="transition-transform duration-150 group-hover:-translate-x-0.5"
                />
                <span className="relative -left-[1.5px] top-[1px]">{t("common.back") || "Back"}</span>
              </button>
            )}
          </div>
          <div className="w-[120px] h-[32px] shrink-0" />
        </div>

        <div className="px-[16px] pb-[10px]">
          <div className="h-[36px] grid grid-cols-2 w-full p-[3px] box-border rounded-xl bg-bg-elevated border border-border-primary/60">
            <button
              type="button"
              onClick={() => onTabChange("queue")}
              className={`relative h-full flex items-center justify-center px-[12px] rounded-lg text-[13px] font-medium transition-colors border-none bg-transparent cursor-pointer select-none active:scale-[0.98] ${
                activeTab === "queue"
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                letterSpacing: "-0.01em",
              }}
            >
              {activeTab === "queue" && (
                <motion.div
                  layoutId="activeRightDrawerTab"
                  className="absolute inset-0 rounded-lg bg-bg-primary border border-border-primary/30"
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}
              <span className="relative z-10">{t("player.queue")}</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("lyrics")}
              className={`relative h-full flex items-center justify-center px-[12px] rounded-lg text-[13px] font-medium transition-colors border-none bg-transparent cursor-pointer select-none active:scale-[0.98] ${
                activeTab === "lyrics"
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                letterSpacing: "-0.01em",
              }}
            >
              {activeTab === "lyrics" && (
                <motion.div
                  layoutId="activeRightDrawerTab"
                  className="absolute inset-0 rounded-lg bg-bg-primary border border-border-primary/30"
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}
              <span className="relative z-10">{t("player.lyrics")}</span>
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-full h-[24px] overflow-hidden z-20">
          <div
            className={`h-full w-full transition-opacity duration-200 ${
              isScrolled ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background:
                "linear-gradient(to bottom, var(--color-bg-primary) 0%, var(--color-bg-primary) 20%, transparent 100%)",
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === "queue" && (
          <div
            ref={queueScrollCallbackRef}
            className="absolute inset-0 overflow-y-auto px-[10px] pt-[6px] pb-[16px]"
            onScroll={(e) => {
              const target = e.currentTarget;
              const next = target.scrollTop > 2;
              setIsQueueScrolled((prev) => (prev === next ? prev : next));
              if (
                target.scrollHeight - target.scrollTop <=
                target.clientHeight * 1.5
              ) {
                setQueueLimit((prev) =>
                  Math.min(prev + 50, player.queue.length),
                );
              }
            }}
          >
            {player.queue.length > 0 ? (
              <QueueList
                queue={player.queue}
                queueLimit={queueLimit}
                currentIndex={player.currentIndex}
                playbackContext={player.playbackContext}
                playbackContextCover={player.playbackContextCover}
                scrollContainerRef={queueScrollRef}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-tertiary text-[14px]">
                {t("player.queue_empty")}
              </div>
            )}
          </div>
        )}

        {activeTab === "lyrics" && (
          <div
            className="absolute inset-0 overflow-y-auto p-[32px] scroll-smooth"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)",
            }}
            ref={lyricsContainerCallbackRef}
            onScroll={(e) => {
              const next = e.currentTarget.scrollTop > 2;
              setIsLyricsScrolled((prev) => (prev === next ? prev : next));
            }}
          >
            <div
              className="flex flex-col gap-[24px] pb-[50vh] pt-[10vh]"
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {effectiveLoading ? (
                <div className="flex items-center h-[100px]">
                  <div className="w-[28px] h-[28px] rounded-full border-[3px] border-text-tertiary border-t-text-secondary animate-spin" />
                </div>
              ) : effectiveSyncedLines.length > 0 && isActuallySynced ? (
                <>
                  {effectiveSyncedLines[0].timeMs > 5000 && effectiveSyncedLines[0].text && (
                    <div
                      className={`relative text-[25px] font-[700] transition-all duration-300 ${
                        activeLineIndices.length === 0
                          ? "text-text-primary"
                          : "text-text-tertiary"
                      }`}
                    >
                      {activeLineIndices.length === 0 ? (
                        <span className="inline-flex">
                          {"•••".split("").map((d, di) => (
                            <span
                              key={di}
                              className="lyric-dot-anim"
                              style={{ animationDelay: `${di * 0.2}s` }}
                            >
                              {d}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "•••"
                      )}
                    </div>
                  )}
                  {effectiveSyncedLines.map((line, i) => {
                    const isActive = activeLineIndices.includes(i);
                    const isPassed =
                      i <
                      (activeLineIndices.length > 0
                        ? activeLineIndices[0]
                        : 0);

                    let displayText = line.text;

                    const tagMatch = displayText.match(/^\s*<([^>]+)>/);
                    let isRight = false;
                    let isCenter = false;
                    let customColor: string | null = null;

                    const colorMap: Record<string, string> = {
                      pink: "#f9a8d4",
                      red: "#fca5a5",
                      blue: "#93c5fd",
                      green: "#86efac",
                      yellow: "#fde047",
                      purple: "#d8b4fe",
                      orange: "#fdba74",
                      cyan: "#67e8f9",
                    };

                    if (tagMatch) {
                      displayText = displayText.slice(tagMatch[0].length).trim();
                      const tags = tagMatch[1].split(",");
                      if (tags.includes("right")) isRight = true;
                      if (tags.includes("center")) isCenter = true;

                      for (const tag of tags) {
                        if (colorMap[tag]) {
                          customColor = colorMap[tag];
                          break;
                        }
                      }
                    }

                    const isLastLine = i === effectiveSyncedLines.length - 1;
                    const isLastLineDone =
                      isLastLine &&
                      dotsActivateMs != null &&
                      player.positionMs >= dotsActivateMs;
                    const lineIsActive = isActive && !isLastLineDone;
                    const lineIsPassed = isPassed || isLastLineDone;

                    let stateClass = lineIsActive
                      ? ""
                      : lineIsPassed
                        ? ""
                        : "hover:opacity-50 cursor-pointer";

                    const customStyle: React.CSSProperties = {
                      opacity: lineIsActive ? 1 : 0.35,
                      color:
                        customColor && lineIsActive
                          ? customColor
                          : "var(--color-text-primary)",
                    };

                    if (isRight) {
                      customStyle.textAlign = "right";
                      customStyle.width = "100%";
                    } else if (isCenter) {
                      customStyle.textAlign = "center";
                      customStyle.width = "100%";
                    }

                    return (
                      <div
                        key={i}
                        data-line-index={i}
                        className={`relative text-[25px] font-[700] ${lineIsActive ? "" : "transition-opacity duration-200"} ${stateClass}`}
                        style={customStyle}
                        onClick={() => {
                          playerEngine.seek(line.timeMs, true);
                        }}
                      >
                        {displayText ? (
                          renderWordLevel(
                            { ...line, text: displayText },
                            i,
                            lineIsActive,
                          )
                        ) : lineIsActive ? (
                          <span className="inline-flex">
                            {"•••".split("").map((d, di) => (
                              <span
                                key={di}
                                className="lyric-dot-anim"
                                style={{ animationDelay: `${di * 0.2}s` }}
                              >
                                {d}
                              </span>
                            ))}
                          </span>
                        ) : (
                          "•••"
                        )}
                      </div>
                    );
                  })}
                  {showOutroDots && (
                    <div
                      className={`relative text-[25px] font-[700] transition-all duration-300 ${
                        activeLineIndices.length > 0 &&
                        activeLineIndices[0] === lastIdx &&
                        dotsActivateMs != null &&
                        player.positionMs >= dotsActivateMs
                          ? "text-text-primary"
                          : "text-text-tertiary"
                      }`}
                    >
                      {activeLineIndices.length > 0 &&
                      activeLineIndices[0] === lastIdx &&
                      dotsActivateMs != null &&
                      player.positionMs >= dotsActivateMs ? (
                        <span className="inline-flex">
                          {"•••".split("").map((d, di) => (
                            <span
                              key={di}
                              className="lyric-dot-anim"
                              style={{ animationDelay: `${di * 0.2}s` }}
                            >
                              {d}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "•••"
                      )}
                    </div>
                  )}
                </>
              ) : effectivePlainLyrics === "[INSTRUMENTAL]" ? (
                <div className="flex flex-col gap-[16px] text-[18px] font-[500] text-text-secondary items-center justify-center min-h-[40vh]">
                  <div className="text-[25px] font-[700] mb-[8px]">
                    <span className="inline-flex">
                      {"•••".split("").map((d, di) => (
                        <span
                          key={di}
                          className="lyric-dot-anim"
                          style={{ animationDelay: `${di * 0.2}s` }}
                        >
                          {d}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-[12px] text-[20px] font-[600]">
                    <FiMusic className="w-[24px] h-[24px]" />
                    <span>This song is instrumental</span>
                  </div>
                </div>
              ) : effectivePlainLyrics ||
                (effectiveSyncedLines.length > 0 && !isActuallySynced) ? (
                <>
                  {(effectiveSyncedLines.length > 0
                    ? effectiveSyncedLines
                    : (effectivePlainLyrics || "")
                        .split("\n")
                        .map((t) => ({ text: t, timeMs: 0 }))
                  ).map((line, i) => {
                    let displayText = line.text.trim();

                    const tagMatch = displayText.match(/^\s*<([^>]+)>/);
                    let isRight = false;
                    let isCenter = false;

                    if (tagMatch) {
                      displayText = displayText.slice(tagMatch[0].length).trim();
                      const tags = tagMatch[1].split(",");
                      if (tags.includes("right")) isRight = true;
                      if (tags.includes("center")) isCenter = true;
                    }

                    const customStyle: React.CSSProperties = {
                      color: "var(--color-text-primary)",
                      opacity: 0.35,
                    };

                    if (isRight) {
                      customStyle.textAlign = "right";
                      customStyle.width = "100%";
                    } else if (isCenter) {
                      customStyle.textAlign = "center";
                      customStyle.width = "100%";
                    }

                    return (
                      <div
                        key={i}
                        className="relative text-[25px] font-[700] text-text-primary min-h-[24px]"
                        style={customStyle}
                      >
                        {displayText || "\n"}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-[28px] font-[700] text-text-tertiary">
                  No lyrics available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(RightDrawer);
