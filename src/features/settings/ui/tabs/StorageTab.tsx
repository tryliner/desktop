import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import lottie, { type AnimationItem } from "lottie-web";
import { FolderOpenLine, CheckLine } from "@mingcute/react";
import { CheckCircle } from "@solar-icons/react";
import Button from "@/shared/ui/Button";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import cleanDuckAnimationData from "@/assets/animations/clean_duck.json";
import {
  getCachedStorageAnalytics,
  setStorageTabOpen,
  refreshStorageAnalytics,
  clearStorageCategories,
  openCacheFolder,
  formatStorageBytes,
  getAudioCacheLimitBytes,
  setAudioCacheLimitBytes,
  type StorageAnalytics,
  type StorageCategoryId,
} from "@/shared/utils/cacheManager";

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSegment(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const delta = Math.max(0.1, endAngle - startAngle);
  const safeEndAngle = delta >= 360 ? startAngle + 359.99 : startAngle + delta;
  const startOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, safeEndAngle);
  const startInner = polarToCartesian(x, y, innerRadius, safeEndAngle);
  const endInner = polarToCartesian(x, y, innerRadius, startAngle);

  const largeArcFlag = delta > 180 ? "1" : "0";

  return [
    "M",
    startOuter.x,
    startOuter.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    1,
    endOuter.x,
    endOuter.y,
    "L",
    startInner.x,
    startInner.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    0,
    endInner.x,
    endInner.y,
    "Z",
  ].join(" ");
}

// authentic telegram animated tgs duck sticker for cache cleaning
function TelegramCleaningDuck({ size = 130 }: { size?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    animRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: cleanDuckAnimationData,
    });

    return () => {
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className="select-none pointer-events-none flex items-center justify-center overflow-hidden my-1"
    />
  );
}

