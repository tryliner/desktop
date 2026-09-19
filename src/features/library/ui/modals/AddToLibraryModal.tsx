import { useCallback } from "react";
import { useToast } from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
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

    saveExternal.mutate(
      { type: item.type, id: item.id },
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
        {/* Header */}
        <div className="flex flex-col gap-[2px] mb-[16px]">
          <h3
            className="text-[16px] font-[600] text-text-primary m-0"
            style={{ fontFamily: "var(--font-inter), sans-serif", letterSpacing: "-0.01em" }}
          >
            {t("common.add_to_library")}
          </h3>
          <p
            className="text-[13px] text-text-tertiary m-0 leading-normal"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.add_to_library_desc") || t("common.add_to_library")}
          </p>
        </div>

        {/* Target item preview */}
        {item && (
          <div className="flex items-center gap-[14px] p-[10px] rounded-lg bg-border-alpha-14 mb-[20px]">
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

        {/* 1-row actions: cancel + confirm */}
        <div className="flex items-center gap-[10px]">
          <Button
            variant="secondary"
            onClick={close}
            disabled={saveExternal.isPending}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>

          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={saveExternal.isPending}
            className="flex-1"
          >
            {saveExternal.isPending ? (
              <span className="inline-flex items-center gap-[6px]">
                <span className="inline-block h-[14px] w-[14px] rounded-full border-[2px] border-btn-primary-text/30 border-t-btn-primary-text animate-spin" />
                {t("common.adding")}
              </span>
            ) : (
              t("common.confirm")
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
