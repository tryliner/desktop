import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import Dialog from "@/shared/ui/Dialog";
import type { ProfileCard } from "../model/types";
import { ProfileAbout, ProfileIdentity } from "./ProfileIdentity";
import { ProfileActions, ProfileSocials } from "./ProfileActions";
import { ProfileModules } from "./modules/ProfileModules";
import CloseLargeIcon from "~icons/carbon/close-large";
import PenSharpFillIcon from "~icons/keyline-icons/pen-sharp-fill";

const MODAL_WIDTH = 820;

const BANNER_BUTTON_CLASS =
  "absolute top-2 z-10 flex h-7 cursor-pointer items-center justify-center rounded-control border-0 bg-bg-glass text-text-primary backdrop-blur-[4px] transition-colors duration-150 hover:bg-fill-strong active:scale-95";

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileCard;
  isOwner?: boolean;
  onEdit?: () => void;
  onShare?: () => void;
  onJam?: () => void;
  onStats?: () => void;
}

export default function ProfileModal({
  open,
  onClose,
  profile,
  isOwner,
  onEdit,
  onShare,
  onJam,
  onStats,
}: ProfileModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      maxWidth={MODAL_WIDTH}
      backdropClassName="bg-black/30 backdrop-blur-[11px]"
      className="!rounded-[16px] !border-2 !border-black/10 p-0 dark:!border-white/10"
    >
      <div className="relative min-h-0 overflow-y-auto">
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-x-0 top-0 h-52 w-full object-cover select-none [mask-image:linear-gradient(to_bottom,rgb(0_0_0/0.8),transparent_200px)]"
          />
        ) : null}

        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className={cn(BANNER_BUTTON_CLASS, "left-2 w-7")}
        >
          <CloseLargeIcon width={16} height={16} />
        </button>

        {isOwner ? (
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              BANNER_BUTTON_CLASS,
              "right-2 gap-2 px-2.5 text-body font-[500]",
            )}
          >
            <PenSharpFillIcon width={12} height={12} />
            {t("profile.edit_profile")}
          </button>
        ) : null}

        <div className="relative flex flex-col gap-5 px-5 pt-[170px] pb-5">
          <div className="grid grid-cols-[minmax(0,467fr)_minmax(0,425fr)] items-center gap-x-6 gap-y-2">
            <ProfileIdentity profile={profile} />
            <ProfileActions onShare={onShare} onJam={onJam} onStats={onStats} />
            <ProfileAbout bio={profile.bio} friends={profile.friends} />
            {profile.links ? <ProfileSocials links={profile.links} /> : null}
          </div>

          {profile.modules?.length ? (
            <ProfileModules modules={profile.modules} />
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
