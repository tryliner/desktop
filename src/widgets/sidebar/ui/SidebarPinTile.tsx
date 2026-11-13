import { Link, useLocation } from "react-router-dom";
import { PlaylistFill } from "@mingcute/react";
import CoverImage from "@/features/covers/ui/CoverImage";
import { playerEngine } from "@/features/player";
import { usePinStore, type PinnedItem } from "@/features/pins";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { showToast, Tooltip } from "@/shared/ui";

export type PinTooltipSide = "right" | "left" | "bottom";

const tileClass =
  "group relative h-[40px] w-[40px] shrink-0 overflow-hidden bg-border-alpha-14 flex items-center justify-center border-0 p-0 cursor-pointer active:scale-[0.96] transition-transform duration-100";

function PinCover({ item }: { item: PinnedItem }) {
  if (!item.coverUrl)
    return <PlaylistFill size={20} className="text-border-alpha-33" />;
  return (
    <CoverImage
      src={item.coverUrl}
      alt={item.title}
      fill
      sizes="40px"
      className="object-cover transition-all duration-300 group-hover:brightness-[1.15]"
      draggable={false}
      unoptimized
    />
  );
}

export function PinTile({
  item,
  side,
}: {
  item: PinnedItem;
  side: PinTooltipSide;
}) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const remove = usePinStore((state) => state.remove);
  const shape = item.kind === "artist" ? "rounded-full" : "rounded-control";

  const unpin = (event: React.MouseEvent) => {
    event.preventDefault();
    remove(item.key);
    showToast(t("pins.unpinned"), "checkmark", { description: item.title });
  };

  return (
    <Tooltip content={item.title} side={side} sideOffset={12}>
      {item.track ? (
        <button
          type="button"
          aria-label={item.title}
          onClick={() => {
            if (!item.track) return;
            const track = { ...item.track, playCount: 0 };
            void playerEngine.playTrack(track, [track]);
          }}
          onContextMenu={unpin}
          className={cn(tileClass, shape)}
        >
          <PinCover item={item} />
        </button>
      ) : (
        <Link
          to={item.href ?? "/"}
          aria-label={item.title}
          aria-current={item.href === pathname + search ? "page" : undefined}
          onContextMenu={unpin}
          className={cn(tileClass, shape)}
        >
          <PinCover item={item} />
        </Link>
      )}
    </Tooltip>
  );
}
