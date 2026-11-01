import type { ReactNode } from "react";
import {
  DiscordFill,
  GithubFill,
  World2Line,
  TelegramFill,
} from "@mingcute/react";
import { useTranslation } from "@/languages";

interface AboutLink {
  id: string;
  url: string;
  label: string;
  icon: ReactNode;
}

const openUrl = (url: string) =>
  window.open(url, "_blank", "noopener,noreferrer");

export function AboutTabLinks() {
  const { t } = useTranslation();

  const links: AboutLink[] = [
    {
      id: "telegram",
      url: "https://t.me/liner_app",
      label: t("settings.about.telegram"),
      icon: <TelegramFill size={17} />,
    },
    {
      id: "discord",
      url: "https://discord.gg/liner",
      label: t("settings.about.discord"),
      icon: <DiscordFill size={17} />,
    },
    {
      id: "github",
      url: "https://github.com/tryliner/desktop",
      label: t("settings.about.github"),
      icon: <GithubFill size={17} />,
    },
    {
      id: "website",
      url: "https://tryliner.fun",
      label: t("settings.about.website"),
      icon: <World2Line size={17} />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-[8px]">
      {links.map((link) => (
        <button
          key={link.id}
          type="button"
          onClick={() => openUrl(link.url)}
          className="flex h-[38px] items-center gap-[8px] rounded-[11px] border-0 bg-fill px-[14px] text-[14px] font-[500] text-text-primary transition-colors hover:bg-fill-hover"
        >
          {link.icon}
          {link.label}
        </button>
      ))}
    </div>
  );
}
