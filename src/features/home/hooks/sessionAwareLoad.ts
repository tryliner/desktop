import { useSyncExternalStore } from "react";
import { getAuthSession } from "@/shared/api";

const RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 20_000];

function subscribe(onChange: () => void): () => void {
  window.addEventListener("auth:changed", onChange);
  return () => window.removeEventListener("auth:changed", onChange);
}

function ownerSnapshot(): string {
  return getAuthSession()?.user?.id ?? "";
}

export function useSessionOwner(): string {
  return useSyncExternalStore(subscribe, ownerSnapshot, ownerSnapshot);
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return true;
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

export async function loadWithRetry<T>(
  load: () => Promise<T>,
  isActive: () => boolean,
  delays: readonly number[] = RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (err) {
      if (attempt >= delays.length || !isActive() || !isRetryable(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      if (!isActive()) throw err;
    }
  }
}
