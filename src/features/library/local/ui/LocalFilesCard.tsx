import { useStableNavigate } from "@/shared/hooks/useStableNavigate";
import { useTranslation } from "@/languages";
import { useLocalTracks } from "../hooks/useLocalTracks";
import LocalFilesCover from "./LocalFilesCover";

interface LocalFilesCardProps {
  viewMode?: "grid" | "list";
}

export default function LocalFilesCard({
  viewMode = "grid",
}: LocalFilesCardProps) {
  const { t } = useTranslation();
  const navigate = useStableNavigate();
  const { tracks, isLoading, isAvailable } = useLocalTracks();

  if (!isAvailable) return null;

  const open = () => navigate("/library/local");
  const count = isLoading ? null : t("common.songs", { count: tracks.length });

  if (viewMode === "list") {
    return (
      <div
        onClick={open}
        className="flex w-full cursor-pointer select-none items-center gap-[16px] rounded-md p-[8px] transition-colors duration-150 ease-out hover:bg-border-alpha-14"
      >
        <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-md">
          <LocalFilesCover />
        </div>
        <div className="flex min-w-0 flex-col gap-[2px]">
          <h3 className="m-0 truncate text-[16px] leading-[1.2] font-[400] text-text-primary">
            {t("library.local.title")}
          </h3>
          {count === null ? (
            <span className="h-[12px] w-[60px] animate-pulse rounded bg-border-alpha-14" />
          ) : (
            <p className="m-0 truncate text-[15px] leading-[1.2] font-[350] text-text-secondary">
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
      <div className="relative aspect-square w-full overflow-hidden rounded-md">
        <LocalFilesCover />
      </div>
      <div className="flex flex-col gap-[4px]">
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {t("library.local.title")}
        </span>
        {count === null ? (
          <div className="h-[13px] w-[56%] animate-pulse rounded bg-border-alpha-14" />
        ) : (
          <span className="truncate text-[13px] text-text-tertiary">
            {count}
          </span>
        )}
      </div>
    </div>
  );
}
