import { api, ApiError, getAuthSession } from "@/shared/api";
import type { LyricsCandidate } from "@/shared/contracts/lyrics";
import { audioCache, linerDb } from "@/shared/storage";
import { isStandaloneAudioFile } from "@/shared/storage/audioFormat";
import type {
  SavedLyricsState,
  SavedTrackInput,
  SavedTrackRecord,
} from "@/shared/media/saved";
import { trackToSavedMeta } from "@/shared/media/saved";
import { downloadAudioBytes, STREAMS_REFUSED_MESSAGE } from "@/shared/youtube";
import type { Track } from "@/shared/types";
import { isBetterLyricsCandidate, lyricsCache } from "@/features/lyrics";
import { resolvePlaybackStream } from "@/features/player/engine/streamResolver";
import type { FailureKind, SavedAudioSource } from "./savedTrackSync";

const COVER_TIMEOUT_MS = 15_000;
const LYRICS_TIMEOUT_MS = 30_000;

interface FetchedAudio {
  audio: Uint8Array;
  mimeType: string;
  source: SavedAudioSource;
}

export class LyricsRateLimited extends Error {}

function assertAudio(bytes: Uint8Array) {
  if (!isStandaloneAudioFile(bytes.subarray(0, 16)))
    throw new Error("stream is not a standalone audio file");
}

async function fromAudioCache(trackId: string): Promise<FetchedAudio | null> {
  const cached = await linerDb.getAudio(trackId).catch(() => null);
  if (!cached?.blob || cached.blob.size === 0) return null;
  const audio = new Uint8Array(await cached.blob.arrayBuffer());
  if (!isStandaloneAudioFile(audio.subarray(0, 16))) return null;
  return {
    audio,
    mimeType: cached.blob.type || cached.mimeType || "audio/webm",
    source: "cache",
  };
}

async function fromNetwork(
  track: Track,
  signal: AbortSignal,
): Promise<FetchedAudio> {
  const stream = await resolvePlaybackStream(track, signal);
  try {
    let audio: Uint8Array | null;
    if (stream.blob) audio = new Uint8Array(await stream.blob.arrayBuffer());
    else if (stream.completed)
      audio = new Uint8Array(await (await stream.completed).arrayBuffer());
    else
      audio = await downloadAudioBytes(stream.url, {
        contentLength: stream.contentLength,
        signal,
      });
    if (!audio) throw new Error("download came back empty");
    assertAudio(audio);
    return {
      audio,
      mimeType: stream.mimeType || stream.blob?.type || "audio/webm",
      source: stream.fromLiner ? "liner" : "network",
    };
  } finally {
    stream.release?.();
  }
}

async function fetchCover(
  coverUrl: string | undefined,
): Promise<SavedTrackInput["cover"]> {
  if (!coverUrl || !/^https?:\/\//.test(coverUrl)) return undefined;
  try {
    const res = await fetch(coverUrl, {
      signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const mimeType = res.headers.get("content-type") ?? "";
    if (!mimeType.startsWith("image/")) return undefined;
    return { data: new Uint8Array(await res.arrayBuffer()), mimeType };
  } catch {
    return undefined;
  }
}

function lyricsHint(track: Pick<Track, "title" | "artists" | "durationMs">) {
  return {
    title: track.title,
    artist: (track.artists.split(",")[0] ?? "").trim(),
    durationMs: track.durationMs,
  };
}

async function knownLyrics(trackId: string): Promise<LyricsCandidate | null> {
  const memory = lyricsCache.get(trackId)?.candidate;
  if (memory) return memory;
  return (
    (await linerDb.getLyrics(trackId).catch(() => null))?.candidate ?? null
  );
}

export async function findLyrics(
  track: Pick<Track, "id" | "title" | "artists" | "durationMs">,
): Promise<{ state: SavedLyricsState; candidate?: LyricsCandidate } | null> {
  const known = await knownLyrics(track.id);
  if (known) return { state: "found", candidate: known };
  if (!getAuthSession()?.accessToken) return null;
  let best: LyricsCandidate | null = null;
  try {
    for await (const event of api.streamLyrics(
      track.id,
      AbortSignal.timeout(LYRICS_TIMEOUT_MS),
      lyricsHint(track),
    )) {
      if (event.type !== "provider" || event.status !== "found") continue;
      if (!best || isBetterLyricsCandidate(event.candidate, best))
        best = event.candidate;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 429)
      throw new LyricsRateLimited("lyrics rate limited");
    if (best) return { state: "found", candidate: best };
    return null;
  }
  return best ? { state: "found", candidate: best } : { state: "missing" };
}

export async function saveTrackToDevice(
  track: Track,
  signal: AbortSignal,
): Promise<{ record: SavedTrackRecord; source: SavedAudioSource } | null> {
  const bridge = window.linerElectron;
  if (!bridge) return null;
  const fetched =
    (await fromAudioCache(track.id)) ?? (await fromNetwork(track, signal));
  const [cover, lyrics] = await Promise.all([
    fetchCover(track.coverUrl),
    findLyrics(track).catch(() => null),
  ]);
  const record = await bridge.savedTracksSave({
    meta: trackToSavedMeta(track),
    audio: fetched.audio,
    mimeType: fetched.mimeType,
    ...(cover ? { cover } : {}),
    ...(lyrics?.state === "found" && lyrics.candidate
      ? { lyricsState: "found" as const, lyrics: lyrics.candidate }
      : lyrics?.state === "missing"
        ? { lyricsState: "missing" as const }
        : {}),
  });
  if (!record) return null;
  if (fetched.source === "cache") await audioCache.deleteAudio(track.id);
  return { record, source: fetched.source };
}

export async function saveLyricsToDevice(
  record: SavedTrackRecord,
): Promise<SavedLyricsState | "later"> {
  const bridge = window.linerElectron;
  if (!bridge) return "later";
  const found = await findLyrics({
    id: record.trackId,
    title: record.title,
    artists: record.artists,
    durationMs: record.durationMs,
  }).catch(() => null);
  if (!found) return "later";
  const stored = await bridge.savedTracksSetLyrics(
    record.trackId,
    found.state,
    found.candidate,
  );
  return stored ? found.state : "later";
}

export function classifySaveFailure(error: unknown): FailureKind {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { kind: "offline" };
  if (error instanceof ApiError && error.status === 429)
    return { kind: "rate_limited" };
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: unknown } | null)?.status;
  if (
    message.startsWith(STREAMS_REFUSED_MESSAGE) ||
    /confirm you.?re not a bot|sign in to confirm/i.test(message)
  )
    return { kind: "blocked" };
  if (status === 429) return { kind: "rate_limited" };
  return { kind: "failed", reason: message.slice(0, 160) };
}
