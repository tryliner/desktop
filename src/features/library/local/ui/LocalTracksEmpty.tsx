import { FileMusicLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { HERO_BUTTON_CLASS } from "@/shared/ui";
import Button from "@/shared/ui/Button";

interface LocalTracksEmptyProps {
  importing: boolean;
  onAddFiles: () => void;
}

export default function LocalTracksEmpty({
  importing,
  onAddFiles,
}: LocalTracksEmptyProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-[14px] text-center">
      <FileMusicLine size={40} className="text-border-alpha-33" />
      <div className="flex flex-col gap-[4px]">
        <p className="m-0 text-[15px] font-[500] text-text-primary">
          {t("library.local.empty_title")}
        </p>
        <p className="m-0 max-w-[360px] text-[13px] text-text-tertiary">
          {t("library.local.empty_subtitle")}
        </p>
      </div>
      <Button
        variant="primary"
        onClick={onAddFiles}
        disabled={importing}
        className={`${HERO_BUTTON_CLASS} px-[22px]`}
      >
        {importing
          ? t("library.local.importing")
          : t("library.local.add_files")}
      </Button>
    </div>
  );
}
