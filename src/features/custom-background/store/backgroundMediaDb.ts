// the wallpaper file lives in its own tiny database so clearing the app cache
// (which wipes liner_db_v1) never takes the user's background with it
const DB_NAME = "liner_background_v1";
const DB_VERSION = 1;
const STORE_NAME = "media";
const ACTIVE_KEY = "active";

// 0.1.x kept the wallpaper as a data url in its own database
const LEGACY_DB_NAME = "liner_customization_db";
const LEGACY_STORE_NAME = "wallpapers";
const LEGACY_KEY = "active_wallpaper";

export interface BackgroundMediaRecord {
  blob: Blob;
  type: string;
  name: string;
  size: number;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
// used when indexeddb is unavailable (tests, broken profiles)
let memRecord: BackgroundMediaRecord | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      dbPromise = null;
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
      };
      db.onversionchange = () => {
        try {
          db.close();
        } catch {}
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const req = operation(tx.objectStore(STORE_NAME));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("tx aborted"));
      }),
  );
}

export async function saveBackgroundMedia(
  file: Blob,
  name: string,
): Promise<BackgroundMediaRecord> {
  const record: BackgroundMediaRecord = {
    blob: file,
    type: file.type,
    name,
    size: file.size,
    savedAt: Date.now(),
  };
  if (!hasIndexedDb()) {
    memRecord = record;
    return record;
  }
  await run("readwrite", (store) => store.put(record, ACTIVE_KEY));
  return record;
}

export async function loadBackgroundMedia(): Promise<BackgroundMediaRecord | null> {
  if (!hasIndexedDb()) return memRecord;
  try {
    const record = await run<BackgroundMediaRecord | undefined>(
      "readonly",
      (store) => store.get(ACTIVE_KEY),
    );
    return record?.blob ? record : null;
  } catch {
    return null;
  }
}

// rejects when the record couldn't be deleted, so callers don't report a
// removal that would come back on the next start
export async function deleteBackgroundMedia(): Promise<void> {
  if (hasIndexedDb()) {
    await run("readwrite", (store) => store.delete(ACTIVE_KEY));
  }
  memRecord = null;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const [, type, isBase64, payload] = match;
  try {
    if (!isBase64) return new Blob([decodeURIComponent(payload)], { type });
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
  } catch {
    return null;
  }
}

/**
 * Reads the wallpaper a 0.1.x install left behind, or null when there is none.
 */
export async function readLegacyWallpaper(): Promise<Blob | null> {
  if (!hasIndexedDb()) return null;
  try {
    // indexedDB.open would create the old database just to find it empty
    const existing = await indexedDB.databases?.();
    if (existing && !existing.some((db) => db.name === LEGACY_DB_NAME))
      return null;
  } catch {}

  const dataUrl = await new Promise<string | null>((resolve) => {
    try {
      const req = indexedDB.open(LEGACY_DB_NAME);
      req.onsuccess = () => {
        const db = req.result;
        const done = (value: string | null) => {
          db.close();
          resolve(value);
        };
        if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
          done(null);
          return;
        }
        try {
          const get = db
            .transaction(LEGACY_STORE_NAME, "readonly")
            .objectStore(LEGACY_STORE_NAME)
            .get(LEGACY_KEY);
          get.onsuccess = () =>
            done(typeof get.result === "string" ? get.result : null);
          get.onerror = () => done(null);
        } catch {
          done(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dataUrl ? dataUrlToBlob(dataUrl) : null;
}

export function dropLegacyWallpaper(): void {
  if (!hasIndexedDb()) return;
  try {
    indexedDB.deleteDatabase(LEGACY_DB_NAME);
  } catch {}
}
