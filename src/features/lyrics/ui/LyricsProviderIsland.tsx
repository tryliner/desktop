import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LeftLine,
  RightLine,
  CheckFill,
  DownLine,
  TimeLine,
  AddLine,
  MinimizeLine,
  Refresh1Line,
} from "@mingcute/react";
import { useLyricsStore } from "../store/lyricsStore";
import { useTranslation } from "@/languages";

function formatOffsetBadge(ms: number): string {
  if (ms === 0) return "0.0s";
  const sign = ms > 0 ? "+" : "";
  const abs = Math.abs(ms);
  if (abs % 100 === 0) {
    return `${sign}${(ms / 1000).toFixed(1)}s`;
  }
  return `${sign}${(ms / 1000).toFixed(2)}s`;
}

export function LyricsProviderIsland() {
  const { t } = useTranslation();
  const {
    availableProviders,
    activeProvider,
    selectProvider,
    braccatoLyrics,
    offsetMs,
    setOffset,
    adjustOffset,
    resetOffset,
  } = useLyricsStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [offsetOpen, setOffsetOpen] = useState(false);
  const [unit, setUnit] = useState<"ms" | "s">("ms");
  const [inputValue, setInputValue] = useState(String(offsetMs));
  const isInputFocusedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isInputFocusedRef.current) {
      if (unit === "ms") {
        setInputValue(String(offsetMs));
      } else {
        setInputValue(String(offsetMs / 1000));
      }
    }
  }, [offsetMs, unit]);

  useEffect(() => {
    if (!dropdownOpen && !offsetOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setOffsetOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setOffsetOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen, offsetOpen]);

  const handleInputChange = useCallback(
    (val: string) => {
      setInputValue(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        const targetMs =
          unit === "ms" ? Math.round(parsed) : Math.round(parsed * 1000);
        if (targetMs >= -60000 && targetMs <= 60000) {
          setOffset(targetMs);
        }
      }
    },
    [unit, setOffset],
  );

  if (availableProviders.length === 0 || braccatoLyrics.length === 0) {
    return null;
  }

  const currentIndex = Math.max(
    0,
    availableProviders.findIndex((p) => p.provider === activeProvider),
  );
  const currentProvider =
    availableProviders[currentIndex] ?? availableProviders[0];
  const hasMultiple = availableProviders.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultiple) return;
    const nextIdx =
      (currentIndex - 1 + availableProviders.length) %
      availableProviders.length;
    selectProvider(availableProviders[nextIdx].provider);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultiple) return;
    const nextIdx = (currentIndex + 1) % availableProviders.length;
    selectProvider(availableProviders[nextIdx].provider);
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center pointer-events-auto select-none"
    >
      <div className="inline-flex items-center h-[32px] rounded-lg border border-border-primary/80 bg-bg-panel/95 backdrop-blur-md px-[4px] py-[2px] shadow-lg gap-[2px]">
        {/* Provider Switcher */}
        {hasMultiple && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous provider"
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 active:scale-90 transition-all border-none bg-transparent cursor-pointer"
          >
            <LeftLine size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (hasMultiple) {
              setOffsetOpen(false);
              setDropdownOpen((v) => !v);
            }
          }}
          className={`flex items-center gap-[6px] h-[24px] px-[8px] rounded-md text-[12px] font-[500] text-text-primary transition-all border-none bg-transparent ${
            hasMultiple
              ? "hover:bg-border-alpha-14 cursor-pointer"
              : "cursor-default"
          }`}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          <span className="truncate max-w-[120px]">
            {currentProvider.provider}
          </span>
          {hasMultiple && (
            <span className="text-[10px] font-mono text-text-tertiary">
              {currentIndex + 1}/{availableProviders.length}
            </span>
          )}
          {hasMultiple && (
            <DownLine
              size={12}
              className={`text-text-tertiary transition-transform duration-150 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          )}
        </button>

        {hasMultiple && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next provider"
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 active:scale-90 transition-all border-none bg-transparent cursor-pointer"
          >
            <RightLine size={14} />
          </button>
        )}

        {/* Divider */}
        <div className="w-[1px] h-[14px] bg-border-primary/80 mx-[2px]" />

        {/* Offset Controls */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            adjustOffset(-100);
          }}
          aria-label="Lyrics earlier (-0.1s)"
          title="Lyrics earlier (-0.1s)"
          className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 active:scale-90 transition-all border-none bg-transparent cursor-pointer"
        >
          <MinimizeLine size={12} />
        </button>

        <button
          type="button"
          onClick={() => {
            setDropdownOpen(false);
            setOffsetOpen((v) => !v);
          }}
          className={`flex items-center gap-[4px] h-[24px] px-[6px] rounded-md text-[12px] font-mono transition-all border-none bg-transparent hover:bg-border-alpha-14 cursor-pointer ${
            offsetMs !== 0
              ? "text-text-primary font-[600]"
              : "text-text-secondary font-[500]"
          }`}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
          title={t("player.lyrics_offset")}
        >
          <TimeLine
            size={12}
            className={offsetMs !== 0 ? "text-text-primary" : "text-text-tertiary"}
          />
          <span>{formatOffsetBadge(offsetMs)}</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            adjustOffset(100);
          }}
          aria-label="Lyrics later (+0.1s)"
          title="Lyrics later (+0.1s)"
          className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 active:scale-90 transition-all border-none bg-transparent cursor-pointer"
        >
          <AddLine size={12} />
        </button>
      </div>

      <AnimatePresence>
        {dropdownOpen && hasMultiple && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute top-full left-0 mt-[6px] min-w-[140px] rounded-lg border border-border-primary bg-bg-panel/95 backdrop-blur-md p-[4px] shadow-2xl z-50 flex flex-col gap-[2px]"
          >
            {availableProviders.map((option, idx) => {
              const isActive = option.provider === currentProvider.provider;
              return (
                <button
                  key={option.provider}
                  type="button"
                  onClick={() => {
                    selectProvider(option.provider);
                    setDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between gap-[8px] w-full px-[8px] py-[6px] rounded-md text-[12px] transition-colors border-none cursor-pointer text-left ${
                    isActive
                      ? "bg-border-alpha-14 text-text-primary font-[500]"
                      : "bg-transparent text-text-secondary hover:bg-border-alpha-14 hover:text-text-primary font-[400]"
                  }`}
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  <span className="truncate">{option.provider}</span>
                  {isActive ? (
                    <CheckFill
                      size={14}
                      className="text-text-primary shrink-0"
                    />
                  ) : (
                    <span className="text-[10px] font-mono text-text-tertiary shrink-0">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}

        {offsetOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute top-full right-0 mt-[6px] w-[260px] rounded-xl border border-border-primary bg-bg-panel/95 backdrop-blur-xl p-[12px] shadow-2xl z-50 flex flex-col gap-[10px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[6px]">
                <TimeLine size={14} className="text-text-primary" />
                <span
                  className="text-[12px] font-[600] text-text-primary"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  {t("player.lyrics_offset")}
                </span>
              </div>
              {offsetMs !== 0 && (
                <button
                  type="button"
                  onClick={resetOffset}
                  className="inline-flex items-center gap-[4px] px-[6px] py-[2px] rounded-md text-[11px] font-[500] text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 border-none bg-transparent cursor-pointer transition-colors"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  <Refresh1Line size={11} />
                  <span>{t("player.reset")}</span>
                </button>
              )}
            </div>

            {/* Manual Input & Unit Switcher & Stepper */}
            <div className="flex items-center gap-[6px] bg-border-alpha-10 rounded-lg p-[4px] border border-border-primary/50">
              <button
                type="button"
                onClick={() => adjustOffset(unit === "ms" ? -50 : -100)}
                aria-label="Decrease offset"
                className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 active:scale-90 transition-all border-none bg-transparent cursor-pointer shrink-0"
              >
                <MinimizeLine size={12} />
              </button>

              <div className="flex-1 flex items-center justify-center min-w-0">
                <input
                  type="text"
                  value={inputValue}
                  onFocus={() => {
                    isInputFocusedRef.current = true;
                  }}
                  onBlur={() => {
                    isInputFocusedRef.current = false;
                    if (unit === "ms") {
                      setInputValue(String(offsetMs));
                    } else {
                      setInputValue(String(offsetMs / 1000));
                    }
                  }}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      adjustOffset(unit === "ms" ? 50 : 100);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      adjustOffset(unit === "ms" ? -50 : -100);
                    } else if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="0"
                  className="w-full text-center text-[13px] font-mono font-[600] text-text-primary bg-transparent border-none outline-none p-0"
                />
              </div>

              <div className="flex items-center bg-border-alpha-14 rounded-md p-[2px] shrink-0">
                <button
                  type="button"
                  onClick={() => setUnit("ms")}
                  className={`px-[5px] py-[2px] text-[10px] font-mono rounded-[4px] border-none cursor-pointer transition-all ${
                    unit === "ms"
                      ? "bg-bg-panel text-text-primary shadow-xs font-[600]"
                      : "bg-transparent text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  ms
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("s")}
                  className={`px-[5px] py-[2px] text-[10px] font-mono rounded-[4px] border-none cursor-pointer transition-all ${
                    unit === "s"
                      ? "bg-bg-panel text-text-primary shadow-xs font-[600]"
                      : "bg-transparent text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  s
                </button>
              </div>

              <button
                type="button"
                onClick={() => adjustOffset(unit === "ms" ? 50 : 100)}
                aria-label="Increase offset"
                className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border-alpha-14 active:scale-90 transition-all border-none bg-transparent cursor-pointer shrink-0"
              >
                <AddLine size={12} />
              </button>
            </div>

            {/* Quick Adjustments */}
            <div className="flex flex-col gap-[6px]">
              <div className="flex items-center justify-between text-[10px] font-[500] text-text-tertiary px-[2px]">
                <span>{t("player.earlier")} (-)</span>
                <span>{t("player.later")} (+)</span>
              </div>
              <div className="grid grid-cols-4 gap-[4px]">
                {[-1000, -500, -200, -100].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => adjustOffset(delta)}
                    className="py-[4px] text-[11px] font-mono rounded-md bg-border-alpha-10 hover:bg-border-alpha-20 text-text-secondary hover:text-text-primary transition-all active:scale-95 text-center border-none cursor-pointer"
                  >
                    {delta / 1000}s
                  </button>
                ))}
                {[100, 200, 500, 1000].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => adjustOffset(delta)}
                    className="py-[4px] text-[11px] font-mono rounded-md bg-border-alpha-10 hover:bg-border-alpha-20 text-text-secondary hover:text-text-primary transition-all active:scale-95 text-center border-none cursor-pointer"
                  >
                    +{delta / 1000}s
                  </button>
                ))}
              </div>
            </div>

            {/* Hint Footer */}
            <div className="text-[10px] text-text-tertiary leading-[1.3] text-center pt-[2px] border-t border-border-primary/40">
              {t("player.offset_hint")}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

