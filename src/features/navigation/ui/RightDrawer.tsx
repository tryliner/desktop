import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerState, playerEngine } from "@/features/player";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useLyricsStore, type WordData, useLyricsAnimator } from "@/features/lyrics";
import { useTranslation } from "@/languages";
import { useToast, ReorderDropPlaceholder, FloatingDragCard } from "@/shared/ui";
import { useListReorder } from "@/shared/hooks";
import { FiMusic } from "react-icons/fi";

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
  const visibleQueue = useMemo(
    () => queue.slice(0, queueLimit),
    [queue, queueLimit],
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
    itemHeight: 70,
    onReorder: handleReorder,
    edgeThreshold: 70,
    maxScrollSpeed: 18,
  });

  return (
    <div
      ref={queueContainerRef}
      className="relative w-full"
      style={{ height: `${visibleQueue.length * 70}px` }}
    >
      {isDragging && dropIndex !== null && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "70px",
            transform: `translateY(${dropIndex * 70}px)`,
            transition: "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
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
            if (index > dragIndex && index <= dropIndex) shiftY = -70;
          } else if (dragIndex > dropIndex) {
            if (index >= dropIndex && index < dragIndex) shiftY = 70;
          }
        }

        return (
          <div
            key={`${item.id}-${index}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "70px",
              transform: `translateY(${index * 70 + shiftY}px)`,
              transition: isDragging
                ? "transform 180ms cubic-bezier(0.2, 0, 0, 1)"
                : undefined,
              opacity: isThisDragged ? 0 : 1,
              zIndex: 1,
            }}
            className="px-0 py-[1px]"
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
              className={`px-[12px] py-[10px] rounded-[12px] transition-colors duration-150 ${
                isCurrent
                  ? "bg-border-alpha-14"
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
            className="px-[12px] py-[10px] rounded-md bg-transparent"
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
}

function RightDrawer({ activeTab, onTabChange }: RightDrawerProps) {
  const player = usePlayerState();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<"queue" | "lyrics">(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [queueLimit, setQueueLimit] = useState(50);

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
    <div className="flex flex-col h-full w-full rounded-4xl border-[0.5px] border-border-secondary bg-bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] overflow-hidden">
      {/* Tabs Header */}
      <div className="flex items-center pt-[24px] border-b-[0.5px] border-border-primary shrink-0">
        <button
          type="button"
          onClick={() => onTabChange("queue")}
          className={`flex-1 pb-[14px] relative -mb-[0.5px] border-b-[2px] text-[15px] font-[500] transition-colors duration-200 border-none bg-transparent cursor-pointer ${
            activeTab === "queue"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          {t("player.queue")}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("lyrics")}
          className={`flex-1 pb-[14px] relative -mb-[0.5px] border-b-[2px] text-[15px] font-[500] transition-colors duration-200 border-none bg-transparent cursor-pointer ${
            activeTab === "lyrics"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          {t("player.lyrics")}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "queue" && (
          <div
            ref={queueScrollRef}
            className="absolute inset-0 overflow-y-auto px-[12px] py-[12px]"
            onScroll={(e) => {
              const target = e.currentTarget;
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
                          ? "text-text-primary drop-shadow-[0_0_16px_rgba(255,255,255,0.25)]"
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
