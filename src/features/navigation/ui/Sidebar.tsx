import { memo } from "react";
import AppImage from "@/features/covers/ui/AppImage";
import { Link, useLocation } from "react-router-dom";
import { sidebarNavItems } from "../data/navigation";
import logo from "@/assets/logo.svg";
import spotifyLogo from "@/assets/branding/logo-spotify.svg";
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
import { useTranslation } from "@/languages";
import { useTheme } from "next-themes";
import { usePlayerStore, type AccentVariant } from "@/features/player";
import { useModalStore } from "@/features/library";
import { useCustomizationStore, getBlockStyle } from "@/features/settings";
import { Tooltip } from "@/shared/ui";


const brandingLogos: Record<Exclude<AccentVariant, "default">, string> = {
  spotify: spotifyLogo,
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
  const { t } = useTranslation();
  const accentVariant = usePlayerStore((state) => state.accentVariant);
  const settingsOpen = useModalStore((state) => state.settingsOpen);
  const toggleSettings = useModalStore((state) => state.toggleSettings);

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
    sidebarNavItems
      .filter((item) => item.id !== "settings")
      .map((item) => {
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

  const renderSettingsButton = () => {
    const settingsItem = sidebarNavItems.find((item) => item.id === "settings");
    if (!settingsItem) return null;
    const Icon = settingsItem.Icon;
    const tooltipLabel = t("common.sidebar.settings") || settingsItem.label;
    return (
      <Tooltip
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
              settingsOpen ? "opacity-100" : "opacity-55 group-hover:opacity-90"
            }`}
          />
        </button>
      </Tooltip>
    );
  };

  const { resolvedTheme } = useTheme();
  const isDark =
    resolvedTheme
      ? resolvedTheme === "dark"
      : typeof document !== "undefined" &&
        (document.documentElement.getAttribute("data-theme") === "dark" ||
          (!document.documentElement.getAttribute("data-theme") &&
            window.matchMedia?.("(prefers-color-scheme: dark)")?.matches));
  const backgroundImage = useCustomizationStore((state) => state.backgroundImage);
  const sidebarConfig = useCustomizationStore((state) => state.sidebar);
  const hasCustomBg = Boolean(backgroundImage && isDark);
  const sidebarStyle = getBlockStyle(sidebarConfig, isDark, hasCustomBg);

  return (
    <aside className="h-full">
      <div
        className={`h-full w-[58px] rounded-l-xl rounded-r-sm ${
          hasCustomBg ? "" : "bg-bg-primary"
        } flex flex-col overflow-hidden`}
        style={sidebarStyle}
      >
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

        <div className="pt-[16px] pb-[16px] shrink-0 flex justify-center items-center">
          {renderSettingsButton()}
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
