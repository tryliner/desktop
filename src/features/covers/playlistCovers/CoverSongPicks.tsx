import { useTranslation } from "@/languages";
import CoverImage from "../ui/CoverImage";

interface CoverSongPicksProps {
  covers: string[];
  disabled: boolean;
  onPick: (url: string) => void;
}

export function CoverSongPicks({
  covers,
  disabled,
  onPick,
}: CoverSongPicksProps) {
  const { t } = useTranslation();
  if (covers.length === 0) return null;
  return (
    <div className="flex flex-col gap-[8px]">
      <span className="text-caption font-[500] uppercase tracking-[0.04em] text-text-tertiary">
        {t("playlist_cover.from_songs")}
      </span>
      <div className="grid grid-cols-6 gap-[6px]">
        {covers.map((url) => (
          <button
            key={url}
            type="button"
            disabled={disabled}
            aria-label={t("playlist_cover.use_song_cover")}
            onClick={() => onPick(url)}
            className="relative aspect-square cursor-pointer overflow-hidden rounded-[8px] border-none bg-bg-elevated p-0 transition-transform hover:scale-[1.04] disabled:opacity-50"
          >
            <CoverImage
              src={url}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
