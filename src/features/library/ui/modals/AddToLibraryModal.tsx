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
import { planLimitMessage } from "@/shared/api";
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

    // the snapshot is all the library tile shows (useExternalItems reads it
    // back); the server takes texts and cover urls of up to 500 characters
    const text = (value: string | undefined) =>
      value?.trim().slice(0, 500) || undefined;
    const cover =
      item.coverUrl && item.coverUrl.length <= 500
        ? { url: item.coverUrl }
        : undefined;
    const name = text(item.title) ?? item.id;
    const author = text(item.subtitle);
    const input =
      item.type === "artist"
        ? {
            type: item.type,
            id: item.id,
            snapshot: { name, ...(cover ? { cover } : {}) },
          }
        : {
            type: item.type,
            id: item.id,
            snapshot: {
              title: name,
              ...(author ? { author } : {}),
              ...(cover ? { cover } : {}),
              ...(item.totalTracks ? { trackCount: item.totalTracks } : {}),
            },
          };

    saveExternal.mutate(input, {
      onSuccess: () => {
        toast(t("common.added_to_library_success"), "checkmark", {
          description: item.title || undefined,
        });
        close();
      },
      onError: (err) =>
        toast(
          planLimitMessage(err, t) ?? t("common.failed_to_add_library"),
          "error",
        ),
    });
  }, [item, toast, saveExternal, t, close]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={380}
    >
      <div className="flex flex-col px-[20px] pb-[20px]">
        <DialogHeader
          className="mb-[16px]"
          title={t("common.add_to_library")}
          description={
            t("common.add_to_library_desc") || t("common.add_to_library")
          }
        />

        {/* Target item preview */}
        {item && (
          <div className="flex items-center gap-[14px] p-[10px] rounded-[14px] bg-fill mb-[20px]">
            <div
              className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden ${
                item.type === "artist" ? "rounded-full" : "rounded-control"
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
              <span className="text-label font-[500] text-text-primary truncate">
                {item.title}
              </span>
              <span className="text-caption text-text-tertiary capitalize">
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
