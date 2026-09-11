import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { PlaylistFill, Search2Line, CloseCircleFill, AddLine } from "@mingcute/react";
import { useToast } from "@/shared/ui";
import TextInput from "@/shared/ui/TextInput";
import Dialog from "@/shared/ui/Dialog";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";
import { useAddPlaylistTracks, usePlaylistsList } from "../../hooks";
import { useModalStore } from "../../store/modalStore";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export default function AddToPlaylistModal() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const open = useModalStore((state) => state.addToPlaylistOpen);
  const track = useModalStore((state) => state.addToPlaylistTrack);
  const close = useModalStore((state) => state.closeAddToPlaylist);
  const openCreatePlaylist = useModalStore((state) => state.openCreatePlaylist);

  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrollMask, setScrollMask] = useState(
    "linear-gradient(to bottom, black 0%, black 100%)",
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: playlistData } = usePlaylistsList();
  const addTrack = useAddPlaylistTracks();

  const rawPlaylists = track?.playlists ?? playlistData?.playlists ?? [];

  const playlists = useMemo(() => {
    if (!searchQuery.trim()) return rawPlaylists;
    const q = searchQuery.toLowerCase().trim();
    return rawPlaylists.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ? p.description.toLowerCase().includes(q) : false),
    );
  }, [rawPlaylists, searchQuery]);

  // update dynamic top and bottom scroll fade mask
  const updateScrollMask = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const showTop = scrollTop > 4;
    const showBottom = scrollTop + clientHeight < scrollHeight - 4;

    let stops = "";
    if (showTop) stops += "transparent 0%, black 6%, ";
    else stops += "black 0%, black 6%, ";
    if (showBottom) stops += "black 94%, transparent 100%";
    else stops += "black 94%, black 100%";

    setScrollMask(`linear-gradient(to bottom, ${stops})`);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (rawPlaylists.length >= 5) {
      updateScrollMask();
    }
  }, [open, rawPlaylists.length, playlists.length, updateScrollMask]);

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

  const handleNewPlaylist = () => {
    // capture the track before close() clears it from the store, so it can
    // be handed off to the create/import playlist flow and added once ready
    const pendingTrack = track;
    close();
    openCreatePlaylist(undefined, pendingTrack);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={400}>
      {/* outer gutters live here (12px); rows bleed only 8px on hover so
          cover art sits at the same 20px inset as the header text */}
      <div className="flex flex-col gap-[12px] px-[12px] pb-[12px]">
        <div className="px-[8px] pt-[4px]">
          <h2
            className="m-0 text-[18px] font-[600] tracking-[-0.01em] text-text-primary"
            style={font}
          >
            {t("common.add_to_playlist")}
          </h2>
          {track && (
            <div className="mt-[10px] flex items-center gap-[10px] rounded-md bg-bg-elevated/60 px-[10px] py-[8px]">
              <div className="relative h-[40px] w-[40px] shrink-0 overflow-hidden rounded-md bg-bg-elevated flex items-center justify-center">
                {track.coverUrl ? (
                  <CoverImage
                    src={track.coverUrl}
                    alt={track.title}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-[15px] font-[600] text-text-tertiary" style={font}>
                    {track.title.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                <span className="truncate text-[13px] font-[500] text-text-primary" style={font}>
                  {track.title}
                </span>
                <span className="truncate text-[12px] text-text-tertiary" style={font}>
                  {track.artists}
                </span>
              </div>
            </div>
          )}
        </div>

        {rawPlaylists.length >= 5 && (
          <div className="px-[8px]">
            <TextInput
              size="sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("library.search_playlists")}
              icon={<Search2Line size={16} />}
              rightSlot={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="border-none bg-transparent p-0 text-text-tertiary hover:text-text-primary cursor-pointer flex items-center justify-center"
                  >
                    <CloseCircleFill size={15} />
                  </button>
                ) : null
              }
              className="!h-[36px] w-full rounded-md !border-transparent bg-bg-elevated text-[13px]"
            />
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={rawPlaylists.length >= 5 ? updateScrollMask : undefined}
          style={
            rawPlaylists.length >= 5
              ? {
                  WebkitMaskImage: scrollMask,
                  maskImage: scrollMask,
                }
              : undefined
          }
          className="flex flex-col gap-[2px] max-h-[300px] overflow-y-auto"
        >
          {playlists.length > 0 ? (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                disabled={addingTo !== null}
                onClick={() => handleAddToPlaylist(playlist.id)}
                className="flex items-center gap-[12px] p-[8px] rounded-md transition-colors hover:bg-bg-elevated active:bg-border-alpha-14 text-left group w-full border-none bg-transparent cursor-pointer disabled:opacity-50"
              >
                <div className="relative h-[44px] w-[44px] rounded-lg bg-bg-elevated overflow-hidden shrink-0 flex items-center justify-center">
                  {playlist.coverUrl ? (
                    <CoverImage
                      src={playlist.coverUrl}
                      alt={playlist.title}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <PlaylistFill size={20} className="text-text-tertiary" />
                  )}
                </div>

                <div className="flex flex-col gap-[1px] min-w-0 flex-1">
                  <span
                    className="text-[13px] font-[500] text-text-primary truncate"
                    style={font}
                  >
                    {playlist.title}
                  </span>
                  <span
                    className="text-[12px] text-text-tertiary tabular-nums"
                    style={font}
                  >
                    {t("common.tracks", { count: playlist.trackCount })}
                  </span>
                </div>

                {addingTo === playlist.id ? (
                  <span className="h-[14px] w-[14px] animate-spin rounded-full border-[2px] border-text-tertiary border-t-text-primary shrink-0" />
                ) : (
                  <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors group-hover:bg-border-alpha-14 group-hover:text-text-primary">
                    <AddLine size={18} />
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="mx-[8px] flex flex-col items-center gap-[8px] rounded-md bg-bg-elevated/60 px-[12px] py-[24px] text-center">
              <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-bg-elevated text-text-tertiary">
                <PlaylistFill size={18} />
              </span>
              <p className="m-0 text-[13px] text-text-secondary" style={font}>
                {searchQuery
                  ? t("common.try_another_search_clear")
                  : t("common.no_playlists_yet")}
              </p>
            </div>
          )}
        </div>

        <div className="px-[8px]">
          <button
            type="button"
            onClick={handleNewPlaylist}
            className="flex h-[36px] w-full items-center justify-center gap-[6px] rounded-md border border-border-primary bg-transparent text-[13px] font-[500] text-text-primary transition-colors hover:bg-bg-elevated cursor-pointer"
            style={font}
          >
            <AddLine size={16} />
            {t("library.create_playlist")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
