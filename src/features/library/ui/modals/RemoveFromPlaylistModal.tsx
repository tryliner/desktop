import { useCallback } from "react";
import { useToast } from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
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
        {/* Header */}
        <div className="flex flex-col gap-[2px] mb-[16px]">
          <h3
            className="text-[16px] font-[600] text-text-primary m-0"
            style={{ fontFamily: "var(--font-inter), sans-serif", letterSpacing: "-0.01em" }}
          >
            {t("common.are_you_sure")}
          </h3>
          <p
            className="text-[13px] text-text-tertiary m-0 leading-normal"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.remove_track_from_playlist_desc")}
          </p>
        </div>

        {/* Track preview */}
        {detail && (
          <div className="flex items-center gap-[14px] p-[10px] rounded-lg bg-border-alpha-14 mb-[20px]">
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

        {/* 1-row actions: cancel + confirm */}
        <div className="flex items-center gap-[10px]">
          <Button
            variant="secondary"
            onClick={close}
            disabled={removeTracks.isPending}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>

          <Button
            variant="primary"
            onClick={handleRemove}
            disabled={removeTracks.isPending || !detail?.playlistId || !detail?.playlistItemId}
            className="flex-1 !bg-accent-secondary !text-bg-primary hover:!opacity-90"
          >
            {removeTracks.isPending ? (
              <span className="inline-flex items-center gap-[6px]">
                <span className="inline-block h-[14px] w-[14px] rounded-full border-[2px] border-btn-primary-text/30 border-t-btn-primary-text animate-spin" />
                {t("common.removing")}
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
