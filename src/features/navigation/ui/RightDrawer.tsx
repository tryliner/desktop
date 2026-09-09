import { useState, useEffect, useRef, memo, useCallback } from "react";
import { usePlayerState, playerEngine } from "@/features/player";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useLyricsStore, type WordData, useLyricsAnimator } from "@/features/lyrics";
import { useTranslation } from "@/languages";
import { useToast } from "@/shared/ui";
import { FiMusic } from "react-icons/fi";
import { TrashBin2 } from "@solar-icons/react";

const QueueList = memo(function QueueList({
  queue,
  queueLimit,
  currentIndex,
  playbackContext,
  playbackContextCover,
}: {
  queue: any[];
  queueLimit: number;
  currentIndex: number;
  playbackContext: any;
  playbackContextCover: any;
}) {
  return (
    <div className="flex flex-col gap-[2px]">
      {queue.slice(0, queueLimit).map((item, index) => {
        const isCurrent = index === currentIndex;
        return (
          <SongCardWithMenu
            key={`${item.id}-${index}`}
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
            className={`px-[12px] py-[10px] rounded-[12px] transition-all duration-200 ${
              isCurrent
                ? "bg-border-alpha-14"
                : "bg-transparent hover:bg-border-alpha-14"
            }`}
            imageShape="square"
            onPlay={() => {
              void playerEngine.playTrack(
                item,
                queue,
                playbackContext,
                playbackContextCover,
                index,
              );
            }}
          />
        );
      })}
    </div>
  );
});

function RightDrawer() {
  const player = usePlayerState();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"queue" | "lyrics">("queue");
  const activeTabRef = useRef<"queue" | "lyrics">(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [queueLimit, setQueueLimit] = useState(50);

  useEffect(() => {
    const saved = localStorage.getItem("liner_right_drawer_tab");
    if (saved === "queue" || saved === "lyrics") {
      setActiveTab(saved);
    }
  }, []);

  const handleTabChange = (tab: "queue" | "lyrics") => {
    setActiveTab(tab);
    localStorage.setItem("liner_right_drawer_tab", tab);
  };

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
      const animatedWords = words.filter(
        (w) => w.text.trim().length > 0 && w.endMs > w.timeMs,
      );
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
    const animatedWords = words.filter(
      (word) => word.text.trim().length > 0 && word.endMs > word.timeMs,
    );

    const renderPart = (word: WordData, key: number, className = "") => {
      if (!word.text.trim() || word.endMs <= word.timeMs) return word.text;
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
          onClick={() => handleTabChange("queue")}
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
          onClick={() => handleTabChange("lyrics")}
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
          <>
            {player.queue.length > 0 && (
              <div className="absolute top-3 right-3 z-10">
                <div className="rounded-lg bg-bg-panel border-[0.5px] border-border-primary pl-3 pr-1.5 h-[32px] flex items-center gap-1 shadow-sm">
                  <span className="text-[12px] text-text-secondary font-[500] leading-none whitespace-nowrap">
                    {player.queue.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => playerEngine.clearQueue()}
                    className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-border-alpha-14 transition-all duration-150 active:scale-[0.94] border-none bg-transparent cursor-pointer"
                    aria-label={t("player.clear_queue")}
                  >
                    <TrashBin2 size={13} weight="Outline" />
                  </button>
                </div>
              </div>
            )}
            <div
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
                />
              ) : (
                <div className="h-full flex items-center justify-center text-text-tertiary text-[14px]">
                  {t("player.queue_empty")}
                </div>
              )}
            </div>
          </>
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
