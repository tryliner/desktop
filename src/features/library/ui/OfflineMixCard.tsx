import { useEffect, useMemo } from "react";
import { LuShuffle } from "react-icons/lu";
import allOfflineCover from "@/assets/all-offline-cover.svg";
import { playerEngine } from "@/features/player";
import { useTranslation } from "@/languages";
import { useCachedTracksStore } from "../cached";
import { useLocalTracks } from "../local/hooks/useLocalTracks";
import { useSavedTracks } from "../saved/hooks/useSavedTracks";
import { mergeOfflineTracks } from "../lib/offlineMix";

export default function OfflineMixCard() {
  const { t } = useTranslation();
  const { tracks: saved, isLoading: savedLoading } = useSavedTracks();
  const { tracks: local, isLoading: localLoading } = useLocalTracks();
  const cachedItems = useCachedTracksStore((state) => state.items);
  const cachedLoaded = useCachedTracksStore((state) => state.loaded);
  const loadCached = useCachedTracksStore((state) => state.load);

  useEffect(() => {
    void loadCached();
  }, [loadCached]);

  const tracks = useMemo(
    () =>
      mergeOfflineTracks(
        saved,
        cachedItems.map((item) => item.track),
        local,
      ),
    [saved, cachedItems, local],
  );
  const loading = savedLoading || localLoading || !cachedLoaded;
  const context = t("library.offline_mix.title");

  if (!loading && tracks.length === 0) return null;

  const playAll = () => {
    if (!tracks.length) return;
    playerEngine.clearQueue();
    void playerEngine.playTrack(tracks[0], tracks, context);
  };

  const shuffle = () => {
    if (!tracks.length) return;
    playerEngine.clearQueue();
    void playerEngine.playShuffled(tracks, context);
  };

  return (
    <div
      onClick={playAll}
      className="group flex cursor-pointer flex-col gap-[8px]"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md">
        <img
          src={allOfflineCover}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover"
        />
        <button
          type="button"
          aria-label={t("common.shuffle")}
          title={t("common.shuffle")}
          disabled={loading}
          onClick={(event) => {
            event.stopPropagation();
            shuffle();
          }}
          className="absolute right-[10px] bottom-[10px] flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-full border-0 bg-white text-black transition-transform duration-150 ease-out hover:scale-[1.06] active:scale-[0.96] disabled:cursor-default disabled:opacity-60"
        >
          <LuShuffle size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-[4px]">
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {context}
        </span>
        {loading ? (
          <div className="h-[13px] w-[56%] animate-pulse rounded bg-border-alpha-14" />
        ) : (
          <span className="truncate text-[13px] text-text-tertiary">
            {t("common.songs", { count: tracks.length })}
          </span>
        )}
      </div>
    </div>
  );
}
