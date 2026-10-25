import { Suspense, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  useToast,
  DialogActions,
  DialogButton,
  DialogHeader,
} from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
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
      { type: targetType, id: targetId, isOwned: detail.isOwned },
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
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={380}>
      <div className="flex flex-col px-[20px] pb-[20px]">
        <DialogHeader
          className="mb-[16px]"
          title={t("common.are_you_sure")}
          description={
            detail?.isOwned && detail?.type === "playlist"
              ? t("common.delete_playlist_desc")
              : t("common.remove_from_library_desc")
          }
        />

        {/* Target item preview */}
        {detail && (
          <div className="flex items-center gap-[14px] p-[10px] rounded-[14px] bg-black/[0.05] dark:bg-white/[0.07] mb-[20px]">
            <div
              className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden ${
                detail.type === "artist" ? "rounded-full" : "rounded-md"
              } bg-border-alpha-14`}
            >
              {detail.coverUrl && (
                <CoverImage
                  src={detail.coverUrl}
                  alt={detail.title}
                  fill
                  sizes="52px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="flex flex-col min-w-0 gap-[2px]">
              <span className="text-[14px] font-[500] text-text-primary truncate">
                {detail.title}
              </span>
              <span className="text-[12px] text-text-tertiary capitalize">
                {detail.subtitle || detail.type}
              </span>
            </div>
          </div>
        )}

        <DialogActions>
          <DialogButton onClick={close} disabled={removeExternal.isPending}>
            {t("common.cancel")}
          </DialogButton>
          <DialogButton
            variant="danger"
            onClick={handleRemove}
            loading={removeExternal.isPending}
          >
            {removeExternal.isPending ? t("common.removing") : t("common.confirm")}
          </DialogButton>
        </DialogActions>
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
