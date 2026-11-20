import type { Track } from "@/shared/types";
import { linerDb } from "@/shared/storage";
import { isLocalTrackId, localTrackAudioUrl } from "@/shared/media/local";
import { savedAudioUrl, savedTrackRecord } from "@/shared/media/saved";
import { ANALYSIS_VERSION, type TrackAnalysis } from "./trackAnalysis";
import { analyzeAudioBlob } from "./decodeAnalysis";

const DB_NAME = "liner_analysis_v1";
const STORE = "tracks";
const memory = new Map<string, TrackAnalysis>();
const inflight = new Map<string, Promise<TrackAnalysis | null>>();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readStored(trackId: string): Promise<TrackAnalysis | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = db.transaction(STORE).objectStore(STORE).get(trackId);
    request.onsuccess = () => {
      db.close();
      const value = request.result as TrackAnalysis | undefined;
      resolve(value && value.version === ANALYSIS_VERSION ? value : null);
    };
    request.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

async function store(trackId: string, analysis: TrackAnalysis) {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(analysis, trackId);
  tx.oncomplete = () => db.close();
  tx.onerror = () => db.close();
}

async function localAudio(track: Track): Promise<Blob | null> {
  const cached = await linerDb.getAudio(track.id).catch(() => null);
  if (cached?.blob && cached.blob.size > 0) return cached.blob;
  const saved = savedTrackRecord(track.id);
  const url = isLocalTrackId(track.id)
    ? localTrackAudioUrl(track.id)
    : saved
      ? savedAudioUrl(saved)
      : null;
  if (!url) return null;
  try {
    const response = await fetch(url);
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
}

export function knownAnalysis(
  trackId: string | undefined,
): TrackAnalysis | null {
  return trackId ? (memory.get(trackId) ?? null) : null;
}

export function ensureAnalysis(track: Track): Promise<TrackAnalysis | null> {
  const known = memory.get(track.id);
  if (known) return Promise.resolve(known);
  const running = inflight.get(track.id);
  if (running) return running;
  const job = (async () => {
    const stored = await readStored(track.id);
    if (stored) {
      memory.set(track.id, stored);
      return stored;
    }
    const blob = await localAudio(track);
    if (!blob) return null;
    const analysis = await analyzeAudioBlob(blob);
    if (!analysis) return null;
    memory.set(track.id, analysis);
    void store(track.id, analysis);
    return analysis;
  })().finally(() => inflight.delete(track.id));
  inflight.set(track.id, job);
  return job;
}
