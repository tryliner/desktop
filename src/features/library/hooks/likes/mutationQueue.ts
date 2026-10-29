import { isScopeActive, type AccountScope } from "./accountScope.ts";
import { notifyLibraryChanged } from "../usePlaylists.ts";

export class StaleSessionError extends Error {
  constructor() {
    super("Session changed");
    this.name = "StaleSessionError";
  }
}

export type MutateOptions<R = unknown> = {
  onSuccess?: (value: R) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

export type TrackMutationInput =
  | string
  | { trackId: string; [key: string]: unknown };

export const trackIdFrom = (input: TrackMutationInput) =>
  typeof input === "string" ? input : input.trackId;

const NOTIFY_DEBOUNCE_MS = 300;

let inflight = 0;
let notifyTimer: ReturnType<typeof setTimeout> | undefined;

export function beginLibraryMutation() {
  inflight++;
  clearTimeout(notifyTimer);
}

export function endLibraryMutation() {
  inflight = Math.max(0, inflight - 1);
  clearTimeout(notifyTimer);
  if (inflight > 0) return;

  notifyTimer = setTimeout(() => {
    if (inflight === 0) notifyLibraryChanged();
  }, NOTIFY_DEBOUNCE_MS);
}

function rejectOnAbort<T>(signal: AbortSignal, work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new StaleSessionError());
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

const queues = new Map<string, Promise<unknown>>();

export function runSerial<T>(
  trackId: string,
  scope: AccountScope,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const prev = queues.get(trackId) ?? Promise.resolve();
  const work = prev
    .catch(() => undefined)
    .then(() => {
      if (!isScopeActive(scope)) throw new StaleSessionError();
      return task(scope.signal);
    });
  const next = rejectOnAbort(scope.signal, work);
  queues.set(trackId, next);

  const cleanup = () => {
    if (queues.get(trackId) === next) queues.delete(trackId);
  };
  next.then(cleanup, cleanup);

  return next;
}