export function StorageTab({ searchQuery: _searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const initialCached = getCachedStorageAnalytics();
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [selectedCategories, setSelectedCategories] = useState<Set<StorageCategoryId>>(() => {
    if (initialCached) {
      return new Set(initialCached.categories.filter((c) => c.bytes > 0).map((c) => c.id));
    }
    return new Set(["covers", "audio", "lyrics", "metadata"]);
  });
  const [clearing, setClearing] = useState(false);
  const [clearingProgress, setClearingProgress] = useState(0);
  const [clearedSuccess, setClearedSuccess] = useState(false);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<StorageCategoryId | null>(null);
  const [cacheLimit, setCacheLimit] = useState<number>(() => getAudioCacheLimitBytes());

  const handleLimitChange = async (newLimit: number) => {
    setCacheLimit(newLimit);
    await setAudioCacheLimitBytes(newLimit);
    const updated = await refreshStorageAnalytics();
    setAnalytics(updated);
  };

  useEffect(() => {
    setStorageTabOpen(true);
    return () => {
      setStorageTabOpen(false);
    };
  }, []);

  // load live metrics if not cached yet
  useEffect(() => {
    if (!analytics) {
      setLoading(true);
      refreshStorageAnalytics()
        .then((data) => {
          setAnalytics(data);
          setSelectedCategories((prev) => {
            if (prev.size === 0) {
              return new Set(data.categories.filter((c) => c.bytes > 0).map((c) => c.id));
            }
            return prev;
          });
        })
        .catch(() => {
          toast(t("settings.cache.local_cache.error"), "error");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [analytics, t, toast]);

  const toggleCategory = (id: StorageCategoryId) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedBytes = useMemo(() => {
    if (!analytics) return 0;
    return analytics.categories
      .filter((c) => selectedCategories.has(c.id))
      .reduce((sum, c) => sum + c.bytes, 0);
  }, [analytics, selectedCategories]);

  // handles selective or complete cache clearance with cute progression
  const handleClearSelected = async () => {
    if (selectedCategories.size === 0) return;
    setClearing(true);
    setClearingProgress(15);

    try {
      const targetIds = Array.from(selectedCategories);
      setClearingProgress(45);
      await clearStorageCategories(targetIds);
      setClearingProgress(85);

      // brief pause so user sees the telegram sweeping duck animation
      await new Promise((resolve) => setTimeout(resolve, 300));
      setClearingProgress(100);

      const fresh = await refreshStorageAnalytics();
      setAnalytics(fresh);
      setClearing(false);
      setClearedSuccess(true);
    } catch {
      setClearing(false);
      toast(t("settings.cache.local_cache.error"), "error");
    }
  };

  const handleOpenFolder = async () => {
    const opened = await openCacheFolder();
    if (opened) {
      toast(t("settings.storage.open_folder"), "success");
    } else {
      toast(t("settings.connection.open_folder"), "info");
    }
  };

  const formattedCenter = useMemo(() => {
    if (selectedBytes <= 0) return { val: "0", unit: "B" };
    const parts = formatStorageBytes(selectedBytes).split(" ");
    return { val: parts[0] || "0", unit: parts[1] || "B" };
  }, [selectedBytes]);

  const donutSlices = useMemo((): Array<{
    id: StorageCategoryId;
    color: string;
    startAngle: number;
    endAngle: number;
  }> => {
    if (!analytics || selectedBytes <= 0) return [];
    const active = analytics.categories.filter((c) => selectedCategories.has(c.id) && c.bytes > 0);

    if (active.length === 0) return [];
    if (active.length === 1) {
      return [
        {
          id: active[0].id,
          color: active[0].color,
          startAngle: 0,
          endAngle: 359.99,
        },
      ];
    }

    const baseGap = 2;
    let currentAngle = 0;

    return active.map((item) => {
      const sliceFraction = item.bytes / selectedBytes;
      const rawSpan = sliceFraction * 360;
      const sliceGap = Math.min(baseGap, rawSpan * 0.35);
      const startAngle = currentAngle + sliceGap / 2;
      const endAngle = Math.max(startAngle + 0.8, currentAngle + rawSpan - sliceGap / 2);
      currentAngle += rawSpan;

      return {
        id: item.id,
        color: item.color,
        startAngle,
        endAngle,
      };
    });
  }, [analytics, selectedBytes, selectedCategories]);

  return (
    <div className="flex-1 flex flex-col relative w-full h-full min-h-[460px]">
      <AnimatePresence mode="wait" initial={false}>
        {clearing ? (
          <motion.div
            key="clearing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col items-center justify-center my-auto py-6 text-center px-4 w-full h-full"
          >
            <TelegramCleaningDuck size={140} />
            <h3 className="text-text-primary text-[17px] font-[600] m-0 mt-3">
              {t("settings.storage.clearing_title")}
            </h3>
            <p className="text-text-tertiary text-[13px] max-w-[320px] m-0 mt-1 leading-normal">
              {t("settings.storage.clearing_subtitle")}
            </p>
            <div className="w-[200px] h-[4px] bg-border-alpha-14 rounded-full overflow-hidden mt-5">
              <div
                className="h-full bg-white transition-all duration-200 ease-out rounded-full"
                style={{ width: `${clearingProgress}%` }}
              />
            </div>
            <span className="text-text-tertiary text-[12px] font-mono mt-2">
              {clearingProgress}%
            </span>
          </motion.div>
        ) : clearedSuccess ? (
          <motion.div
            key="cleared"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col items-center justify-center my-auto py-6 text-center px-4 w-full h-full"
          >
            <div className="w-[64px] h-[64px] rounded-full bg-[#10B981]/15 flex items-center justify-center text-[#10B981] mb-2">
              <CheckCircle size={40} weight="Bold" />
            </div>
            <h3 className="text-text-primary text-[18px] font-[600] m-0 mt-2">
              {t("settings.storage.cleared_title")}
            </h3>
            <p className="text-text-tertiary text-[13px] max-w-[340px] m-0 mt-1 leading-normal">
              {t("settings.storage.cleared_subtitle")}
            </p>
            <Button
              variant="secondary"
              size="default"
              type="button"
              onClick={() => setClearedSuccess(false)}
              className="mt-6 min-w-[120px]"
            >
              {t("settings.storage.done_button")}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col gap-[20px] pt-[8px]"
          >
      <div className="bg-white/[0.035] dark:bg-white/[0.035] px-[16px] py-[10px] rounded-2xl">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full flex flex-col gap-0.5">
            {analytics?.categories.map((cat) => {
              const isSelected = selectedCategories.has(cat.id);
              const isHovered = hoveredCategoryId === cat.id;
              const total = analytics.totalBytes || 1;
              const pct = Math.round((cat.bytes / total) * 100);
              const pctLabel = cat.bytes === 0 ? "0%" : pct === 0 ? "<1%" : `${pct}%`;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  onMouseEnter={() => setHoveredCategoryId(cat.id)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                  className={`group w-full flex items-center justify-between px-[10px] py-[8px] rounded-lg transition-all border-0 cursor-pointer text-left ${
                    isSelected
                      ? isHovered
                        ? "bg-white/[0.05] opacity-100"
                        : "bg-transparent opacity-100"
                      : isHovered
                      ? "bg-white/[0.03] opacity-65"
                      : "bg-transparent opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-[9px] min-w-0">
                    <div
                      className={`w-[15px] h-[15px] rounded-[4px] flex items-center justify-center transition-all shrink-0 border ${
                        isSelected
                          ? "bg-white border-white text-black shadow-sm"
                          : "border-white/20 bg-white/[0.03] group-hover:border-white/40"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          className="flex items-center justify-center"
                        >
                          <CheckLine size={11} className="stroke-[1.5]" />
                        </motion.div>
                      )}
                    </div>

                    <div
                      className="w-[8px] h-[8px] rounded-full shrink-0 transition-opacity"
                      style={{ backgroundColor: cat.color }}
                    />

                    <span className="text-text-primary text-[12.5px] font-[500] truncate">
                      {t(cat.labelKey)}
                    </span>

                    <span className="text-[10px] font-[600] px-[5px] py-[0.5px] rounded bg-white/[0.06] text-text-tertiary">
                      {pctLabel}
                    </span>
                  </div>

                  <span className="text-text-secondary text-[12px] font-[500] shrink-0">
                    {formatStorageBytes(cat.bytes)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-center shrink-0 px-6">
            <div className="flex flex-col items-center">
              <div className="relative w-[136px] h-[136px] flex items-center justify-center">
                <svg
                  width="136"
                  height="136"
                  viewBox="0 0 200 200"
                  className="overflow-visible"
                >
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="24"
                    className="text-white/[0.08]"
                  />

                  <AnimatePresence>
                    {donutSlices.map((slice) => {
                      const isHovered = hoveredCategoryId === slice.id;
                      const pathData = describeDonutSegment(
                        100,
                        100,
                        isHovered ? 57.5 : 58,
                        isHovered ? 83.5 : 82,
                        slice.startAngle,
                        slice.endAngle
                      );

                      return (
                        <motion.path
                          key={slice.id}
                          d={pathData}
                          fill={slice.color}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="cursor-pointer transition-opacity origin-center"
                          onMouseEnter={() => setHoveredCategoryId(slice.id)}
                          onMouseLeave={() => setHoveredCategoryId(null)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </svg>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <div className="relative flex items-center justify-center">
                    <span className="text-[19px] font-[700] text-text-primary tracking-tight leading-none">
                      {formattedCenter.val}
                    </span>
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-[10px] font-[600] text-text-tertiary uppercase leading-none whitespace-nowrap">
                      {formattedCenter.unit}
                    </span>
                  </div>
                </div>
              </div>

              <span className="text-[11.5px] font-[500] text-text-tertiary -mt-1 text-center select-none tracking-tight">
                {t("settings.storage.usage_title")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[14px] bg-white/[0.035] dark:bg-white/[0.035] p-[16px] rounded-2xl">
        <div>
          <h5 className="text-text-primary text-[13.5px] font-[600] m-0">
            {t("settings.storage.audio_cache_limit")}
          </h5>
          <p className="text-text-tertiary text-[11.5px] m-0 mt-0.5">
            {t("settings.storage.audio_cache_limit_desc")}
          </p>
        </div>

        {(() => {
          const steps = [
            { label: "250 MB", bytes: 250 * 1024 * 1024 },
            { label: "1 GB", bytes: 1024 * 1024 * 1024 },
            { label: "2 GB", bytes: 2 * 1024 * 1024 * 1024 },
            { label: "3 GB", bytes: 3 * 1024 * 1024 * 1024 },
            { label: "5 GB", bytes: 5 * 1024 * 1024 * 1024 },
            { label: "10 GB", bytes: 10 * 1024 * 1024 * 1024 },
            { label: t("settings.storage.no_limit"), bytes: 0 },
          ];
          const activeIdx = Math.max(0, steps.findIndex((s) => s.bytes === cacheLimit));
          const pct = (activeIdx / (steps.length - 1)) * 100;

          return (
            <div className="flex flex-col gap-2 pt-2 pb-1 px-6">
              <div className="relative w-full h-[18px] flex items-center select-none group">
                <div className="absolute left-0 right-0 h-[2px] rounded-full bg-white/15 dark:bg-white/15" />
                <div
                  className="absolute left-0 h-[2px] rounded-full bg-text-primary transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />

                {steps.map((s, i) => {
                  const tickPct = (i / (steps.length - 1)) * 100;
                  const isPassed = i <= activeIdx;
                  return (
                    <div
                      key={s.bytes}
                      className={`absolute w-[2px] h-[6px] rounded-full -translate-x-1/2 transition-colors pointer-events-none ${
                        isPassed ? "bg-text-primary opacity-80" : "bg-white/35 dark:bg-white/35"
                      }`}
                      style={{ left: `${tickPct}%` }}
                    />
                  );
                })}

                <div
                  className="absolute w-[12px] h-[12px] rounded-full bg-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.4)] -translate-x-1/2 transition-all duration-150 pointer-events-none group-hover:scale-125"
                  style={{ left: `${pct}%` }}
                />

                <input
                  type="range"
                  min={0}
                  max={steps.length - 1}
                  step={1}
                  value={activeIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (steps[idx]) {
                      void handleLimitChange(steps[idx].bytes);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
                />
              </div>

              <div className="relative w-full h-[16px] select-none text-[11px]">
                {steps.map((s, i) => {
                  const tickPct = (i / (steps.length - 1)) * 100;
                  const isActive = i === activeIdx;
                  return (
                    <span
                      key={s.bytes}
                      onClick={() => void handleLimitChange(s.bytes)}
                      style={{ left: `${tickPct}%` }}
                      className={`absolute -translate-x-1/2 whitespace-nowrap cursor-pointer transition-colors ${
                        isActive
                          ? "text-text-primary font-[600]"
                          : "text-text-tertiary hover:text-text-secondary font-[500]"
                      }`}
                    >
                      {s.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="mt-auto flex items-center gap-[8px] pt-4">
        <Button
          variant="primary"
          size="default"
          type="button"
          disabled={selectedBytes === 0 || loading}
          onClick={handleClearSelected}
          className="flex-1 justify-center !h-[40px] !text-[13.5px] font-[500] rounded-xl"
        >
          {selectedBytes > 0
            ? t("settings.storage.clear_button", {
                size: formatStorageBytes(selectedBytes),
              })
            : t("settings.storage.clear_selected")}
        </Button>

        <Button
          variant="secondary"
          size="default"
          type="button"
          onClick={handleOpenFolder}
          title={t("settings.storage.open_folder")}
          className="flex items-center gap-[6px] !h-[40px] px-[14px] font-[500] text-[13px] rounded-xl shrink-0"
        >
          <FolderOpenLine size={16} />
          <span>{t("settings.storage.open_folder")}</span>
        </Button>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
