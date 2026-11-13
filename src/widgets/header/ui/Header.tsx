import { forwardRef, memo } from "react";
import { motion } from "framer-motion";
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
        <motion.div
          layoutId={WINDOW_CONTROLS_LAYOUT_ID}
          transition={WINDOW_CONTROLS_MORPH}
          data-no-window-drag
          data-no-tooltip="true"
          className="h-[38px] flex items-center gap-[2px] px-[4px] rounded-[10px] shrink-0 bg-bg-glass [:root[data-user-accent]_&]:bg-(--user-accent-island) backdrop-blur-[20px]"
        >
          <WindowControls bare />
        </motion.div>
      </div>
    </header>
  );
});

export default memo(Header);
