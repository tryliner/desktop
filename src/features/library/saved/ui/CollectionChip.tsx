import { CloseLine, PlaylistFill } from "@mingcute/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/languages";
import { CoverImage } from "@/features/covers";
import type { PinnedCollection } from "../store/downloadsStore";
import { removeCollectionDownload } from "../hooks/useDownloads";

export function CollectionChip({
  collection,
  saved,
}: {
  collection: PinnedCollection;
  saved: Set<string>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const done = collection.tracks.filter((track) => saved.has(track.id)).length;
  const total = collection.tracks.length;
  const open = () => {
    const [kind, id] = collection.id.includes(":")
      ? collection.id.split(/:(.*)/s)
      : ["own", collection.id];
    if (kind === "own") {
      navigate(`/library/playlist?id=${encodeURIComponent(id)}`);
    } else {
      navigate(
        `/collection?type=${kind === "album" ? "album" : "playlist"}&id=${encodeURIComponent(id)}`,
      );
    }
  };
  return (
    <div className="group flex min-w-0 items-center gap-[10px] rounded-[10px] bg-fill p-[6px] pr-[8px]">
      <button
        type="button"
        onClick={open}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-[10px] border-none bg-transparent p-0 text-left"
      >
        <span className="relative flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-bg-elevated">
          {collection.coverUrl ? (
            <CoverImage
              src={collection.coverUrl}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <PlaylistFill size={18} className="text-text-tertiary" />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-label font-[500] text-text-primary">
            {collection.title}
          </span>
          <span className="truncate text-caption tabular-nums text-text-tertiary">
            {t("downloads.songs_downloaded", { done, total })}
          </span>
        </span>
      </button>
      <button
        type="button"
        title={t("downloads.remove")}
        aria-label={t("downloads.remove")}
        onClick={() =>
          removeCollectionDownload(collection.id, collection.title, t)
        }
        className="flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-tertiary opacity-0 transition-opacity hover:bg-fill-hover hover:text-text-primary group-hover:opacity-100 focus-visible:opacity-100"
      >
        <CloseLine size={15} />
      </button>
    </div>
  );
}
