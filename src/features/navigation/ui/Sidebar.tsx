import { memo, useEffect, useRef, useState } from "react";
import AppImage from "@/features/covers/ui/AppImage";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { sidebarNavItems } from "../data/navigation";
import logo from "@/assets/logo.svg";
import spotifyLogo from "@/assets/branding/logo-spotify.svg";
import yandexLogo from "@/assets/branding/logo-yandex.svg";
import discordLogo from "@/assets/branding/logo-discord.svg";
import telegramLogo from "@/assets/branding/logo-telegram.svg";
import auroraLogo from "@/assets/branding/logo-aurora.svg";
import sunsetLogo from "@/assets/branding/logo-sunset.svg";
import oceanLogo from "@/assets/branding/logo-ocean.svg";
import forestLogo from "@/assets/branding/logo-forest.svg";
import berryLogo from "@/assets/branding/logo-berry.svg";
import carbonLogo from "@/assets/branding/logo-carbon.svg";
import pixelLogo from "@/assets/branding/logo-pixel.svg";
import scanlinesLogo from "@/assets/branding/logo-scanlines.svg";
import vhsLogo from "@/assets/branding/logo-vhs.svg";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { usePlayerStore, type AccentVariant } from "@/features/player";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useModalStore } from "@/features/library";
import { Tooltip, UserAvatar } from "@/shared/ui";
import {
  ExitLine,
  LockLine,
} from "@mingcute/react";

const brandingLogos: Record<Exclude<AccentVariant, "default">, string> = {
  spotify: spotifyLogo,
  yandex: yandexLogo,
  discord: discordLogo,
  telegram: telegramLogo,
  aurora: auroraLogo,
  sunset: sunsetLogo,
  ocean: oceanLogo,
  forest: forestLogo,
  berry: berryLogo,
  carbon: carbonLogo,
  pixel: pixelLogo,
  scanlines: scanlinesLogo,
  vhs: vhsLogo,
};

interface SidebarProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
}

