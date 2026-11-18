import { create } from "zustand";
import { getAuthSession } from "@/shared/api";

/**
 * Custom playlist covers. The API has no cover field yet, so they live on
 * this device behind a small adapter: the desktop app keeps them on disk via
 * IPC (served as liner-local://playlist-cover/<key>), the web build keeps
 * them in IndexedDB. A server-side store can slot in later with the same
 * interface, and a cover the server returns always wins over the local one.
 */
export interface PlaylistCoverAdapter {
  /** playlistId -> displayable url */
  list(userId: string): Promise<Record<string, string>>;
  set(userId: string, playlistId: string, image: Blob): Promise<string>;
  remove(userId: string, playlistId: string): Promise<void>;
}

export class PlaylistCoverError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

function electronAdapter(): PlaylistCoverAdapter | null {
  const bridge = typeof window !== "undefined" ? window.linerElectron : null;
  if (!bridge?.playlistCoversSet) return null;
  const url = (key: string, updatedAt: number) =>
    `liner-local://playlist-cover/${key}?v=${updatedAt}`;
  return {
    async list(userId) {
      const covers = await bridge.playlistCoversList(userId);
      return Object.fromEntries(
        covers.map((cover) => [
          cover.playlistId,
          url(cover.key, cover.updatedAt),
        ]),
      );
    },
    async set(userId, playlistId, image) {
      const bytes = new Uint8Array(await image.arrayBuffer());
      const result = await bridge.playlistCoversSet({
        userId,
        playlistId,
        bytes,
      });
      if (!result.ok) throw new PlaylistCoverError(result.reason);
      return url(result.cover.key, result.cover.updatedAt);
    },
    async remove(userId, playlistId) {
      await bridge.playlistCoversRemove({ userId, playlistId });
    },
  };
}

const IDB_NAME = "liner_playlist_covers_v1";
const IDB_STORE = "covers";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, mode);
        const request = run(tx.objectStore(IDB_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** web build only: blobs in IndexedDB, shown through object urls */
function indexedDbAdapter(): PlaylistCoverAdapter {
  const objectUrls = new Map<string, string>();
  const toUrl = (id: string, blob: Blob) => {
    const previous = objectUrls.get(id);
    if (previous) URL.revokeObjectURL(previous);
    const next = URL.createObjectURL(blob);
    objectUrls.set(id, next);
    return next;
  };
  const prefix = (userId: string) => `${userId}\u0000`;
  return {
    async list(userId) {
      const keys = (await idbRequest("readonly", (s) =>
        s.getAllKeys(),
      )) as string[];
      const out: Record<string, string> = {};
      for (const key of keys) {
        if (!key.startsWith(prefix(userId))) continue;
        const blob = (await idbRequest("readonly", (s) => s.get(key))) as
          Blob | undefined;
        if (blob) out[key.slice(prefix(userId).length)] = toUrl(key, blob);
      }
      return out;
    },
    async set(userId, playlistId, image) {
      const key = prefix(userId) + playlistId;
      await idbRequest("readwrite", (s) => s.put(image, key));
      return toUrl(key, image);
    },
    async remove(userId, playlistId) {
      const key = prefix(userId) + playlistId;
      await idbRequest("readwrite", (s) => s.delete(key));
      const previous = objectUrls.get(key);
      if (previous) URL.revokeObjectURL(previous);
      objectUrls.delete(key);
    },
  };
}

let adapter: PlaylistCoverAdapter | null = null;
function getAdapter(): PlaylistCoverAdapter | null {
  if (adapter) return adapter;
  adapter =
    electronAdapter() ??
    (typeof indexedDB !== "undefined" ? indexedDbAdapter() : null);
  return adapter;
}

/** tests swap the storage backend */
export function setPlaylistCoverAdapter(next: PlaylistCoverAdapter | null) {
  adapter = next;
}

const currentUserId = () => getAuthSession()?.user?.id ?? null;

interface PlaylistCoversState {
  userId: string | null;
  covers: Record<string, string>;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  setCover: (playlistId: string, image: Blob) => Promise<void>;
  removeCover: (playlistId: string) => Promise<void>;
}

let loading: Promise<void> | null = null;

export const usePlaylistCoversStore = create<PlaylistCoversState>(
  (set, get) => ({
    userId: null,
    covers: {},
    loaded: false,

    load: (force = false) => {
      const userId = currentUserId();
      const store = getAdapter();
      if (!userId || !store) {
        set({ userId: null, covers: {}, loaded: true });
        return Promise.resolve();
      }
      if (!force && get().loaded && get().userId === userId) {
        return Promise.resolve();
      }
      if (loading) return loading;
      loading = store
        .list(userId)
        .then((covers) => {
          if (currentUserId() === userId) {
            set({ userId, covers, loaded: true });
          }
        })
        .catch(() => set({ userId, covers: {}, loaded: true }))
        .finally(() => {
          loading = null;
        });
      return loading;
    },

    setCover: async (playlistId, image) => {
      const userId = currentUserId();
      const store = getAdapter();
      if (!userId || !store) throw new PlaylistCoverError("signed-out");
      const url = await store.set(userId, playlistId, image);
      set((state) => ({ covers: { ...state.covers, [playlistId]: url } }));
    },

    removeCover: async (playlistId) => {
      const userId = currentUserId();
      const store = getAdapter();
      if (!userId || !store) return;
      // optimistic: the mosaic comes back right away
      set((state) => {
        const covers = { ...state.covers };
        delete covers[playlistId];
        return { covers };
      });
      await store.remove(userId, playlistId);
    },
  }),
);

if (typeof window !== "undefined") {
  window.addEventListener("auth:changed", () => {
    usePlaylistCoversStore.setState({ covers: {}, loaded: false });
    void usePlaylistCoversStore.getState().load(true);
  });
}

let loadScheduled = false;
/** called from render, so the store update is deferred out of it */
function ensureLoaded() {
  if (loadScheduled || usePlaylistCoversStore.getState().loaded) return;
  loadScheduled = true;
  queueMicrotask(() => {
    loadScheduled = false;
    void usePlaylistCoversStore.getState().load();
  });
}

/** the user's own cover for a playlist, if they picked one on this device */
export function useCustomPlaylistCover(
  playlistId: string | null | undefined,
): string | undefined {
  ensureLoaded();
  return usePlaylistCoversStore((state) =>
    playlistId ? state.covers[playlistId] : undefined,
  );
}

export function usePlaylistCoverMap(): Record<string, string> {
  ensureLoaded();
  return usePlaylistCoversStore((state) => state.covers);
}
