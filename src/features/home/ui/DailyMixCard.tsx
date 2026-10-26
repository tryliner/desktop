import { memo, useState } from "react";
import { ScrollableText } from "@/shared/ui";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import type { DailyMix } from "../hooks/useDailyMixes";
import { useDailyMixActions } from "../hooks/useDailyMixActions";
import DailyMixCover from "./DailyMixCover";

export interface DailyMixCardProps {
  mix: DailyMix;
  index?: number;
}

function DailyMixCard({ mix, index }: DailyMixCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const {
    menuItems,
    menuOpen,
    setMenuOpen,
    menuPosition,
    setMenuPosition,
    handleContextMenu,
    handleClick,
  } = useDailyMixActions(mix);

  const subtitleText =
    (mix.clusterArtists && mix.clusterArtists.length > 0
      ? mix.clusterArtists.join(", ")
      : mix.description) || "";

  const mixNumber = mix.title.match(/\d+/)?.[0] ?? String((index ?? 0) + 1);

  return (
    <div
      className="group flex-shrink-0 w-[175px] cursor-pointer select-none"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
    >
      <DailyMixCover
        coverUrl={mix.coverUrl}
        mixNumber={mixNumber}
        imageLoaded={imageLoaded}
        onLoad={() => setImageLoaded(true)}
      />

      <div className="flex flex-col mt-[8px]">
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {mix.title}
        </span>
        <ScrollableText
          text={subtitleText}
          isParentHovered={isCardHovered}
          className="text-[13px] text-text-tertiary"
          fadeColorClass="from-bg-primary"
        />
      </div>

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={(isOpen) => {
            setMenuOpen(isOpen);
            if (!isOpen) setMenuPosition(null);
          }}
          position={menuPosition}
        />
      )}
    </div>
  );
}

export default memo(DailyMixCard);
