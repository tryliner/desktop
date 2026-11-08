import { useState } from "react";
import { useTranslation } from "@/languages";
import { DialogActions, DialogButton, ToggleSwitch } from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import { formatStorageBytes } from "@/shared/utils/cacheManager";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export interface SignOutDialogProps {
  open: boolean;
  songCount: number;
  bytes: number;
  onCancel: () => void;
  onSignOut: (keep: boolean, remember: boolean) => void;
}

export function SignOutDialog({
  open,
  songCount,
  bytes,
  onCancel,
  onSignOut,
}: SignOutDialogProps) {
  const { t } = useTranslation();
  const [keep, setKeep] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setKeep(false);
  }

  const details = {
    songs: t("common.songs", { count: songCount }),
    size: formatStorageBytes(bytes),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onCancel())}
      maxWidth={460}
      zIndex={260}
    >
      <div className="flex flex-col px-[20px] pb-[20px]" role="alertdialog">
        <h2
          className="m-0 text-[17px] font-[600] leading-[1.25] tracking-[-0.01em] text-text-primary"
          style={font}
        >
          {t("settings.storage.sign_out_title")}
        </h2>
        <p
          className="m-0 mt-[6px] text-[13px] leading-[1.45] text-text-tertiary"
          style={font}
        >
          {t(
            keep
              ? "settings.storage.sign_out_desc_keep"
              : "settings.storage.sign_out_desc_remove",
            details,
          )}
        </p>
        <label
          className="mt-[16px] flex cursor-pointer items-center justify-between gap-[12px] rounded-[12px] bg-black/[0.04] px-[14px] py-[10px] dark:bg-white/[0.05]"
          style={font}
        >
          <span className="text-[13px] font-[500] text-text-primary">
            {t("settings.storage.sign_out_keep_toggle")}
          </span>
          <ToggleSwitch
            checked={keep}
            onChange={setKeep}
            ariaLabel={t("settings.storage.sign_out_keep_toggle")}
          />
        </label>
        <DialogActions className="mt-[20px] !flex-nowrap">
          <DialogButton
            variant="primary"
            className="!min-w-0 !flex-auto !px-[10px] dark:!bg-white dark:!text-black dark:hover:!bg-white/90"
            onClick={() => onSignOut(keep, false)}
          >
            {t("settings.storage.sign_out_confirm")}
          </DialogButton>
          <DialogButton
            className="!min-w-0 !flex-auto !px-[10px]"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </DialogButton>
          <DialogButton
            className="!min-w-0 !flex-auto !px-[10px] !bg-black/[0.03] !text-text-secondary dark:!bg-white/[0.04]"
            onClick={() => onSignOut(keep, true)}
          >
            {t("settings.storage.sign_out_dont_ask")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
