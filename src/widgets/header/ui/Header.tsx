import { forwardRef, memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import WindowControls, {
  WINDOW_CONTROLS_LAYOUT_ID,
  WINDOW_CONTROLS_MORPH,
} from "@/features/navigation/ui/WindowControls";
import logo from "@/assets/logo.svg";
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
        "relative z-45 w-full shrink-0 select-none bg-transparent h-[50px] flex items-center justify-between",
        className,
      )}
    >
      <div className="w-[58px] h-full flex items-center justify-center shrink-0">
        <Link
          to="/"
          data-no-window-drag
          title="Liner"
          className="flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <img
            src={logo}
            alt="Liner"
            width={39}
            height={30}
            className="h-[30px] w-auto object-contain theme-logo invert dark:invert-0 select-none"
            draggable={false}
          />
        </Link>
      </div>

      <div className="flex items-center gap-[8px] mr-[6px] shrink-0">
        <HistoryNavIsland />
        <motion.div
          layoutId={WINDOW_CONTROLS_LAYOUT_ID}
          transition={WINDOW_CONTROLS_MORPH}
          data-no-window-drag
          data-no-tooltip="true"
          className="h-[38px] hidden md:flex items-center gap-[2px] px-[4px] rounded-[10px] shrink-0 bg-bg-glass backdrop-blur-[20px]"
        >
          <WindowControls bare />
        </motion.div>
      </div>
    </header>
  );
});

export default memo(Header);
