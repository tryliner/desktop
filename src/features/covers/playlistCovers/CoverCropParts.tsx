import { PicLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";

interface ThirdsGridProps {
  visible: boolean;
}

export function ThirdsGrid({ visible }: ThirdsGridProps) {
  const line = "absolute bg-white/45";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <span className={cn(line, "inset-y-0 left-1/3 w-px")} />
      <span className={cn(line, "inset-y-0 left-2/3 w-px")} />
      <span className={cn(line, "inset-x-0 top-1/3 h-px")} />
      <span className={cn(line, "inset-x-0 top-2/3 h-px")} />
    </div>
  );
}

interface CoverPlaceholderProps {
  currentCover: string | null;
  disabled: boolean;
  onChoose: () => void;
}

export function CoverPlaceholder({
  currentCover,
  disabled,
  onChoose,
}: CoverPlaceholderProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-[10px] border-none bg-transparent text-text-secondary transition-colors hover:text-text-primary"
    >
      {currentCover && (
        <img
          src={currentCover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      )}
      <span className="relative flex h-[48px] w-[48px] items-center justify-center rounded-full bg-fill">
        <PicLine size={22} />
      </span>
      <span className="relative text-label font-[500] text-text-primary">
        {t("playlist_cover.choose")}
      </span>
      <span className="relative text-caption text-text-tertiary">
        {t("playlist_cover.drop_hint")}
      </span>
    </button>
  );
}

export function BusyVeil() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
      <span className="h-[20px] w-[20px] animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
    </div>
  );
}
