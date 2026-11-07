import { useStableNavigate } from "@/shared/hooks/useStableNavigate";
import { useTranslation } from "@/languages";
import { useSavedTracks } from "../hooks/useSavedTracks";
import { LuDownload } from "react-icons/lu";

interface SavedTracksCardProps {
  viewMode?: "grid" | "list";
}

export default function SavedTracksCard({
  viewMode = "grid",
}: SavedTracksCardProps) {
  const { t } = useTranslation();
  const navigate = useStableNavigate();
  const { tracks, isLoading } = useSavedTracks();

  if (tracks.length === 0 && !isLoading) return null;

  const open = () => navigate("/library/saved");
  const count = isLoading ? null : t("common.songs", { count: tracks.length });
  const title = t("settings.device.downloads_title") || "Downloads";

  if (viewMode === "list") {
    return (
      <div
        onClick={open}
        className="flex w-full cursor-pointer select-none items-center gap-[16px] rounded-control p-[8px] transition-colors duration-150 ease-out hover:bg-border-alpha-14"
      >
        <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-control bg-gradient-to-br from-emerald-500/30 to-teal-700/40 flex items-center justify-center border border-emerald-500/20">
          <LuDownload size={22} className="text-emerald-400" />
        </div>
        <div className="flex min-w-0 flex-col gap-[2px]">
          <h3 className="m-0 truncate text-[16px] leading-[1.2] font-[400] text-text-primary">
            {title}
          </h3>
          {count === null ? (
            <span className="h-[12px] w-[60px] animate-pulse rounded bg-border-alpha-14" />
          ) : (
            <p className="m-0 truncate text-title leading-[1.2] font-[350] text-text-secondary">
              {count}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={open}
      className="group flex cursor-pointer flex-col gap-[8px]"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-control bg-gradient-to-br from-emerald-500/20 via-teal-900/40 to-black/60 flex items-center justify-center border border-emerald-500/20 group-hover:border-emerald-500/40 transition-colors">
        <LuDownload
          size={38}
          className="text-emerald-400/90 group-hover:scale-105 transition-transform"
        />
      </div>
      <div className="flex flex-col gap-[4px]">
        <span className="truncate text-label font-[500] text-text-primary">
          {title}
        </span>
        {count === null ? (
          <div className="h-[13px] w-[56%] animate-pulse rounded bg-border-alpha-14" />
        ) : (
          <span className="truncate text-caption font-[350] text-text-secondary">
            {count}
          </span>
        )}
      </div>
    </div>
  );
}
