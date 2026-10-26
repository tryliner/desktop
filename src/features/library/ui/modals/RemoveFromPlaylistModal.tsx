import { useCallback } from "react";
import {
  useToast,
  DialogActions,
  DialogButton,
  DialogHeader,
} from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useRemovePlaylistTracks } from "../../hooks";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";

export default function RemoveFromPlaylistModal() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const open = useModalStore((state) => state.removeFromPlaylistOpen);
  const detail = useModalStore((state) => state.removeFromPlaylistDetail);
  const close = useModalStore((state) => state.closeRemoveFromPlaylist);

  const removeTracks = useRemovePlaylistTracks();

  const handleRemove = useCallback(() => {
    if (!detail || !detail.playlistId || !detail.playlistItemId) {
      close();
      return;
    }

    removeTracks.mutate({
      playlistId: detail.playlistId,
      itemId: detail.playlistItemId,
    });
    toast(t("common.removed_from_playlist"), "info", {
      description: detail.trackTitle || undefined,
    });
    close();
  }, [detail, toast, removeTracks, t, close]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={380}>
      <div className="flex flex-col px-[20px] pb-[20px]">
        <DialogHeader
          className="mb-[16px]"
          title={t("common.are_you_sure")}
          description={t("common.remove_track_from_playlist_desc")}
        />

        {/* Track preview */}
        {detail && (
          <div className="flex items-center gap-[14px] p-[10px] rounded-[14px] bg-black/[0.05] dark:bg-white/[0.07] mb-[20px]">
            <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md bg-border-alpha-14">
              {detail.trackCoverUrl && (
                <CoverImage
                  src={detail.trackCoverUrl}
                  alt={detail.trackTitle}
                  fill
                  sizes="52px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="flex flex-col min-w-0 gap-[2px]">
              <span className="text-[14px] font-[500] text-text-primary truncate">
                {detail.trackTitle}
              </span>
              <span className="text-[12px] text-text-tertiary truncate">
                {detail.trackArtists}
              </span>
            </div>
          </div>
        )}

        <DialogActions>
          <DialogButton onClick={close} disabled={removeTracks.isPending}>
            {t("common.cancel")}
          </DialogButton>
          <DialogButton
            variant="danger"
            onClick={handleRemove}
            loading={removeTracks.isPending}
            disabled={!detail?.playlistId || !detail?.playlistItemId}
          >
            {removeTracks.isPending ? t("common.removing") : t("common.confirm")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
