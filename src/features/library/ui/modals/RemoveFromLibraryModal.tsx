import { Suspense, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useToast } from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useRemoveExternalItem } from "../../hooks";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";

function RemoveFromLibraryModalContent() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const open = useModalStore((state) => state.removeFromLibraryOpen);
  const detail = useModalStore((state) => state.removeFromLibraryDetail);
  const close = useModalStore((state) => state.closeRemoveFromLibrary);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const removeExternal = useRemoveExternalItem();

  const handleRemove = useCallback(() => {
    if (!detail) return;

    const targetType = detail.type;
    const targetId = detail.id;

    close();

    if (
      pathname === `/library/${targetType}` &&
      searchParams.get("id") === targetId
    ) {
      navigate("/library");
    } else if (
      targetType === "playlist" &&
      pathname === "/library/playlist" &&
      searchParams.get("id") === targetId
    ) {
      navigate("/library");
    }

    removeExternal.mutate(
      { type: targetType, id: targetId },
      {
        onSuccess: () =>
          toast(t("common.removed_from_library_success"), "info", {
            description: detail.title || undefined,
          }),
        onError: () =>
          toast(t("common.failed_to_remove_library"), "error"),
      },
    );
  }, [detail, pathname, searchParams, navigate, removeExternal, toast, t, close]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={400}>
      <div className="px-[20px] pb-[20px]">
        {detail && (
          <div className="flex items-center gap-[16px] mb-[20px]">
            <div
              className={`relative h-[80px] w-[80px] shrink-0 overflow-hidden ${
                detail.type === "artist" ? "rounded-full" : "rounded-md"
              } bg-border-alpha-14`}
            >
              {detail.coverUrl && (
                <CoverImage
                  src={detail.coverUrl}
                  alt={detail.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[16px] font-[500] text-text-primary truncate">
                {detail.title}
              </span>
              <span className="text-[14px] text-text-tertiary capitalize">
                {detail.type}
              </span>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleRemove}
          disabled={removeExternal.isPending}
          className="w-full !bg-accent-secondary !text-bg-primary hover:!opacity-90"
        >
          {removeExternal.isPending ? (
            <span className="inline-flex items-center gap-[8px]">
              <span className="inline-block h-[16px] w-[16px] rounded-full border-[2px] border-white/30 border-t-white animate-spin" />
              {t("common.removing")}
            </span>
          ) : (
            t("common.remove_from_library")
          )}
        </Button>
      </div>
    </Dialog>
  );
}

export default function RemoveFromLibraryModal() {
  return (
    <Suspense fallback={null}>
      <RemoveFromLibraryModalContent />
    </Suspense>
  );
}
