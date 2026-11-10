import { useTranslation } from "@/languages";
import { UserAvatar } from "@/shared/ui";
import { userDisplayName } from "@/entities/user";
import { cn } from "@/shared/lib";
import type {
  ProfileCard,
  ProfileFriends,
  ProfileNameFont,
} from "../model/types";

const ROUND = { borderRadius: "50%" };

const NAME_FONT_CLASS: Record<ProfileNameFont, string> = {
  medeo: "font-sans font-[600] tracking-[-0.02em]",
  "medeo-pixel": "font-medeo-pixel font-[400] tracking-[-0.3px]",
  pixelify: "font-pixelify font-[600]",
  playfair: "font-playfair font-[800] italic",
  barcode: "font-barcode font-[400]",
  "broken-fax": "font-broken-fax font-[400]",
  comic: "font-comic font-[400]",
};

interface ProfileIdentityProps {
  profile: ProfileCard;
}

export function ProfileIdentity({ profile }: ProfileIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <UserAvatar
        user={profile}
        size={72}
        className="border-white/10 bg-bg-panel"
        style={ROUND}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            className={cn(
              "m-0 truncate pb-0.5 text-[38px] leading-[1.2] text-text-primary",
              NAME_FONT_CLASS[profile.nameFont ?? "medeo"],
            )}
          >
            {userDisplayName(profile)}
          </h2>
          {profile.badge ? (
            <span className="flex shrink-0 text-text-primary">
              {profile.badge}
            </span>
          ) : null}
        </div>
        {profile.username ? (
          <p className="m-0 truncate text-title leading-[1.3] text-text-secondary">
            @{profile.username}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface ProfileAboutProps {
  bio?: string | null;
  friends?: ProfileFriends;
}

export function ProfileAbout({ bio, friends }: ProfileAboutProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <p className="m-0 line-clamp-3 max-w-[220px] min-w-0 text-body leading-[1.25] font-[500] break-words text-text-secondary select-text">
        {bio}
      </p>
      {friends ? (
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex">
            {friends.preview.slice(0, 3).map((friend, index) => (
              <UserAvatar
                key={friend.username ?? index}
                user={friend}
                size={30}
                className={
                  index > 0
                    ? "-ml-2.5 border-2 border-bg-panel bg-bg-panel"
                    : "border-0 bg-bg-panel"
                }
                style={ROUND}
              />
            ))}
          </div>
          <div className="flex flex-col">
            <span className="text-body font-[500] tracking-[0.02em] text-text-primary">
              {t("profile.friends", { count: friends.count })}
            </span>
            <span className="text-caption tracking-[0.02em] text-text-secondary">
              {t("profile.online", { count: friends.online })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
