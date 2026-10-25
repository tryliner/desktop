import { useCallback } from "react";
import {
  useToast,
  DialogActions,
  DialogButton,
  DialogHeader,
} from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useSaveExternalItem } from "../../hooks";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";

export default function AddToLibraryModal() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const open = useModalStore((state) => state.addToLibraryOpen);
  const item = useModalStore((state) => state.addToLibraryItem);
  const close = useModalStore((state) => state.closeAddToLibrary);

  const saveExternal = useSaveExternalItem();

  const handleAdd = useCallback(() => {
    if (!item) return;

    // same shape the library list reads back (useExternalItems): name/title + cover.url
    const cover = item.coverUrl ? { url: item.coverUrl } : undefined;
    const snapshot =
      item.type === "artist"
        ? { id: item.id, name: item.title, title: item.title, ...(cover ? { cover } : {}) }
        : {
            id: item.id,
            title: item.title,
            ...(cover ? { cover } : {}),
            ...(item.totalTracks ? { trackCount: item.totalTracks } : {}),
          };

    saveExternal.mutate(
      { type: item.type, id: item.id, snapshot },
      {
        onSuccess: () => {
          toast(t("common.added_to_library_success"), "checkmark", {
            description: item.title || undefined,
          });
          close();
        },
        onError: () => toast(t("common.failed_to_add_library"), "error"),
      },
    );
  }, [item, toast, saveExternal, t, close]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={380}>
      <div className="flex flex-col px-[20px] pb-[20px]">
        <DialogHeader
          className="mb-[16px]"
          title={t("common.add_to_library")}
          description={t("common.add_to_library_desc") || t("common.add_to_library")}
        />

        {/* Target item preview */}
        {item && (
          <div className="flex items-center gap-[14px] p-[10px] rounded-[14px] bg-black/[0.05] dark:bg-white/[0.07] mb-[20px]">
            <div
              className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden ${
                item.type === "artist" ? "rounded-full" : "rounded-md"
              } bg-border-alpha-14`}
            >
              {item.coverUrl && (
                <CoverImage
                  src={item.coverUrl}
                  alt={item.title}
                  fill
                  sizes="52px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="flex flex-col min-w-0 gap-[2px]">
              <span className="text-[14px] font-[500] text-text-primary truncate">
                {item.title}
              </span>
              <span className="text-[12px] text-text-tertiary capitalize">
                {item.type}
              </span>
            </div>
          </div>
        )}

        <DialogActions>
          <DialogButton onClick={close} disabled={saveExternal.isPending}>
            {t("common.cancel")}
          </DialogButton>
          <DialogButton
            variant="primary"
            onClick={handleAdd}
            loading={saveExternal.isPending}
          >
            {saveExternal.isPending ? t("common.adding") : t("common.confirm")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
