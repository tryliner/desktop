import { api, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";
import {
  accountKey,
  currentDownloads,
  pinnedTrackList,
  useDownloadsStore,
} from "./downloadsStore";

interface WatcherDeps {
  setPinned: (tracks: Track[]) => void;
  canDownload: () => boolean;
}

let deps: WatcherDeps = {
  setPinned: () => undefined,
  canDownload: () => false,
};

let lastPinned = "";
function pushPinned() {
  const list = pinnedTrackList(currentDownloads());
  const signature = list.map((track) => track.id).join("|");
  if (signature === lastPinned) return;
  lastPinned = signature;
  deps.setPinned(list);
}

let followTimer: ReturnType<typeof setTimeout> | null = null;
function followPinnedPlaylists(delay = 2_000) {
  if (followTimer) clearTimeout(followTimer);
  followTimer = setTimeout(async () => {
    followTimer = null;
    if (!deps.canDownload()) return;
    const playlists = Object.values(currentDownloads().collections).filter(
      (collection) =>
        collection.kind === "playlist" && !collection.id.includes(":"),
    );
    const account = accountKey();
    for (const playlist of playlists) {
      try {
        const detail = await api.getUserPlaylist(playlist.id);
        if (accountKey() !== account) return;
        useDownloadsStore.getState().updateCollectionTracks(
          playlist.id,
          detail.items.map((item) => toClientTrack(item.track)),
        );
      } catch {}
    }
  }, delay);
}

export function watchPinnedDownloads(next: WatcherDeps) {
  deps = next;
  pushPinned();
  useDownloadsStore.subscribe((state, prev) => {
    if (state.byAccount !== prev.byAccount) pushPinned();
  });
  window.addEventListener("auth:changed", () => {
    lastPinned = "";
    pushPinned();
  });
  window.addEventListener("library:changed", () => followPinnedPlaylists());
  followPinnedPlaylists(10_000);
}
