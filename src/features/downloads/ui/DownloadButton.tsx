import { useEffect } from "react";
import { DownloadLine } from "@mingcute/react";
import Button from "@/shared/ui/Button";
import { useTranslation } from "@/languages";
import type { Track } from "@/shared/types";
import { useDownloadStore } from "../store/downloadStore";

export function DownloadButton({ id, title, tracks }: { id: string; title: string; tracks: Track[] }) {
  const { t } = useTranslation();
  const { playlists, activeId, errors, loaded, load, save, cancel } = useDownloadStore();
  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);
  const playlist = playlists.find((item) => item.id === id);
  const complete = playlist && playlist.downloadedIds.length === playlist.tracks.length;
  const active = activeId === id;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button variant="outline" size="sm"
        disabled={!loaded || !tracks.length || Boolean(activeId && !active) || Boolean(complete)}
        onClick={() => active ? cancel() : void save(id, title, tracks)}>
        <DownloadLine size={16} aria-hidden="true" />
        {active ? t("downloads.cancel") : complete ? t("downloads.saved")
          : t(playlist ? "downloads.retry" : "downloads.save")}
      </Button>
      {active && <span role="status" className="text-sm text-text-primary">
        {t("downloads.progress", { done: playlist?.downloadedIds.length ?? 0, total: playlist?.tracks.length ?? tracks.length })}
      </span>}
      {errors[id] && <span role="alert" className="text-sm text-text-primary">{t(`downloads.error_${errors[id]}`)}</span>}
      {errors.library && <span role="alert" className="text-sm text-text-primary">{t("downloads.error_storage")}</span>}
    </div>
  );
}
