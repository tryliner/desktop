import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import type { TrackDetail } from "../../../store/modalStore";

const STACK_DEPTH = [
  "",
  "translate-x-[3px] -translate-y-[3px] scale-[0.92] opacity-75",
  "translate-x-[6px] -translate-y-[6px] scale-[0.84] opacity-50",
];

interface PickerSelectionHeaderProps {
  tracks: TrackDetail[];
}

function CoverStack({ covers }: { covers: string[] }) {
  return (
    <>
      {covers
        .map((url, depth) => ({ url, depth }))
        .reverse()
        .map(({ url, depth }) => (
          <div
            key={`${url}-${depth}`}
            className={cn(
              "absolute inset-0 overflow-hidden rounded-control bg-bg-elevated shadow-sm",
              STACK_DEPTH[depth],
            )}
          >
            <CoverImage
              src={url}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
        ))}
    </>
  );
}

function SingleCover({ track }: { track: TrackDetail }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-control bg-bg-elevated">
      {track.coverUrl ? (
        <CoverImage
          src={track.coverUrl}
          alt={track.title}
          fill
          sizes="40px"
          className="object-cover"
        />
      ) : (
        <span className="text-title font-[600] text-text-tertiary">
          {track.title.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function PickerSelectionHeader({ tracks }: PickerSelectionHeaderProps) {
  const { t } = useTranslation();
  const first = tracks[0];
  if (!first) return null;
  const many = tracks.length > 1;
  const covers = tracks
    .map((track) => track.coverUrl)
    .filter(Boolean)
    .slice(0, STACK_DEPTH.length);
  const titles =
    tracks
      .slice(0, 3)
      .map((track) => track.title)
      .join(", ") + (tracks.length > 3 ? "…" : "");
  return (
    <div className="mt-[10px] flex items-center gap-[10px] rounded-control bg-bg-elevated/60 px-[10px] py-[8px]">
      <div className="relative h-[40px] w-[40px] shrink-0">
        {many && covers.length > 1 ? (
          <CoverStack covers={covers} />
        ) : (
          <SingleCover track={first} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span className="truncate text-body font-[500] text-text-primary">
          {many
            ? t("playlist_picker.count", { count: tracks.length })
            : first.title}
        </span>
        <span className="truncate text-caption text-text-tertiary">
          {many ? titles : first.artists}
        </span>
      </div>
    </div>
  );
}
