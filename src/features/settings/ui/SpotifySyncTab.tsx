import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/shared/api";
import { importSpotify } from "@/features/library/services/import/sources/spotify/spotifySource";
import { evaluateImportedTrack } from "@/shared/media/matching";
import type { Track } from "@/shared/contracts";

const STORAGE_KEY = "liner.spotify-playlist-sync.v1";
const INTERVAL_MS = 15 * 60 * 1000;

type SyncConfig = { sourceUrl: string; targetPlaylistId: string; enabled: boolean };
const emptyConfig: SyncConfig = { sourceUrl: "", targetPlaylistId: "", enabled: false };

function readConfig(): SyncConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? { ...emptyConfig, ...parsed } : emptyConfig;
  } catch { return emptyConfig; }
}

export async function syncSpotifyPlaylist(sourceUrl: string, targetPlaylistId: string) {
  const imported = await importSpotify(sourceUrl);
  const current = await api.getUserPlaylist(targetPlaylistId);
  const existingIds = new Set(current.items.map((item) => item.track?.id).filter(Boolean));
  const candidates: Track[] = [];
  for (const source of imported.tracks) {
    const query = [source.title, source.artists?.map((artist) => artist.name).join(" ")].filter(Boolean).join(" ");
    if (!query.trim()) continue;
    const response = await api.search(query, "track");
    const result = response as unknown as { items?: Track[]; tracks?: Track[] };
    const matches = result.items ?? result.tracks ?? [];
    const decision = evaluateImportedTrack(source, matches);
    if ("track" in decision && decision.track?.id && !existingIds.has(decision.track.id)) {
      existingIds.add(decision.track.id);
      candidates.push(decision.track);
    }
  }
  if (!candidates.length) return { added: 0, total: imported.tracks.length };
  const result = await api.addPlaylistTrackSnapshots(targetPlaylistId, candidates);
  return { added: result.added, total: imported.tracks.length };
}

export default function SpotifySyncTab() {
  const [config, setConfig] = useState<SyncConfig>(readConfig);
  const [playlists, setPlaylists] = useState<Array<{ id: string; title: string }>>([]);
  const [status, setStatus] = useState("Not configured");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    api.listPlaylists().then(({ items }) => setPlaylists(items.map((p) => ({ id: p.id, title: p.title })))).catch(() => setStatus("Could not load playlists. Sign in and try again."));
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }, [config]);

  const runSync = useCallback(async () => {
    if (running.current || !config.sourceUrl.trim() || !config.targetPlaylistId) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await syncSpotifyPlaylist(config.sourceUrl.trim(), config.targetPlaylistId);
      setStatus(`Synced: ${result.added} new tracks added (Spotify playlist: ${result.total} tracks checked).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed. Check the playlist link and try again.");
    } finally { running.current = false; setBusy(false); }
  }, [config.sourceUrl, config.targetPlaylistId]);

  useEffect(() => {
    if (!config.enabled || !config.sourceUrl.trim() || !config.targetPlaylistId) return;
    void runSync();
    const timer = window.setInterval(() => void runSync(), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [config.enabled, config.sourceUrl, config.targetPlaylistId, runSync]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-semibold">Spotify playlist auto-sync</h3>
        <p className="mt-1 text-sm text-text-secondary">Append new Spotify tracks to an existing Liner playlist every 15 minutes while Liner is open. Existing tracks and their order are kept.</p>
      </div>
      <label className="flex flex-col gap-2 text-sm">
        Spotify playlist URL
        <input value={config.sourceUrl} onChange={(e) => setConfig((v) => ({ ...v, sourceUrl: e.target.value }))} placeholder="https://open.spotify.com/playlist/..." className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Existing Liner playlist
        <select value={config.targetPlaylistId} onChange={(e) => setConfig((v) => ({ ...v, targetPlaylistId: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2">
          <option value="">Choose a playlist…</option>
          {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig((v) => ({ ...v, enabled: e.target.checked }))} />
        Enable automatic sync
      </label>
      <button type="button" disabled={busy || !config.sourceUrl.trim() || !config.targetPlaylistId} onClick={() => void runSync()} className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Syncing…" : "Sync now"}
      </button>
      <p className="text-xs text-text-secondary" role="status">{status}</p>
      <p className="text-xs text-text-tertiary">Only public Spotify playlists are supported by Liner’s current importer. Sync pauses when the app is closed.</p>
    </div>
  );
}
