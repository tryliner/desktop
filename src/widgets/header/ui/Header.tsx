import { forwardRef, memo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { motion } from "framer-motion";
import WindowControls, {
  WINDOW_CONTROLS_LAYOUT_ID,
  WINDOW_CONTROLS_MORPH,
} from "@/features/navigation/ui/WindowControls";
import logo from "@/assets/logo.svg";
import { cn } from "@/shared/lib";

const BACK_BUTTON_ROUTES = [
  "/library/playlist",
  "/library/local",
  "/library/cached",
  "/library/saved",
  "/artist",
  "/collection",
];

function BackButton() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/library");
    }
  }, [navigate]);

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={t("common.back")}
      data-no-tooltip="true"
      data-no-window-drag
      className="group relative inline-flex h-[38px] shrink-0 items-center gap-[6px] rounded-[10px] px-[12px] active:scale-[0.96] transition-transform cursor-pointer select-none text-[13px] font-[500] border-0 !border-none bg-bg-glass backdrop-blur-[20px] text-text-primary after:pointer-events-none after:absolute after:inset-0 after:rounded-[10px] after:transition-colors after:duration-150 hover:after:bg-black/[0.05] dark:hover:after:bg-white/[0.08]"
    >
      <ArrowLeftLine
        size={16}
        className="transition-transform duration-150 group-hover:-translate-x-0.5"
      />
      <span className="relative -left-[1.5px] top-[1px]">
        {t("common.back")}
      </span>
    </button>
  );
}

export interface HeaderProps {
  searchOpen?: boolean;
  onSearchToggle?: () => void;
  className?: string;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
  { className },
  ref,
) {
  const { pathname } = useLocation();
  const showBack = BACK_BUTTON_ROUTES.includes(pathname);

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

      {showBack && (
        <div className="flex-1 min-w-0 flex items-center pl-[22px]">
          <BackButton />
        </div>
      )}

      <div className="flex items-center gap-[8px] mr-[6px] shrink-0">
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
