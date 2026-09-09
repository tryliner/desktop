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

    if (item.type === "playlist") {
      close();
      return;
    }

    saveExternal.mutate(
      { type: item.type, id: item.id },
      {
        onSuccess: () => {
          toast(
            t("common.added_to_library", {
              type: item.title || item.type,
              name: item.title || item.type,
            }),
            "success",
          );
          close();
        },
        onError: () => toast(t("common.failed_to_add_library"), "error"),
      },
    );
  }, [item, toast, saveExternal, t, close]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={400}>
      <div className="px-[20px] pb-[20px]">
        {item && (
          <div className="flex items-center gap-[16px] mb-[20px]">
            <div
              className={`relative h-[80px] w-[80px] shrink-0 overflow-hidden ${
                item.type === "artist" ? "rounded-full" : "rounded-md"
              } bg-border-alpha-14`}
            >
              {item.coverUrl && (
                <CoverImage
                  src={item.coverUrl}
                  alt={item.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[16px] font-[500] text-text-primary truncate">
                {item.title}
              </span>
              <span className="text-[14px] text-text-tertiary capitalize">
                {item.type}
              </span>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleAdd}
          disabled={saveExternal.isPending}
          className="w-full"
        >
          {saveExternal.isPending ? (
            <span className="inline-flex items-center gap-[8px]">
              <span className="inline-block h-[16px] w-[16px] rounded-full border-[2px] border-btn-primary-text/30 border-t-btn-primary-text animate-spin" />
              {t("common.adding")}
            </span>
          ) : (
            t("common.add_to_library")
          )}
        </Button>
      </div>
    </Dialog>
  );
}
