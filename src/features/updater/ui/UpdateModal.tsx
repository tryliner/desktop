import Dialog from "@/shared/ui/Dialog";
import { DialogActions, DialogButton, DialogHeader } from "@/shared/ui";
import { LinkLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useUpdaterStore } from "../store/updaterStore";

export default function UpdateModal() {
  const { t } = useTranslation();
  const isDialogOpen = useUpdaterStore((state) => state.isDialogOpen);
  const updateInfo = useUpdaterStore((state) => state.updateInfo);
  const skipUpdate = useUpdaterStore((state) => state.skipUpdate);
  const startDownload = useUpdaterStore((state) => state.startDownload);

  if (!updateInfo) return null;

  const releaseTag = updateInfo.version.startsWith("v")
    ? updateInfo.version
    : `v${updateInfo.version}`;
  const releaseUrl =
    updateInfo.version === "latest"
      ? "https://github.com/tryliner/desktop/releases/latest"
      : `https://github.com/tryliner/desktop/releases/tag/${encodeURIComponent(
          releaseTag,
        )}`;
  const manualOnly = updateInfo.manualOnly === true;
  const description = manualOnly
    ? updateInfo.version === "latest"
      ? t("updater.manual_install_latest_desc")
      : t("updater.manual_install_desc", { version: updateInfo.version })
    : t("updater.modal_desc", { version: updateInfo.version }) ||
      `A new version of Liner (v${updateInfo.version}) is ready.`;

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) skipUpdate();
      }}
      maxWidth={360}
    >
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px]">
        <DialogHeader
          title={t("updater.modal_title") || "New Update Available"}
          description={
            <>
              {description}{" "}
              <a
                href={releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(releaseUrl, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-[3px] text-[#2383e2] hover:bg-[#2383e2]/10 dark:hover:bg-[#2383e2]/15 px-[5px] py-[1px] -mx-[3px] rounded-md font-[500] cursor-pointer align-baseline select-none transition-colors"
              >
                <span>{t("updater.view_changelog") || "Changelog"}</span>
                <LinkLine size={12} className="inline shrink-0 opacity-80" />
              </a>
            </>
          }
        />

        <DialogActions>
          <DialogButton onClick={skipUpdate}>
            {t("updater.skip_button") || "Skip"}
          </DialogButton>
          <DialogButton
            variant="primary"
            onClick={() => {
              if (manualOnly) {
                window.open(releaseUrl, "_blank", "noopener,noreferrer");
                skipUpdate();
              } else {
                void startDownload();
              }
            }}
          >
            {manualOnly
              ? t("updater.manual_install_button")
              : t("updater.update_button") || "Update"}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
