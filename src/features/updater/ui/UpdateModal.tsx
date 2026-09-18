import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import { LinkLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useUpdaterStore } from "../store/updaterStore";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

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
  const changelogUrl = `https://github.com/tryliner/desktop/releases/tag/${releaseTag}`;

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) skipUpdate();
      }}
      maxWidth={360}
    >
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px]">
        {/* Title & Description with Notion-style blue link */}
        <div className="flex flex-col gap-[6px]">
          <h3
            className="text-text-primary text-[16px] font-[600] tracking-[-0.01em] m-0"
            style={font}
          >
            {t("updater.modal_title") || "New Update Available"}
          </h3>
          <p
            className="text-text-secondary text-[13px] leading-relaxed m-0 font-[400]"
            style={font}
          >
            {t("updater.modal_desc", { version: updateInfo.version }) ||
              `A new version of Liner (v${updateInfo.version}) is ready.`}{" "}
            <a
              href={changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open(changelogUrl, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-[3px] text-[#2383e2] hover:bg-[#2383e2]/10 dark:hover:bg-[#2383e2]/15 px-[5px] py-[1px] -mx-[3px] rounded-md font-[500] cursor-pointer align-baseline select-none transition-colors"
            >
              <span>{t("updater.view_changelog") || "Changelog"}</span>
              <LinkLine size={12} className="inline shrink-0 opacity-80" />
            </a>
          </p>
        </div>

        {/* 1-row Action Buttons */}
        <div className="flex items-center gap-[8px] w-full pt-[4px]">
          <Button
            variant="secondary"
            onClick={skipUpdate}
            className="flex-1 !h-[36px] !text-[13px]"
          >
            {t("updater.skip_button") || "Skip"}
          </Button>
          <Button
            variant="primary"
            onClick={() => void startDownload()}
            className="flex-1 !h-[36px] !text-[13px]"
          >
            {t("updater.update_button") || "Update"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
