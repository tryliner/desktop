import { memo, useEffect, useMemo, useState } from "react";
import { FolderOpenLine, Refresh1Line, PlayFill } from "@mingcute/react";
import { playerEngine, usePlayerStore } from "@/features/player";
import { useTranslation } from "@/languages";
import { useLocalLibraryStore } from "../store/localLibraryStore";
import type { Track } from "@/shared/types";

function formatDuration(ms: number): string {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const buttonClass =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-alpha-14 bg-transparent px-3 text-[14px] text-text-primary disabled:opacity-50";

/** Subscribes to scan progress on its own so the (large) track list is not re-rendered on every update. */
function ScanStatus() {
  const { t } = useTranslation();
  const scanning = useLocalLibraryStore((s) => s.scanning);
  const progress = useLocalLibraryStore((s) => s.progress);
  const error = useLocalLibraryStore((s) => s.error);
  return (
    <>
      {scanning && (
        <p className="m-0 text-[14px] text-text-secondary">
          {progress ? t("local.scanning_progress", { done: progress.done, total: progress.total }) : t("local.scanning")}
        </p>
      )}
      {error && <p className="m-0 text-[14px] text-red-400">{t(`local.error_${error}`)}</p>}
    </>
  );
}

interface TrackListProps {
  tracks: Track[];
  currentId: string | undefined;
  onPlay: (track: Track) => void;
}

const TrackList = memo(function TrackList({ tracks, currentId, onPlay }: TrackListProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {tracks.map((track) => {
        const active = track.id === currentId;
        return (
          <div
            key={track.id}
            onDoubleClick={() => onPlay(track)}
            className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-[6px] hover:bg-border-alpha-14"
            // skip layout/paint work for rows that are scrolled out of view
            style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
          >
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-bg-panel">
              {track.coverUrl && <img src={track.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
              <button
                type="button"
                aria-label={t("local.play")}
                onClick={() => onPlay(track)}
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
  );
});

export default function LocalPage() {
  const { t } = useTranslation();
  const folder = useLocalLibraryStore((s) => s.folder);
  const tracks = useLocalLibraryStore((s) => s.tracks);
  const scanning = useLocalLibraryStore((s) => s.scanning);
  const loaded = useLocalLibraryStore((s) => s.loaded);
  const chooseFolder = useLocalLibraryStore((s) => s.chooseFolder);
  const rescan = useLocalLibraryStore((s) => s.rescan);
  const load = useLocalLibraryStore((s) => s.load);
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter((track) => `${track.title} ${track.artists} ${track.album?.title ?? ""}`.toLowerCase().includes(q));
  }, [tracks, query]);

  const onPlay = useMemo(
    () => (track: Track) => {
      void playerEngine.playTrack(track, visible, t("local.title"), track.coverUrl || null);
    },
    [visible, t],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-8 pb-32 pt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 mr-auto text-[28px] font-medium text-text-primary">{t("local.title")}</h1>
        {tracks.length > 0 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("local.search")}
            className="h-9 w-56 rounded-lg border border-border-alpha-14 bg-transparent px-3 text-[14px] text-text-primary outline-none"
          />
        )}
        {folder && (
          <button type="button" onClick={() => void rescan()} disabled={scanning} className={buttonClass}>
            <Refresh1Line size={16} /> {t("local.rescan")}
          </button>
        )}
        <button type="button" onClick={() => void chooseFolder()} disabled={scanning} className={buttonClass}>
          <FolderOpenLine size={16} /> {folder ? t("local.change_folder") : t("local.choose_folder")}
        </button>
      </div>

      {folder && <p className="m-0 truncate text-[13px] text-text-secondary">{folder}</p>}
      <ScanStatus />
      {loaded && !folder && !scanning && <p className="m-0 text-[15px] text-text-secondary">{t("local.pick_hint")}</p>}
      {folder && !scanning && tracks.length === 0 && <p className="m-0 text-[15px] text-text-secondary">{t("local.no_files")}</p>}

      <TrackList tracks={visible} currentId={currentId} onPlay={onPlay} />
    </div>
  );
}
