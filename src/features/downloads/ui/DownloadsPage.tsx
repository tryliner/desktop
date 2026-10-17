import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@/shared/ui/Button";
import { playerEngine } from "@/features/player";
import { useTranslation } from "@/languages";
import { useDownloadStore } from "../store/downloadStore";

export default function DownloadsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playlists, loaded, activeId, errors, load, save, cancel, remove } = useDownloadStore();
  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);
  return (
    <main className="h-full overflow-y-auto px-4 pb-28 pt-5 sm:px-8">
      <div className="mb-6 flex flex-col items-start gap-4">
        <h1 className="m-0 text-[26px] font-bold text-text-primary">{t("downloads.title")}</h1>
        <Button variant="outline" size="sm" onClick={() => navigate("/library")}>{t("library.title")}</Button>
      </div>
      <p className="text-sm text-text-primary">{t("downloads.description")}</p>
      {!loaded && <p role="status" className="text-text-primary">{t("downloads.loading")}</p>}
      {errors.library && <div role="alert" className="my-4 text-text-primary">
        <p>{t("downloads.error_storage")}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>{t("downloads.retry")}</Button>
      </div>}
      {loaded && !errors.library && !playlists.length && <p className="py-8 text-text-primary">{t("downloads.empty")}</p>}
      <ul className="m-0 list-none p-0">
        {playlists.map((playlist) => {
          const tracks = playlist.tracks.filter((track) => playlist.downloadedIds.includes(track.id));
          const active = activeId === playlist.id;
          const complete = tracks.length === playlist.tracks.length;
          const play = (index: number) => void playerEngine.playTrack(
            tracks[index], tracks, `offline:${playlist.id}`, tracks[index].coverUrl,
          );
          return (
            <li key={playlist.id} className="border-b border-border-alpha-14 py-5">
              <h2 className="m-0 break-words text-lg font-semibold text-text-primary">{playlist.title}</h2>
              <p role="status" aria-live="polite" className="my-2 text-sm text-text-primary">
                {t(active ? "downloads.progress" : complete ? "downloads.complete" : "downloads.partial", {
                  done: tracks.length, total: playlist.tracks.length,
                })}
              </p>
              {active && <progress value={tracks.length} max={playlist.tracks.length}
                aria-label={t("downloads.progress", { done: tracks.length, total: playlist.tracks.length })}
                className="mb-3 h-2 w-full accent-current text-text-primary" />}
              {errors[playlist.id] && <p role="alert" className="text-sm text-text-primary">{t(`downloads.error_${errors[playlist.id]}`)}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!tracks.length} onClick={() => play(0)}>{t("common.play_all")}</Button>
                {active ? <Button variant="outline" size="sm" onClick={cancel}>{t("downloads.cancel")}</Button>
                  : !complete && <Button variant="outline" size="sm" disabled={Boolean(activeId)}
                    onClick={() => void save(playlist.id, playlist.title, playlist.tracks)}>{t("downloads.retry")}</Button>}
                <Button variant="outline" size="sm" onClick={() => void remove(playlist.id)}>{t("downloads.remove")}</Button>
              </div>
              {tracks.length > 0 && <details className="mt-4 text-text-primary">
                <summary className="cursor-pointer rounded-md py-2 focus-visible:outline focus-visible:outline-2">{t("downloads.show_tracks")}</summary>
                <ol className="m-0 list-none p-0">
                  {tracks.map((track, index) => <li key={track.id}>
                    <button type="button" onClick={() => play(index)}
                      className="flex w-full items-center gap-3 rounded-md border-0 bg-transparent p-2 text-left text-text-primary hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2">
                      {track.coverUrl && <img src={track.coverUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
                      <span className="min-w-0"><span className="block truncate font-medium">{track.title}</span>
                        <span className="block truncate text-sm">{track.artists}</span></span>
                    </button>
                  </li>)}
                </ol>
              </details>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
