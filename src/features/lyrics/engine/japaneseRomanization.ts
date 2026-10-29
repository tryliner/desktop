import type { JapaneseRequest, JapaneseResponse } from "./japaneseTypes";

const cache = new Map<string, string>();
const pending = new Map<
  number,
  { resolve: (texts: string[]) => void; reject: (error: Error) => void }
>();
const batches = new Map<string, Promise<void>>();
let worker: Worker | null = null;
let nextId = 0;

function stopWorker(error: Error) {
  worker?.terminate();
  worker = null;
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    new URL("./japaneseRomanization.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
  worker.onmessage = (event: MessageEvent<JapaneseResponse>) => {
    const { id, results, error } = event.data;
    const request = pending.get(id);
    pending.delete(id);
    if (error) request?.reject(new Error(error));
    else request?.resolve(results ?? []);
  };
  worker.onerror = () =>
    stopWorker(new Error("Japanese romanizer failed to load"));
  worker.onmessageerror = () =>
    stopWorker(new Error("Invalid Japanese romanization response"));
  return worker;
}

export function readJapaneseRomanization(text: string): string | null {
  return cache.get(text.trim()) ?? null;
}

export function prepareJapaneseLyrics(texts: string[]): Promise<void> {
  const missing = [...new Set(texts.map((text) => text.trim()))].filter(
    (text) => !cache.has(text),
  );
  if (missing.length === 0) return Promise.resolve();
  const key = JSON.stringify(missing);
  const existing = batches.get(key);
  if (existing) return existing;

  const ready = new Promise<string[]>((resolve, reject) => {
    const activeWorker = getWorker();
    const id = nextId++;
    const timeout = setTimeout(() => {
      stopWorker(new Error("Japanese romanizer timed out"));
    }, 60_000);
    pending.set(id, {
      resolve: (results) => {
        clearTimeout(timeout);
        resolve(results);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    activeWorker.postMessage({
      id,
      texts: missing,
      dictionaryPath: new URL("kuromoji-dict/", document.baseURI).pathname,
    } satisfies JapaneseRequest);
  })
    .then((results) => {
      if (results.length !== missing.length)
        throw new Error("Incomplete Japanese romanization");
      missing.forEach((text, i) => cache.set(text, results[i]));
      while (cache.size > 2000) cache.delete(cache.keys().next().value!);
    })
    .finally(() => {
      batches.delete(key);
    });
  batches.set(key, ready);
  return ready;
}
