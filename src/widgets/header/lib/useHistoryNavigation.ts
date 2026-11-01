import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface RouterHistoryState {
  idx?: number;
}

function readHistoryIndex() {
  const state: RouterHistoryState | null = window.history.state;
  return state?.idx ?? 0;
}

export function useHistoryNavigation() {
  useLocation();
  const navigate = useNavigate();
  const index = readHistoryIndex();
  const canGoBack = index > 0;
  const canGoForward = index < window.history.length - 1;

  const goBack = useCallback(() => navigate(-1), [navigate]);
  const goForward = useCallback(() => navigate(1), [navigate]);

  return { canGoBack, canGoForward, goBack, goForward };
}
