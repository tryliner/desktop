import type { ReactNode } from "react";
import ShareFatIcon from "~icons/ph/share-fat";
import MediaPodcastIcon from "~icons/gg/media-podcast";
import StatisticUpIcon from "~icons/akar-icons/statistic-up";
import TelegramIcon from "~icons/bxl/telegram";
import DiscordFillIcon from "~icons/akar-icons/discord-fill";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import type { ProfileLinks } from "../model/types";

const ACTION_CLASS =
  "flex h-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-item border-0 bg-fill-subtle px-2.5 backdrop-blur-md text-label font-[500] text-text-secondary transition-colors duration-150 hover:bg-fill hover:text-text-primary active:scale-[0.98]";

interface ProfileActionsProps {
  onShare?: () => void;
  onJam?: () => void;
  onStats?: () => void;
}

export function ProfileActions({
  onShare,
  onJam,
  onStats,
}: ProfileActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-11 min-w-0 gap-2.5">
      <button
        type="button"
        aria-label={t("profile.share")}
        onClick={onShare}
        className={cn(ACTION_CLASS, "w-13 shrink-0")}
      >
        <ShareFatIcon width={22} height={22} />
      </button>
      <button
        type="button"
        onClick={onJam}
        className={cn(ACTION_CLASS, "flex-[155]")}
      >
        <MediaPodcastIcon width={20} height={20} className="shrink-0" />
        <span className="truncate">{t("profile.jam")}</span>
      </button>
      <button
        type="button"
        onClick={onStats}
        className={cn(ACTION_CLASS, "flex-[184]")}
      >
        <StatisticUpIcon width={20} height={20} className="shrink-0" />
        <span className="truncate">{t("profile.statistics")}</span>
      </button>
    </div>
  );
}

interface SocialLinkProps {
  icon: ReactNode;
  label: string;
}

function SocialLink({ icon, label }: SocialLinkProps) {
  return (
    <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-item bg-fill-subtle p-1.5 pr-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fill text-text-secondary">
        {icon}
      </span>
      <span className="truncate text-label font-[600] text-text-secondary select-text">
        {label}
      </span>
    </div>
  );
}

interface ProfileSocialsProps {
  links: ProfileLinks;
}

export function ProfileSocials({ links }: ProfileSocialsProps) {
  return (
    <div className="flex min-w-0 gap-2.5">
      {links.telegram ? (
        <SocialLink
          icon={<TelegramIcon width={20} height={20} />}
          label={links.telegram}
        />
      ) : null}
      {links.discord ? (
        <SocialLink
          icon={<DiscordFillIcon width={20} height={20} />}
          label={links.discord}
        />
      ) : null}
    </div>
  );
}
