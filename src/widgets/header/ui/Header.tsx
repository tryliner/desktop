import { forwardRef, memo } from "react";
import { motion } from "framer-motion";
import { MusicNote } from "@solar-icons/react";
import WindowControls, {
  WINDOW_CONTROLS_LAYOUT_ID,
  WINDOW_CONTROLS_MORPH,
} from "@/features/navigation/ui/WindowControls";
import { cn } from "@/shared/lib";
import { HistoryNavIsland } from "./HistoryNavIsland";

export interface HeaderProps {
  searchOpen?: boolean;
  onSearchToggle?: () => void;
  className?: string;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
  { className },
  ref,
) {
  return (
    <header
      ref={ref}
      data-window-drag
      className={cn(
        "relative z-45 w-full shrink-0 select-none bg-transparent h-[50px] flex items-center justify-end",
        className,
      )}
    >
      <div className="flex items-center gap-[8px] mr-[6px] shrink-0">
        <HistoryNavIsland />
        <button
          type="button"
          aria-label="Open lyrics pop-up"
          title="Open lyrics pop-up"
          data-no-window-drag
          onClick={() => void window.linerElectron?.lyricsPopupToggle?.()}
          className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-0 bg-bg-glass text-text-secondary backdrop-blur-[20px] transition-colors hover:bg-bg-toolbox-active hover:text-text-primary"
        >
          <MusicNote size={18} weight="Outline" />
        </button>
        <motion.div
          layoutId={WINDOW_CONTROLS_LAYOUT_ID}
          transition={WINDOW_CONTROLS_MORPH}
          data-no-window-drag
          data-no-tooltip="true"
          className="h-[38px] flex items-center gap-[2px] px-[4px] rounded-[10px] shrink-0 bg-bg-glass backdrop-blur-[20px]"
        >
          <WindowControls bare />
        </motion.div>
      </div>
    </header>
  );
});

export default memo(Header);
