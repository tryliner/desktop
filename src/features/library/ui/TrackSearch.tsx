import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloseCircleFill, Search2Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { isMacPlatform } from "@/features/shortcuts";
import { isBlockingOverlayOpen } from "@/features/navigation/utils/shortcutGuards";
import {
  filterTracks,
  type SearchableTrack,
  type TrackMatch,
} from "@/shared/utils/trackSearch";

// In-page search for track lists (playlists, albums, mixes, liked songs).
// It only filters what is shown: playback, Play all, Shuffle and Add to queue
// keep using the full list, so starting a track from the results still plays
// the whole playlist from there.

export interface TrackSearchState<T> {
  query: string;
  /** trimmed, deferred query the results were computed for ("" = not filtering) */
  activeQuery: string;
  /** null while not filtering */
  matches: TrackMatch<T>[] | null;
  focusToken: number;
  setQuery: (q: string) => void;
  focus: () => void;
}

export function useTrackSearch<T extends SearchableTrack>(
  tracks: readonly T[],
  /** search resets when this changes (e.g. the playlist id) */
  resetKey: unknown,
): TrackSearchState<T> {
  const [query, setQuery] = useState("");
  const [focusToken, setFocusToken] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const activeQuery = deferredQuery.trim();

  useEffect(() => {
    setQuery("");
  }, [resetKey]);

  const matches = useMemo(
    () => (activeQuery ? filterTracks(tracks, activeQuery) : null),
    [tracks, activeQuery],
  );

  const focus = useCallback(() => {
    setFocusToken((n) => n + 1);
  }, []);

  // ctrl/cmd+f focuses the search, like find-in-page everywhere else
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code !== "KeyF" ||
        !(e.ctrlKey || e.metaKey) ||
        e.altKey ||
        e.shiftKey
      )
        return;
      if (isBlockingOverlayOpen()) return;
      e.preventDefault();
      focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focus]);

  return { query, activeQuery, matches, focusToken, setQuery, focus };
}

interface TrackSearchFieldProps {
  search: TrackSearchState<unknown>;
  totalCount: number;
  placeholder: string;
  /** Enter: play the first result */
  onSubmit?: () => void;
  className?: string;
}

export const TrackSearchField = memo(function TrackSearchField({
  search,
  totalCount,
  placeholder,
  onSubmit,
  className = "",
}: TrackSearchFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, focusToken, matches } = search;

  useEffect(() => {
    if (focusToken === 0) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [focusToken]);

  const hasQuery = query.trim().length > 0;

  return (
    <div
      role="search"
      data-no-window-drag
      className={`flex h-[32px] w-[220px] items-center gap-[8px] rounded-[9px] px-[10px] text-text-primary ${className}`}
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <Search2Line size={16} className="shrink-0 text-text-secondary" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={placeholder}
        aria-label={`${placeholder} (${isMacPlatform() ? "⌘F" : "Ctrl+F"})`}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            // handled here so the app-wide Escape (back / close panels) stands down
            e.preventDefault();
            e.stopPropagation();
            if (query) setQuery("");
            else inputRef.current?.blur();
          } else if (e.key === "Enter") {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        className="h-[32px] min-w-0 flex-1 border-none bg-transparent p-0 text-[14px] leading-[32px] font-[400] text-text-primary outline-none placeholder:text-text-secondary"
      />
      {hasQuery && matches && (
        <span
          className="shrink-0 text-[12px] tabular-nums text-text-tertiary select-none"
          aria-live="polite"
        >
          {t("track_search.count", {
            count: matches.length,
            total: totalCount,
          })}
        </span>
      )}
      <AnimatePresence>
        {hasQuery && (
          <motion.button
            key="clear"
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.1 }}
            aria-label={t("track_search.clear")}
            data-no-tooltip="true"
            // keep focus in the field while clearing
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="-mr-[2px] flex shrink-0 items-center justify-center border-none bg-transparent p-0 cursor-pointer text-text-tertiary transition-colors hover:text-text-primary"
          >
            <CloseCircleFill size={15} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

export const TrackSearchEmpty = memo(function TrackSearchEmpty({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-[10px] text-center select-none"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <Search2Line size={32} className="text-text-tertiary/70" />
      <p className="m-0 max-w-[360px] truncate text-[14px] font-[500] text-text-primary">
        {t("track_search.no_results", { query })}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        {t("track_search.clear")}
      </button>
    </div>
  );
});
