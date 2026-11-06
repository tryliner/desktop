export function isAbortError(
  error: unknown,
  signal?: AbortSignal | null,
): boolean {
  return (
    Boolean(signal?.aborted) ||
    (error instanceof DOMException && error.name === "AbortError")
  );
}

export function rethrowIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw signal.reason;
}

export function untilAborted<T>(
  promise: Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
