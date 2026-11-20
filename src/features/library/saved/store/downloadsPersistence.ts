import { getAuthSession } from "@/shared/api";
import {
  DOWNLOADS_KEY,
  type AccountDownloads,
  type PinnedTrack,
} from "./downloadsTypes";

export const EMPTY_DOWNLOADS: AccountDownloads = {
  tracks: {},
  collections: {},
};

export function accountKey(): string | null {
  return getAuthSession()?.user?.id ?? null;
}

export function toPinnedTrack(track: PinnedTrack): PinnedTrack {
  return {
    id: track.id,
    title: track.title,
    artists: track.artists,
    coverUrl: track.coverUrl,
    durationMs: track.durationMs,
    ...(track.explicit ? { explicit: true } : {}),
    ...(track.artistId ? { artistId: track.artistId } : {}),
  };
}

export function readPersisted(): Record<string, AccountDownloads> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(DOWNLOADS_KEY) ?? "{}",
    );
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, AccountDownloads> = {};
    for (const [account, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const raw = value as Partial<AccountDownloads>;
      out[account] = {
        tracks: raw.tracks && typeof raw.tracks === "object" ? raw.tracks : {},
        collections:
          raw.collections && typeof raw.collections === "object"
            ? raw.collections
            : {},
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function persist(byAccount: Record<string, AccountDownloads>) {
  try {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(byAccount));
  } catch {}
}
