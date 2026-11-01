import { useMemo, useState } from "react";
import { CopyLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import {
  Button,
  Dialog,
  DialogActions,
  DialogButton,
  DialogHeader,
  HERO_BUTTON_CLASS,
  HERO_GLASS_BUTTON_CLASS,
  showToast,
} from "@/shared/ui";
import { useLocalLibraryStore } from "../store/localLibraryStore";
import { findDuplicateGroups } from "../lib/duplicates";

export default function LocalDuplicatesButton() {
  const { t } = useTranslation();
  const records = useLocalLibraryStore((state) => state.records);
  const remove = useLocalLibraryStore((state) => state.remove);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => findDuplicateGroups(records), [records]);
  const duplicateCount = groups.reduce(
    (total, group) => total + group.remove.length,
    0,
  );

  const handleRemove = async () => {
    if (duplicateCount === 0) return;
    setBusy(true);
    try {
      await remove(groups.flatMap((group) => group.remove.map((r) => r.id)));
      showToast(
        t("library.local.duplicates_removed", { count: duplicateCount }),
        "success",
      );
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={records.length < 2}
        className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`}
        title={t("library.local.find_duplicates")}
      >
        <CopyLine size={18} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen} maxWidth={480}>
        <div className="flex max-h-[70vh] flex-col gap-[16px] px-[20px] pb-[20px]">
          <DialogHeader
            title={t("library.local.find_duplicates")}
            description={t("library.local.duplicates_description", {
              count: duplicateCount,
            })}
          />

          {groups.length === 0 ? (
            <p className="m-0 py-[16px] text-center text-[13px] text-text-tertiary">
              {t("library.local.duplicates_empty")}
            </p>
          ) : (
            <div className="flex min-h-0 flex-col gap-[6px] overflow-y-auto pr-[2px]">
              {groups.map((group) => (
                <div
                  key={group.keep.id}
                  className="rounded-[12px] bg-black/[0.04] px-[12px] py-[9px] dark:bg-white/[0.06]"
                >
                  <p className="m-0 truncate text-[13px] font-[500] text-text-primary">
                    {group.keep.title}
                  </p>
                  <p className="m-0 mt-[1px] truncate text-[11.5px] text-text-tertiary">
                    {group.keep.artist} ·{" "}
                    {t("library.local.duplicates_copies", {
                      count: group.remove.length + 1,
                    })}
                  </p>
                  <div className="mt-[6px] flex flex-col gap-[2px] border-t border-black/5 pt-[6px] dark:border-white/5">
                    {group.remove.map((rem) => (
                      <p
                        key={rem.id}
                        className="m-0 truncate text-[11px] text-text-tertiary opacity-80"
                      >
                        ↳ {rem.fileName || rem.title}
                        {rem.album ? ` · ${rem.album}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogActions>
            <DialogButton type="button" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </DialogButton>
            <DialogButton
              type="button"
              variant="primary"
              loading={busy}
              disabled={duplicateCount === 0}
              onClick={() => void handleRemove()}
            >
              {t("library.local.duplicates_remove", { count: duplicateCount })}
            </DialogButton>
          </DialogActions>
        </div>
      </Dialog>
    </>
  );
}
