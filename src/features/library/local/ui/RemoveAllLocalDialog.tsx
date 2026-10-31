import { useEffect, useState } from "react";
import {
  DialogActions,
  DialogButton,
  DialogHeader,
  useToast,
} from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import { useTranslation } from "@/languages";
import { formatStorageBytes } from "@/shared/utils/cacheManager";
import { useLocalLibraryStore } from "../store/localLibraryStore";

interface RemoveAllLocalDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function RemoveAllLocalDialog({
  open,
  onClose,
}: RemoveAllLocalDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const count = useLocalLibraryStore((state) => state.records.length);
  const removeAll = useLocalLibraryStore((state) => state.removeAll);
  const [bytes, setBytes] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setBytes(null);
    void window.linerElectron
      ?.localTracksUsage()
      .then((usage) => {
        if (active) setBytes(usage.bytes);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  const confirm = async () => {
    setRemoving(true);
    try {
      await removeAll();
      toast(t("library.local.removed_all"), "info");
      onClose();
    } catch {
      toast(t("settings.cache.local_cache.error"), "error");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next && !removing ? onClose() : undefined)}
      maxWidth={400}
    >
      <div className="flex flex-col px-[20px] pb-[20px]">
        <DialogHeader
          className="mb-[20px]"
          title={t("library.local.remove_all_title")}
          description={t("library.local.remove_all_desc", {
            tracks: t("common.tracks", { count }),
            size: bytes === null ? "…" : formatStorageBytes(bytes),
          })}
        />
        <DialogActions>
          <DialogButton onClick={onClose} disabled={removing}>
            {t("common.cancel")}
          </DialogButton>
          <DialogButton
            variant="danger"
            onClick={() => void confirm()}
            loading={removing}
            disabled={count === 0}
          >
            {t("library.local.remove_all")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
