import { useEffect } from "react";
import { useStableNavigate } from "@/shared/hooks/useStableNavigate";
import { useTranslation } from "@/languages";
import { useCachedTracksStore } from "../store/cachedTracksStore";
import CachedSongsCover from "./CachedSongsCover";

const INTER = { fontFamily: "var(--font-inter), sans-serif" };

export default function CachedSongsCard({
  viewMode = "grid",
}: {
  viewMode?: "grid" | "list";
}) {
  const { t } = useTranslation();
  const navigate = useStableNavigate();
  const count = useCachedTracksStore((state) => state.items.length);
  const loaded = useCachedTracksStore((state) => state.loaded);
  const load = useCachedTracksStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const open = () => navigate("/library/cached");
  const label = loaded ? t("common.songs", { count }) : null;

  if (viewMode === "list") {
    return (
      <div
        onClick={open}
        className="flex w-full cursor-pointer select-none items-center gap-[16px] rounded-md p-[8px] transition-colors duration-150 ease-out hover:bg-border-alpha-14"
      >
        <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-md">
          <CachedSongsCover />
        </div>
        <div className="flex min-w-0 flex-col gap-[2px]" style={INTER}>
          <h3 className="m-0 truncate text-[16px] leading-[1.2] font-[400] text-text-primary">
            {t("library.cached.title")}
          </h3>
          {label === null ? (
            <span className="h-[12px] w-[60px] animate-pulse rounded bg-border-alpha-14" />
          ) : (
            <p className="m-0 truncate text-[15px] leading-[1.2] font-[350] text-text-secondary">
              {label}
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
        <CachedSongsCover />
      </div>
      <div className="flex flex-col gap-[4px]">
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {t("library.cached.title")}
        </span>
        {label === null ? (
          <div className="h-[13px] w-[56%] animate-pulse rounded bg-border-alpha-14" />
        ) : (
          <span className="truncate text-[13px] text-text-tertiary">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
