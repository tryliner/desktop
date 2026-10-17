import { create } from "zustand";
import { api, mediaUrl } from "@/shared/api";
import { resolveDirectInnertubeStream } from "@/shared/api/directInnertube";
import { isStandaloneAudioFile } from "@/shared/storage/audioFormat";
import { linerDb, type OfflinePlaylist } from "@/shared/storage/linerDb";
import type { Track } from "@/shared/types";

type DownloadError = "network" | "storage" | "unavailable";

interface DownloadState {
  playlists: OfflinePlaylist[];
  loaded: boolean;
  activeId: string | null;
  errors: Partial<Record<string, DownloadError>>;
  load: () => Promise<void>;
  save: (id: string, title: string, tracks: Track[]) => Promise<void>;
  cancel: () => void;
  remove: (id: string) => Promise<void>;
}

let controller: AbortController | null = null;
let running: Promise<void> | null = null;
let loading: Promise<void> | null = null;

async function saveCover(url: string, signal: AbortSignal): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return "";
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size > 2 * 1024 * 1024) return "";
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  playlists: [],
  loaded: false,
  activeId: null,
  errors: {},
  load: async () => {
    if (loading) return loading;
    loading = (async () => {
      try {
        const playlists = await linerDb.getOfflinePlaylists();
        // Reconcile files removed by the browser or an interrupted storage cleanup.
        for (const playlist of playlists) {
          const present = await Promise.all(playlist.downloadedIds.map(async (id) =>
            await linerDb.hasAudio(id) ? id : null));
          playlist.downloadedIds = present.filter((id): id is string => id !== null);
        }
        set({ playlists, loaded: true, errors: {} });
      } catch {
        set({ loaded: true, errors: { library: "storage" } });
      }
    })().finally(() => { loading = null; });
    return loading;
  },
  save: async (id, title, tracks) => {
    if (get().activeId || !tracks.length) return;
    const abort = new AbortController();
    controller = abort;
    set((state) => ({ activeId: id, errors: { ...state.errors, [id]: undefined } }));
    running = (async () => {
      let failure: DownloadError = "storage";
      try {
        if (!get().loaded) await get().load();
        if (loading) await loading;
        const previous = get().playlists.find((playlist) => playlist.id === id);
        let playlist: OfflinePlaylist = {
          id, title,
          tracks: [...new Map(tracks.map((track) => [track.id, track])).values()],
          downloadedIds: [], savedAt: Date.now(),
        };
        // Keep the original snapshot until it is explicitly removed; retry only missing files.
        if (previous) playlist = { ...previous, downloadedIds: [...previous.downloadedIds] };
        const publish = () => set((state) => ({
          playlists: [...state.playlists.filter((item) => item.id !== id), playlist],
        }));
        await linerDb.putOfflinePlaylist(playlist);
        publish();
        void navigator.storage?.persist?.().catch(() => false);
        const covers = new Map<string, string>();
        for (let index = 0; index < playlist.tracks.length; index++) {
          abort.signal.throwIfAborted();
          const track = playlist.tracks[index];
          const cached = await linerDb.getAudio(track.id);
          if (cached && playlist.downloadedIds.includes(track.id)) continue;
          let blob = cached?.blob;
          let mimeType = cached?.mimeType;
          if (!blob) {
            failure = "network";
            const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(120_000)]);
            const session = await api.createPlaybackSession(track.id, undefined, signal);
            let url: string;
            if (session.transport === "direct_innertube" && session.endpoint && session.headers && session.body) {
              const direct = await resolveDirectInnertubeStream({
                endpoint: session.endpoint, method: session.method,
                headers: session.headers, body: session.body,
              }, signal);
              url = direct.url;
              mimeType = direct.mimeType;
            } else if (session.streamUrl) {
              url = mediaUrl(session.streamUrl);
              mimeType = session.mimeType;
            } else {
              failure = "unavailable";
              throw new Error("No downloadable stream returned");
            }
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error("Download failed");
            blob = await response.blob();
            mimeType = mimeType || blob.type;
            failure = "unavailable";
            if (!blob.size || !mimeType?.startsWith("audio/")) throw new Error("Invalid audio");
            if (!isStandaloneAudioFile(new Uint8Array(await blob.slice(0, 16).arrayBuffer()))) {
              throw new Error("Audio requires a standalone file");
            }
            if (response.status === 206) {
              const range = response.headers.get("content-range")?.match(/^bytes 0-(\d+)\/(\d+)$/);
              if (!range || Number(range[1]) + 1 !== Number(range[2]) || blob.size !== Number(range[2])) {
                throw new Error("Incomplete audio");
              }
            }
          }
          const coverUrl = track.coverUrl;
          if (!covers.has(coverUrl)) {
            covers.set(coverUrl, await saveCover(coverUrl,
              AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)])));
          }
          abort.signal.throwIfAborted();
          playlist = {
            ...playlist,
            tracks: playlist.tracks.map((item, i) => i === index
              ? { ...item, coverUrl: covers.get(coverUrl) || "" } : item),
            downloadedIds: [...new Set([...playlist.downloadedIds, track.id])],
          };
          failure = "storage";
          await linerDb.saveOfflineTrack(playlist, track.id, blob, mimeType || blob.type);
          publish();
        }
      } catch {
        if (!abort.signal.aborted) set((state) => ({ errors: { ...state.errors, [id]: failure } }));
      } finally {
        controller = null;
        set({ activeId: null });
      }
    })();
    await running;
    running = null;
  },
  cancel: () => controller?.abort(),
  remove: async (id) => {
    if (get().activeId === id) {
      controller?.abort();
      await running;
    }
    try {
      await linerDb.removeOfflinePlaylist(id);
      set((state) => ({ playlists: state.playlists.filter((playlist) => playlist.id !== id) }));
    } catch {
      set((state) => ({ errors: { ...state.errors, [id]: "storage" } }));
    }
  },
}));
