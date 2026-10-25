import type {
  ImportResult,
  ImportReview,
  ImportSource,
  Track,
} from "@/shared/contracts";
import { videoThumbnailCover } from "@/shared/youtube";
import {
  parseImportSource,
  type ClientImportedPlaylist,
  type ClientImportedTrack,
} from "../index";
import { findCatalogMatch } from "@/shared/media/matching";

const SEARCH_CONCURRENCY = 4;
const PROGRESS_THROTTLE_MS = 120;

export type ImportPhase = "loading_source" | "matching" | "saving";

export interface ImportProgress {
  phase: ImportPhase;
  title?: string;
  description?: string;
  result: ImportResult;
}

export interface ClientImportOutcome {
  source: ImportSource;
  title: string;
  description?: string;
  approvedTracks: Track[];
  reviewItems: ImportReview[];
  result: ImportResult;
}

export interface RunImportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ImportProgress) => void;
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function canonicalTrack(
  source: ImportSource,
  track: ClientImportedTrack,
): Track {
  const id =
    source === "soundcloud" && !track.sourceId.startsWith("sc:")
      ? `sc:${track.sourceId}`
      : track.sourceId;
  return {
    id,
    title: track.title,
    artists: track.artists.map((name, index) => ({
      id: track.artistIds?.[index] ?? "unknown",
      name,
    })),
    ...(track.album
      ? {
          album: {
            id: track.albumId || `sc_rel_${track.sourceId}`,
            title: track.album,
          },
        }
      : {}),
    durationMs: track.durationMs ?? 0,
    ...(track.coverUrl
      ? { cover: { url: track.coverUrl, width: 480, height: 360 } }
      : source === "soundcloud"
        ? {}
        : { cover: videoThumbnailCover(track.sourceId) }),
  };
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

function reviewItem(
  sourceTrack: ClientImportedTrack,
  position: number,
  outcome: Awaited<ReturnType<typeof findCatalogMatch>>,
): ImportReview | null {
  if (outcome.status !== "pending" || !outcome.proposedTrack) return null;
  return {
    id: newId(),
    sourceTrack,
    proposedTrack: outcome.proposedTrack,
    ...(outcome.score !== undefined ? { score: outcome.score } : {}),
    reason: outcome.reason,
    status: "pending",
    position,
    createdAt: new Date().toISOString(),
  };
}

async function matchPlaylist(
  playlist: ClientImportedPlaylist,
  options: RunImportOptions,
): Promise<ClientImportOutcome> {
  const total = playlist.tracks.length;
  const result: ImportResult = { total, imported: 0, skipped: 0 };
  const header = { title: playlist.title, description: playlist.description };
  let lastEmit = 0;
  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < PROGRESS_THROTTLE_MS) return;
    lastEmit = now;
    options.onProgress?.({
      phase: "matching",
      ...header,
      result: { ...result },
    });
  };

  const outcomes = await mapConcurrent(
    playlist.tracks,
    SEARCH_CONCURRENCY,
    async (track) => {
      const outcome = await findCatalogMatch(track, options.signal).catch(
        (error: unknown) => {
          if (options.signal?.aborted) throw error;
          return {
            status: "pending" as const,
            reason: "catalog_lookup_failed" as const,
          };
        },
      );
      if (outcome.status === "approved") result.imported += 1;
      else result.skipped += 1;
      emit(result.imported + result.skipped === total);
      return outcome;
    },
  );

  const approvedTracks = outcomes.flatMap((outcome) =>
    outcome.status === "approved" ? [outcome.track] : [],
  );
  const reviewItems = outcomes
    .map((outcome, index) => reviewItem(playlist.tracks[index], index, outcome))
    .filter((item): item is ImportReview => Boolean(item));
  return {
    source: playlist.source,
    ...header,
    approvedTracks,
    reviewItems,
    result,
  };
}

export async function runClientImport(
  url: string,
  options: RunImportOptions = {},
): Promise<ClientImportOutcome> {
  options.onProgress?.({
    phase: "loading_source",
    result: { total: 0, imported: 0, skipped: 0 },
  });
  const playlist = await parseImportSource(url, options.signal);
  if (playlist.tracks.length === 0) {
    throw new Error(
      "No tracks found in the imported playlist. Make sure the playlist is public and contains available tracks.",
    );
  }
  if (playlist.canonicalTrackIds) {
    const total = playlist.tracks.length;
    return {
      source: playlist.source,
      title: playlist.title,
      description: playlist.description,
      approvedTracks: playlist.tracks.map((track) =>
        canonicalTrack(playlist.source, track),
      ),
      reviewItems: [],
      result: { total, imported: total, skipped: 0 },
    };
  }
  options.onProgress?.({
    phase: "matching",
    title: playlist.title,
    description: playlist.description,
    result: { total: playlist.tracks.length, imported: 0, skipped: 0 },
  });
  return matchPlaylist(playlist, options);
}
