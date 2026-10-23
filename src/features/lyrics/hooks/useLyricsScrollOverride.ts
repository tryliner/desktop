import { useState, useRef, useCallback, useEffect } from "react";

export interface UseLyricsScrollOverrideOptions {
  resumeDelayMs?: number;
  onResume?: () => void;
}

export interface UseLyricsScrollOverrideResult {
  isUserScrolling: boolean;
  handleUserInteraction: () => void;
  resumeImmediately: () => void;
}

/**
 * Hook to pause auto-scrolling when user manually interacts (wheel/touch)
 * and automatically resumes after an idle delay (default: 3000ms).
 */
export function useLyricsScrollOverride({
  resumeDelayMs = 3000,
  onResume,
}: UseLyricsScrollOverrideOptions = {}): UseLyricsScrollOverrideResult {
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  const handleUserInteraction = useCallback(() => {
    setIsUserScrolling(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      onResumeRef.current?.();
      timerRef.current = null;
    }, resumeDelayMs);
  }, [resumeDelayMs]);

  const resumeImmediately = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsUserScrolling(false);
    onResumeRef.current?.();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return {
    isUserScrolling,
    handleUserInteraction,
    resumeImmediately,
  };
}
