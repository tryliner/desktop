import type { ReactNode } from "react";
import { LeftLine } from "@mingcute/react";
import { Repeat, RepeatOne, Shuffle, TrashBin2 } from "@solar-icons/react";
import { useTranslation } from "@/languages";
import { Tooltip } from "@/shared/ui";
import { cn } from "@/shared/lib";
import type { RepeatMode } from "@/features/player";

export interface RightDrawerHeaderProps {
  trackCount: number;
  shuffle: boolean;
  repeat: RepeatMode;
  canClear: boolean;
  onShuffleToggle: () => void;
  onRepeatCycle: () => void;
  onClear: () => void;
  onClose?: () => void;
}

interface QueueActionProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function QueueAction({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: QueueActionProps) {
  return (
    <Tooltip content={label} side="bottom" sideOffset={8} disabled={disabled}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "inline-flex h-[32px] w-[36px] items-center justify-center rounded-[7px] border-0 cursor-pointer transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100",
          active
            ? "bg-white/[0.16] text-text-primary"
            : "bg-transparent text-text-secondary hover:bg-white/[0.08] hover:text-text-primary disabled:hover:bg-transparent",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function RightDrawerHeader({
  trackCount,
  shuffle,
  repeat,
  canClear,
  onShuffleToggle,
  onRepeatCycle,
  onClear,
  onClose,
}: RightDrawerHeaderProps) {
  const { t } = useTranslation();
  const RepeatIcon = repeat === "one" ? RepeatOne : Repeat;

  return (
    <div className="relative shrink-0 z-20 flex items-center gap-[10px] px-[12px] pt-[12px] pb-[8px] select-none">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.back") || "Back"}
          data-no-tooltip="true"
          className="group inline-flex h-[40px] w-[44px] shrink-0 items-center justify-center rounded-[10px] border-0 bg-white/[0.1] text-text-primary cursor-pointer transition-[background-color,transform] duration-150 hover:bg-white/[0.15] active:scale-[0.94]"
        >
          <LeftLine
            size={20}
            className="transition-transform duration-150 group-hover:-translate-x-0.5"
          />
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="m-0 truncate text-[16px] font-[600] leading-tight tracking-tight text-text-primary">
          {t("player.queue")}
        </h2>
        <span className="truncate text-[12px] leading-tight text-text-tertiary">
          {t("common.tracks", { count: trackCount })}
        </span>
      </div>

      <div className="flex h-[40px] shrink-0 items-center gap-[2px] rounded-[10px] bg-white/[0.1] p-[4px]">
        <QueueAction
          label={shuffle ? t("player.shuffle_on") : t("player.shuffle_off")}
          active={shuffle}
          onClick={onShuffleToggle}
        >
          <Shuffle size={18} weight="Outline" />
        </QueueAction>
        <QueueAction
          label={t(`player.repeat_${repeat}`)}
          active={repeat !== "off"}
          onClick={onRepeatCycle}
        >
          <RepeatIcon size={18} weight="Outline" />
        </QueueAction>
        <QueueAction
          label={t("player.clear_queue")}
          disabled={!canClear}
          onClick={onClear}
        >
          <TrashBin2 size={18} weight="Outline" />
        </QueueAction>
      </div>
    </div>
  );
}

export default RightDrawerHeader;
