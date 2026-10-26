import { useState } from "react";
import { DownLine, User1Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { DropdownMenu, type DropdownMenuItem } from "@/shared/ui";
import { AppImage } from "@/features/covers";
import { selectYoutubePageId, type YoutubeAccount } from "@/shared/youtube";

interface YoutubeAccountSwitcherProps {
  accounts: YoutubeAccount[];
}

interface AccountAvatarProps {
  photoUrl?: string;
}

function AccountAvatar({ photoUrl }: AccountAvatarProps) {
  return (
    <span className="relative flex size-[20px] items-center justify-center overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
      {photoUrl ? (
        <AppImage src={photoUrl} alt="" fill />
      ) : (
        <User1Line size={13} />
      )}
    </span>
  );
}

const accountKey = (account: YoutubeAccount) => account.pageId ?? "primary";

export default function YoutubeAccountSwitcher({
  accounts,
}: YoutubeAccountSwitcherProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items: DropdownMenuItem[] = accounts.map((account) => ({
    id: accountKey(account),
    label: account.name,
    icon: <AccountAvatar photoUrl={account.photoUrl} />,
    active: account.isSelected,
    onClick: () => {
      if (!account.isSelected) selectYoutubePageId(account.pageId ?? null);
    },
  }));

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
      items={items}
      trigger={
        <button
          type="button"
          aria-label={t("settings.youtube.section_account") || "Account"}
          aria-expanded={open}
          className="flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-text-secondary transition-colors hover:bg-black/[0.06] hover:text-text-primary dark:hover:bg-white/[0.08]"
        >
          <DownLine
            size={16}
            className={cn("transition-transform", open && "rotate-180")}
          />
        </button>
      }
    />
  );
}
