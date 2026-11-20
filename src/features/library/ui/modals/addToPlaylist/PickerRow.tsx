import { PlaylistFill, CheckLine } from "@mingcute/react";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import type { PickerPlaylist } from "./usePickerRows";

interface PickerRowProps {
  playlist: PickerPlaylist;
  present: number | undefined;
  trackCount: number;
  checked: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  onSubmitOne: (id: string) => void;
}

export function PickerRow({
  playlist,
  present,
  trackCount,
  checked,
  disabled,
  onToggle,
  onSubmitOne,
}: PickerRowProps) {
  const { t } = useTranslation();
  const fullyAdded = present !== undefined && present === trackCount;
  const partly = present !== undefined && present > 0 && !fullyAdded;
  const subtitle = fullyAdded
    ? t("playlist_picker.already_added")
    : partly
      ? t("playlist_picker.partly_added", { count: present ?? 0 })
      : t("common.tracks", { count: playlist.trackCount });
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onToggle(playlist.id)}
      onDoubleClick={() => onSubmitOne(playlist.id)}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-[12px] rounded-control border-none p-[8px] text-left transition-colors disabled:opacity-50",
        checked
          ? "bg-bg-elevated"
          : "bg-transparent hover:bg-bg-elevated active:bg-border-alpha-14",
      )}
    >
      <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-elevated">
        {playlist.coverUrl ? (
          <CoverImage
            src={playlist.coverUrl}
            alt={playlist.title}
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : (
          <PlaylistFill size={20} className="text-text-tertiary" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span className="truncate text-body font-[500] text-text-primary">
          {playlist.title}
        </span>
        <span className="truncate text-caption tabular-nums text-text-tertiary">
          {subtitle}
        </span>
      </div>
      <span
        aria-hidden
        className={cn(
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
          checked
            ? "border-text-primary bg-text-primary text-bg-canvas"
            : "border-border-alpha-14 text-transparent group-hover:border-text-tertiary",
        )}
      >
        <CheckLine size={14} />
      </span>
    </button>
  );
}
