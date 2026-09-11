import { useState } from "react";
import { PlaylistFill } from "@mingcute/react";
import { useToast } from "@/shared/ui";
import Dialog from "@/shared/ui/Dialog";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";
import { useAddPlaylistTracks, usePlaylistsList } from "../../hooks";
import { useModalStore } from "../../store/modalStore";

export default function AddToPlaylistModal() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const open = useModalStore((state) => state.addToPlaylistOpen);
  const track = useModalStore((state) => state.addToPlaylistTrack);
  const close = useModalStore((state) => state.closeAddToPlaylist);

  const [addingTo, setAddingTo] = useState<string | null>(null);
  const { data: playlistData } = usePlaylistsList();
  const addTrack = useAddPlaylistTracks();

  const playlists = track?.playlists ?? playlistData.playlists;

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!track) return;
    setAddingTo(playlistId);
    try {
      await addTrack.mutateAsync({ playlistId, trackId: track.id });
      toast(t("common.added_to_playlist"), "success");
      close();
    } catch {
      toast(t("common.failed_add_playlist"), "error");
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={360}>
      <div className="flex flex-col gap-[16px] px-[20px] pb-[16px]">
        <div>
          <h2
            className="m-0 text-[18px] font-[500] text-text-primary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.add_to_playlist")}
          </h2>
          {track && (
            <p
              className="m-0 mt-[2px] text-[13px] text-text-tertiary truncate"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {track.title} • {track.artists}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-[4px] max-h-[300px] overflow-y-auto -mx-[8px] px-[8px]">
          {playlists.length > 0 ? (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                disabled={addingTo !== null}
                onClick={() => handleAddToPlaylist(playlist.id)}
                className="flex items-center gap-[12px] p-[8px] rounded-lg transition-colors hover:bg-border-alpha-14 text-left group w-full border-none bg-transparent cursor-pointer disabled:opacity-50"
              >
                <div className="h-[40px] w-[40px] rounded-md bg-border-alpha-14 overflow-hidden shrink-0 flex items-center justify-center relative">
                  {playlist.coverUrl ? (
                    <CoverImage
                      src={playlist.coverUrl}
                      alt={playlist.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <PlaylistFill size={20} className="text-text-tertiary" />
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="text-[14px] font-[500] text-text-primary truncate"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    {playlist.title}
                  </span>
                  <span
                    className="text-[12px] text-text-tertiary"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    {t("common.tracks", { count: playlist.trackCount })}
                  </span>
                </div>

                {addingTo === playlist.id && (
                  <span className="h-[14px] w-[14px] animate-spin rounded-full border-[2px] border-text-tertiary border-t-text-primary shrink-0" />
                )}
              </button>
            ))
          ) : (
            <div className="py-[24px] text-center text-text-tertiary text-[13px]">
              {t("common.no_playlists_yet")}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
