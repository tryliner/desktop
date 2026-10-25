import { CheckLine, User1Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { AppImage } from "@/features/covers";
import { selectYoutubePageId, type YoutubeAccount } from "@/shared/youtube";

interface YoutubeAccountPickerProps {
  accounts: YoutubeAccount[];
}

const accountKey = (account: YoutubeAccount) => account.pageId ?? "primary";

export default function YoutubeAccountPicker({
  accounts,
}: YoutubeAccountPickerProps) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col">
      <h4 className="m-0 pb-[10px] pt-[4px] text-[14px] font-[500] text-text-secondary">
        {t("settings.youtube.section_account") || "Account"}
      </h4>
      <div className="flex flex-col gap-[8px]">
        {accounts.map((account) => (
          <button
            key={accountKey(account)}
            type="button"
            aria-pressed={account.isSelected}
            disabled={account.isSelected}
            onClick={() => selectYoutubePageId(account.pageId ?? null)}
            className={cn(
              "flex min-h-[54px] items-center gap-[12px] rounded-[12px] bg-black/[0.04] px-[16px] py-[10px] text-left transition-colors dark:bg-white/[0.08]",
              account.isSelected
                ? "cursor-default"
                : "cursor-pointer hover:bg-black/[0.07] dark:hover:bg-white/[0.12]",
            )}
          >
            <span className="relative flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[0.06] text-text-tertiary dark:bg-white/[0.08]">
              {account.photoUrl ? (
                <AppImage src={account.photoUrl} alt="" fill />
              ) : (
                <User1Line size={18} />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className="truncate text-[14px] font-[500] leading-snug text-text-primary">
                {account.name}
              </span>
              {(account.handle ?? account.email) && (
                <span className="truncate text-[12px] text-text-tertiary">
                  {account.handle ?? account.email}
                </span>
              )}
            </span>
            {account.isSelected && (
              <CheckLine size={18} className="shrink-0 text-text-primary" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