function Sidebar({ searchOpen, onSearchToggle }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const accentVariant = usePlayerStore((state) => state.accentVariant);
  const avatarSize = 36;
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const settingsOpen = useModalStore((state) => state.settingsOpen);
  const toggleSettings = useModalStore((state) => state.toggleSettings);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setProfileOpen(true);
    }, 180);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setProfileOpen(false);
    }, 240);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  const isRouteActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname === "/home";
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };
  const isItemActive = (id: string, href?: string) => {
    if (id === "search") {
      return searchOpen;
    }
    if (id === "settings") {
      return settingsOpen;
    }
    return href ? isRouteActive(href) : false;
  };

  const renderNavItems = () =>
    sidebarNavItems.map((item) => {
      const active = isItemActive(item.id, item.href);
      const Icon = item.Icon;
      const tooltipLabel = t(`common.sidebar.${item.id}`) || item.label;

      if (item.id === "search") {
        return (
          <Tooltip
            key={item.id}
            content={tooltipLabel}
            side="right"
            sideOffset={12}
          >
            <button
              type="button"
              aria-pressed={searchOpen}
              onClick={onSearchToggle}
              className={`group relative inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer active:scale-[0.96] transition-transform duration-100`}
            >
              <Icon
                size={26}
                className={`relative z-10 text-text-primary transition-opacity duration-150 ease-out ${
                  active ? "opacity-100" : "opacity-55 group-hover:opacity-90"
                }`}
              />
            </button>
          </Tooltip>
        );
      }

      if (item.id === "settings") {
        return (
          <Tooltip
            key={item.id}
            content={tooltipLabel}
            side="right"
            sideOffset={12}
          >
            <button
              type="button"
              aria-pressed={settingsOpen}
              onClick={toggleSettings}
              className={`group relative inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer active:scale-[0.96] transition-transform duration-100`}
            >
              <Icon
                size={26}
                className={`relative z-10 text-text-primary transition-opacity duration-150 ease-out ${
                  active ? "opacity-100" : "opacity-55 group-hover:opacity-90"
                }`}
              />
            </button>
          </Tooltip>
        );
      }

      return (
        <Tooltip
          key={item.id}
          content={tooltipLabel}
          side="right"
          sideOffset={12}
        >
          <Link
            key={item.id}
            to={item.href!}
            aria-current={active ? "page" : undefined}
            className={`group relative inline-flex items-center justify-center cursor-pointer active:scale-[0.96] transition-transform duration-100`}
          >
            <Icon
              size={26}
              className={`relative z-10 text-text-primary transition-opacity duration-150 ease-out ${
                active ? "opacity-100" : "opacity-55 group-hover:opacity-90"
              }`}
            />
          </Link>
        </Tooltip>
      );
    });

  const renderProfile = () => {
    if (!user) {
      return (
        <Tooltip
          content={t("common.account")}
          side="right"
          sideOffset={12}
        >
          <Link
            to="/login"
            className="group relative inline-flex items-center justify-center cursor-pointer active:scale-[0.96] transition-transform duration-100"
          >
            <UserAvatar user={null} size={avatarSize} />
          </Link>
        </Tooltip>
      );
    }

    const isPrivate = user.isPublic === false;
    const displayName =
      user.displayName ||
      user.username ||
      user.email?.split("@")[0] ||
      t("common.account");
    const handle = user.username ? `@${user.username}` : user.email;

    return (
      <div
        ref={profileRef}
        className="relative flex justify-center items-center shrink-0"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
            setProfileOpen((open) => !open);
          }}
          aria-expanded={profileOpen}
          aria-haspopup="dialog"
          className="group relative inline-flex items-center justify-center cursor-pointer border-0 bg-transparent p-0 rounded-full active:scale-[0.95] transition-all duration-150"
        >
          <UserAvatar user={user} size={avatarSize} />
        </button>

        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.96, x: -4 }}
              transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-[calc(100%+8px)] bottom-0 z-[100] w-[220px] rounded-md border border-border-primary bg-bg-primary shadow-2xl p-2 flex flex-col gap-1.5"
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                transformOrigin: "bottom left",
              }}
            >
              {/* User Identity Header */}
              <div className="flex items-center gap-2.5 min-w-0 px-0.5 pt-0.5">
                <UserAvatar user={user} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-medium text-text-primary truncate leading-tight">
                      {displayName}
                    </span>
                    {isPrivate && (
                      <LockLine
                        size={11}
                        className="text-text-tertiary shrink-0"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-text-tertiary font-mono truncate leading-normal m-0">
                    {handle}
                  </p>
                </div>
              </div>

              {/* Bio if present */}
              {user.bio?.trim() && (
                <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed m-0 px-0.5">
                  {user.bio.trim()}
                </p>
              )}

              {/* Logout Action */}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  void logout().finally(() =>
                    navigate("/login", { replace: true })
                  );
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-red-500/10 hover:text-red-500 text-[12px] font-medium text-text-secondary transition-colors cursor-pointer text-left border-none bg-transparent group"
              >
                <ExitLine size={13} className="text-text-tertiary group-hover:text-red-500 transition-colors" />
                <span>{t("profile.sign_out")}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <aside className="h-full">
      <div className="h-full w-[58px] rounded-l-xl rounded-r-sm bg-bg-primary flex flex-col">
        <div className="flex justify-center items-center pt-[16px] pb-[16px] shrink-0">
          <AppImage
            src={
              accentVariant === "default"
                ? logo
                : brandingLogos[accentVariant]
            }
            alt="Logo"
            width={34}
            height={34}
            className={
              "w-[34px] h-[34px] " +
              (accentVariant === "default" ||
              accentVariant === "carbon" ||
              accentVariant === "pixel" ||
              accentVariant === "scanlines"
                ? "theme-logo invert dark:invert-0"
                : "")
            }
            draggable={false}
          />
        </div>

        <nav className="relative flex-1 flex flex-col items-center gap-[24px] pt-[12px]">
          {renderNavItems()}
        </nav>

        <div className="pb-[12px] shrink-0 flex justify-center items-center">
          {renderProfile()}
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
