import { useMemo, useState } from "react";
import { FolderOpenLine, Refresh1Line, PlayFill } from "@mingcute/react";
import { playerEngine, usePlayerStore } from "@/features/player";
import { useLocalLibraryStore } from "../store/localLibraryStore";
import type { Track } from "@/shared/types";

function formatDuration(ms: number): string {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function LocalPage() {
  const { folder, tracks, scanning, progress, error, chooseFolder, rescan } = useLocalLibraryStore();
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter((t) => `${t.title} ${t.artists} ${t.album?.title ?? ""}`.toLowerCase().includes(q));
  }, [tracks, query]);

  const play = (track: Track) => {
    void playerEngine.playTrack(track, visible, "Local Files", track.coverUrl || null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-8 pb-32 pt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 mr-auto text-[28px] font-medium text-text-primary">Local Files</h1>
        {tracks.length > 0 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-9 w-56 rounded-lg border border-border-alpha-14 bg-transparent px-3 text-[14px] text-text-primary outline-none"
          />
        )}
        {folder && (
          <button
            type="button"
            onClick={() => void rescan()}
            disabled={scanning}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-alpha-14 bg-transparent px-3 text-[14px] text-text-primary disabled:opacity-50"
          >
            <Refresh1Line size={16} /> Rescan
          </button>
        )}
        <button
          type="button"
          onClick={() => void chooseFolder()}
          disabled={scanning}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-alpha-14 bg-transparent px-3 text-[14px] text-text-primary disabled:opacity-50"
        >
          <FolderOpenLine size={16} /> {folder ? "Change folder" : "Choose music folder"}
        </button>
      </div>

      {folder && <p className="m-0 truncate text-[13px] text-text-secondary">{folder}</p>}
      {scanning && (
        <p className="m-0 text-[14px] text-text-secondary">
          Scanning… {progress ? `${progress.done} / ${progress.total}` : ""}
        </p>
      )}
      {error && <p className="m-0 text-[14px] text-red-400">{error}</p>}
      {!folder && !scanning && (
        <p className="m-0 text-[15px] text-text-secondary">
          Pick the folder where your music is stored. Subfolders are scanned too (mp3, flac, m4a, ogg, opus, wav, aac).
        </p>
      )}
      {folder && !scanning && tracks.length === 0 && !error && (
        <p className="m-0 text-[15px] text-text-secondary">No audio files found in this folder.</p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((track) => {
          const active = track.id === currentId;
          return (
            <div
              key={track.id}
              onDoubleClick={() => play(track)}
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-[6px] hover:bg-border-alpha-14"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-bg-panel">
                {track.coverUrl && (
                  <img src={track.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  aria-label="Play"
                  onClick={() => play(track)}
                  className="absolute inset-0 hidden cursor-pointer items-center justify-center border-0 bg-black/50 text-white group-hover:flex"
                >
                  <PlayFill size={18} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[15px] ${active ? "text-accent" : "text-text-primary"}`}>{track.title}</div>
                <div className="truncate text-[13px] text-text-secondary">
                  {track.artists}
                  {track.album?.title ? ` · ${track.album.title}` : ""}
                </div>
              </div>
              <span className="shrink-0 text-[13px] text-text-secondary">{formatDuration(track.durationMs)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
