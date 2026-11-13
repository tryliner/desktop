const DB_NAME = "liner_appearance_files_v1";
const STORE = "files";
const KEY = "background";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveBackgroundFile(file: Blob): Promise<void> {
  await run("readwrite", (store) => store.put(file, KEY));
}

export async function loadBackgroundFile(): Promise<Blob | null> {
  const value = await run<unknown>("readonly", (store) => store.get(KEY));
  return value instanceof Blob ? value : null;
}

export async function clearBackgroundFile(): Promise<void> {
  await run("readwrite", (store) => store.delete(KEY));
}
