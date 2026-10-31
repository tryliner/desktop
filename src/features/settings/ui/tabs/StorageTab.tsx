import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import lottie, {
  type AnimationItem,
} from "lottie-web/build/player/lottie_light";
import { CheckCircle } from "@solar-icons/react";
import Button from "@/shared/ui/Button";
import { ToggleSwitch, useToast } from "@/shared/ui";
import { useCachedTracksStore } from "@/features/library/cached";
import { PresetPills } from "@/shared/ui/PresetPills";
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
  LIBRARY_CATEGORY_IDS,
} from "@/shared/utils/cacheManager";
import { useSavedTracksStore } from "@/features/library/saved";
import { SettingRow, SettingSection } from "../controls";
import {
  SMOOTH_EASE,
  StorageOverview,
  useSongEstimate,
} from "./StorageOverview";
import { StorageSizeAction } from "./StorageSizeAction";
import { StorageFolderButton } from "./StorageFolderButton";
import { StorageDownloadsSection } from "./StorageDownloadsSection";

const GB = 1024 * 1024 * 1024;
const CACHE_LIMIT_OPTIONS = [GB, 3 * GB, 10 * GB, 0];
const FALLBACK_SONG_BYTES = 4 * 1024 * 1024;
const MIN_SONG_BYTES = 2 * 1024 * 1024;
const MAX_SONG_BYTES = 12 * 1024 * 1024;

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

type ClearKind = "cache" | "liked" | "local";

const CLEAR_COPY: Record<
  ClearKind,
  { working: string; workingDesc: string; done: string; doneDesc: string }
> = {
  cache: {
    working: "settings.storage.clearing_title",
    workingDesc: "settings.storage.clearing_subtitle",
    done: "settings.storage.cleared_title",
    doneDesc: "settings.storage.cleared_subtitle",
  },
  liked: {
    working: "settings.storage.removing_liked_title",
    workingDesc: "settings.storage.removing_subtitle",
    done: "settings.storage.removed_title",
    doneDesc: "settings.storage.removed_liked_subtitle",
  },
  local: {
    working: "settings.storage.removing_local_title",
    workingDesc: "settings.storage.removing_subtitle",
    done: "settings.storage.removed_title",
    doneDesc: "settings.storage.removed_local_subtitle",
  },
};

const FADE = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.985 },
  transition: { duration: 0.32, ease: SMOOTH_EASE },
};

export function StorageTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(() =>
    getCachedStorageAnalytics(),
  );
  const [clearing, setClearing] = useState(false);
  const [clearKind, setClearKind] = useState<ClearKind>("cache");
  const [clearingProgress, setClearingProgress] = useState(0);
  const [freedBytes, setFreedBytes] = useState<number | null>(null);
  const [cacheLimit, setCacheLimit] = useState<number>(() =>
    getAudioCacheLimitBytes(),
  );
  const savedCount = useSavedTracksStore((state) => state.records.length);
  const cachedVisibleOnline = useCachedTracksStore(
    (state) => state.visibleOnline,
  );
  const setCachedVisibleOnline = useCachedTracksStore(
    (state) => state.setVisibleOnline,
  );

  const refresh = async () => {
    setAnalytics(await refreshStorageAnalytics(true));
  };

  const handleLimitChange = async (newLimit: number) => {
    setCacheLimit(newLimit);
    await setAudioCacheLimitBytes(newLimit);
    await refresh();
  };

  useEffect(() => {
    setStorageTabOpen(true);
    return () => {
      setStorageTabOpen(false);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshStorageAnalytics()
        .then(setAnalytics)
        .catch(() => {
          toast(t("settings.cache.local_cache.error"), "error");
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [savedCount, t, toast]);

  const { cacheCategories, musicCategories } = useMemo(() => {
    const all = analytics?.categories ?? [];
    return {
      cacheCategories: all.filter((c) => !LIBRARY_CATEGORY_IDS.has(c.id)),
      musicCategories: all.filter((c) => LIBRARY_CATEGORY_IDS.has(c.id)),
    };
  }, [analytics]);

  const cacheBytes = cacheCategories.reduce((sum, c) => sum + c.bytes, 0);
  const musicBytes = musicCategories.reduce((sum, c) => sum + c.bytes, 0);

  const songBytes = useMemo(() => {
    const sample = musicCategories.find(
      (c) => c.bytes > 0 && (c.count ?? 0) > 0,
    );
    if (!sample) return FALLBACK_SONG_BYTES;
    const average = sample.bytes / (sample.count ?? 1);
    return Math.min(MAX_SONG_BYTES, Math.max(MIN_SONG_BYTES, average));
  }, [musicCategories]);

  const cacheLimitSongs = useSongEstimate(cacheLimit, songBytes);
  const cacheLimitDescription =
    cacheLimit > 0
      ? t("settings.storage.cache_limit_hint", { count: cacheLimitSongs })
      : t("settings.storage.cache_limit_unlimited");

  const runClear = async (
    kind: ClearKind,
    expected: number,
    work: () => Promise<unknown>,
  ) => {
    setClearKind(kind);
    setClearing(true);
    setClearingProgress(15);

    try {
      setClearingProgress(40);
      await Promise.all([
        work(),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
      setClearingProgress(80);

      await new Promise((resolve) => setTimeout(resolve, 260));
      setClearingProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 140));

      await refresh();
      setClearing(false);
      setFreedBytes(expected);
    } catch {
      setClearing(false);
      toast(
        t(
          kind === "cache"
            ? "settings.cache.local_cache.error"
            : "settings.storage.remove_failed",
        ),
        "error",
      );
      void refresh();
    }
  };

  const clearCache = () => {
    const ids = cacheCategories.map((c) => c.id);
    if (ids.length === 0) return;
    void runClear("cache", cacheBytes, () => clearStorageCategories(ids));
  };

  const handleOpenFolder = async () => {
    const opened = await openCacheFolder();
    if (!opened) toast(t("settings.connection.open_folder"), "info");
  };

  return (
    <div className="flex-1 flex flex-col relative w-full h-full min-h-[460px]">
      <AnimatePresence mode="popLayout" initial={false}>
        {clearing ? (
          <motion.div
            key="clearing"
            {...FADE}
            className="flex-1 flex flex-col items-center justify-center my-auto py-6 text-center px-4 w-full h-full"
          >
            <TelegramCleaningDuck size={140} />
            <h3 className="text-text-primary text-[17px] font-[600] m-0 mt-3">
              {t(CLEAR_COPY[clearKind].working)}
            </h3>
            <p className="text-text-tertiary text-[13px] max-w-[320px] m-0 mt-1 leading-normal">
              {t(CLEAR_COPY[clearKind].workingDesc)}
            </p>
            <div className="w-[200px] h-[4px] bg-border-alpha-14 rounded-full overflow-hidden mt-5">
              <div
                className="h-full bg-text-primary transition-all duration-200 ease-out rounded-full"
                style={{ width: `${clearingProgress}%` }}
              />
            </div>
          </motion.div>
        ) : freedBytes !== null ? (
          <motion.div
            key="cleared"
            {...FADE}
            className="flex-1 flex flex-col items-center justify-center my-auto py-6 text-center px-4 w-full h-full"
          >
            <div className="w-[64px] h-[64px] rounded-full bg-border-alpha-14 flex items-center justify-center text-text-primary mb-2">
              <CheckCircle size={36} weight="Bold" />
            </div>
            <h3 className="text-text-primary text-[18px] font-[600] m-0 mt-2">
              {freedBytes > 0
                ? t("settings.storage.freed_title", {
                    size: formatStorageBytes(freedBytes),
                  })
                : t(CLEAR_COPY[clearKind].done)}
            </h3>
            <p className="text-text-tertiary text-[13px] max-w-[340px] m-0 mt-1 leading-normal">
              {t(CLEAR_COPY[clearKind].doneDesc)}
            </p>
            <Button
              variant="secondary"
              size="default"
              type="button"
              onClick={() => setFreedBytes(null)}
              className="mt-6 min-w-[120px]"
            >
              {t("settings.storage.done_button")}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="main"
            {...FADE}
            className="flex flex-col gap-[18px] pt-[8px] pb-[4px] w-full"
          >
            {!searchQuery?.trim() ? (
              <StorageOverview
                musicBytes={musicBytes}
                cacheBytes={cacheBytes}
                freeBytes={analytics?.freeBytes}
              />
            ) : null}

            <StorageDownloadsSection
              songBytes={songBytes}
              liked={musicCategories.find((c) => c.id === "liked")}
              local={musicCategories.find((c) => c.id === "local")}
              onRemove={(kind, bytes, remove) =>
                void runClear(kind, bytes, remove)
              }
              searchQuery={searchQuery}
            />

            <SettingSection
              label={t("settings.storage.cache_title")}
              action={
                <StorageFolderButton
                  label={t("settings.storage.open_folder_short")}
                  onOpen={() => void handleOpenFolder()}
                />
              }
            >
              <SettingRow
                title={t("settings.storage.cache_row_title")}
                description={t("settings.storage.cache_row_desc")}
                explained
                titleKey="settings.storage.cache_row_title"
                descKey="settings.storage.cache_row_desc"
                searchQuery={searchQuery}
                control={
                  <StorageSizeAction
                    bytes={cacheBytes}
                    actionLabel={t("settings.storage.clear")}
                    confirmLabel={t("settings.storage.clear_size", {
                      size: formatStorageBytes(cacheBytes),
                    })}
                    disabled={cacheBytes === 0}
                    onConfirm={clearCache}
                  />
                }
              />
              <SettingRow
                title={t("settings.storage.cache_limit")}
                description={cacheLimitDescription}
                explained
                titleKey="settings.storage.cache_limit"
                searchQuery={searchQuery}
                control={
                  <PresetPills
                    ariaLabel={t("settings.storage.cache_limit")}
                    size="md"
                    fill={false}
                    value={cacheLimit}
                    onChange={(value) => void handleLimitChange(value)}
                    options={CACHE_LIMIT_OPTIONS.map((bytes) => ({
                      value: bytes,
                      label:
                        bytes === 0
                          ? t("settings.storage.no_limit")
                          : `${bytes / GB} GB`,
                    }))}
                  />
                }
              />
              <SettingRow
                title={t("settings.storage.cached_in_library")}
                description={t("settings.storage.cached_in_library_desc")}
                explained
                titleKey="settings.storage.cached_in_library"
                descKey="settings.storage.cached_in_library_desc"
                searchQuery={searchQuery}
                control={
                  <ToggleSwitch
                    checked={cachedVisibleOnline}
                    onChange={setCachedVisibleOnline}
                    ariaLabel={t("settings.storage.cached_in_library")}
                  />
                }
              />
            </SettingSection>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
