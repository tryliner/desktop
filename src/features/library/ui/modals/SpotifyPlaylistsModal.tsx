import { useEffect, useState } from "react";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import { Search2Line, Refresh1Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import { useSpotifyAuthStore } from "../../store/spotifyAuthStore";
import type { SpotifyUserPlaylistSummary } from "../../services/import/sources/spotify/spotifyOAuth";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export default function SpotifyPlaylistsModal() {
  const { t } = useTranslation();
  const open = useModalStore((state) => state.spotifyPlaylistsOpen);
  const close = useModalStore((state) => state.closeSpotifyPlaylists);

  const status = useSpotifyAuthStore((state) => state.status);
  const playlists = useSpotifyAuthStore((state) => state.playlists);
  const loading = useSpotifyAuthStore((state) => state.loadingPlaylists);
  const initiateAuth = useSpotifyAuthStore((state) => state.initiateAuth);
  const loadUserPlaylists = useSpotifyAuthStore((state) => state.loadUserPlaylists);
  const disconnect = useSpotifyAuthStore((state) => state.disconnect);

  const [searchQuery, setSearchQuery] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open && status === "connected" && playlists.length === 0 && !loading) {
      void loadUserPlaylists().catch((err: any) => {
        setErrorMessage(err?.message || "Failed to load playlists");
      });
    }
  }, [open, status, playlists.length, loading, loadUserPlaylists]);

  const handleConnect = async () => {
    setErrorMessage(null);
    try {
      const authUrl = await initiateAuth();
      if (typeof window !== "undefined") {
        const electron = (window as unknown as { linerElectron?: { openExternal?: (url: string) => void } }).linerElectron;
        if (electron?.openExternal) {
          electron.openExternal(authUrl);
        } else {
          window.open(authUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to start Spotify authentication");
    }
  };

  const handleRefresh = async () => {
    setErrorMessage(null);
    try {
      await loadUserPlaylists();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to refresh playlists");
    }
  };

  const handleImportPlaylist = async (playlist: SpotifyUserPlaylistSummary) => {
    if (importingId) return;
    setImportingId(playlist.id);
    setErrorMessage(null);

    try {
      await useImportStore.getState().startImport(playlist.spotifyUrl);
      close();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to import Spotify playlist");
    } finally {
      setImportingId(null);
    }
  };

  const filteredPlaylists = playlists.filter((pl) =>
    pl.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={560}>
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px]" style={font}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-[12px]">
          <div>
            <h2 className="m-0 text-[18px] font-[600] text-text-primary">
              Spotify Playlists
            </h2>
            <p className="m-0 mt-[2px] text-[13px] text-text-tertiary">
              Browse and import playlists from your Spotify account
            </p>
          </div>
          {status === "connected" && (
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={loading}
                aria-label="Refresh playlists"
                className="flex items-center justify-center h-[30px] w-[30px] rounded-md border border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition cursor-pointer"
              >
                <Refresh1Line className={`text-[16px] ${loading ? "animate-spin" : ""}`} />
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={disconnect}
                className="!text-[12px]"
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="rounded-md bg-accent-secondary/10 border border-accent-secondary/30 p-[10px] text-[12px] text-accent-secondary">
            {errorMessage}
          </div>
        )}

        {/* Disconnected State */}
        {status !== "connected" ? (
          <div className="flex flex-col items-center justify-center py-[32px] text-center gap-[12px]">
            <div className="flex items-center justify-center w-[52px] h-[52px] rounded-full bg-[#1DB954]/15 text-[#1DB954]">
              <svg className="w-[28px] h-[28px] fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.306c-.215.353-.674.466-1.027.25-2.815-1.72-6.357-2.109-10.53-1.155-.403.092-.807-.156-.899-.56-.092-.403.156-.807.56-.899 4.568-1.044 8.503-.6 11.646 1.336.353.216.466.674.25 1.028zm1.467-3.262c-.27.441-.845.58-1.286.31-3.224-1.982-8.14-2.556-11.954-1.398-.498.151-1.03-.135-1.181-.633-.151-.498.135-1.03.633-1.181 4.364-1.324 9.791-.684 13.478 1.583.441.27.58.845.31 1.286zm.126-3.41c-3.864-2.294-10.245-2.506-13.926-1.388-.592.18-1.226-.154-1.406-.746-.18-.592.154-1.226.746-1.406 4.234-1.285 11.283-1.036 15.733 1.606.533.316.708 1.011.392 1.544-.316.533-1.011.708-1.539.39z" />
              </svg>
            </div>
            <div>
              <p className="m-0 text-[15px] font-[500] text-text-primary">
                Connect your Spotify account
              </p>
              <p className="m-0 mt-[4px] text-[13px] text-text-tertiary max-w-[360px]">
                Access your public, private, and collaborative playlists directly inside Liner.
              </p>
            </div>
            <Button
              variant="primary"
              size="default"
              onClick={() => void handleConnect()}
              disabled={status === "connecting"}
              className="mt-[8px] !bg-[#1DB954] hover:!bg-[#1ed760] !text-black font-[600]"
            >
              {status === "connecting" ? "Connecting..." : "Connect Spotify"}
            </Button>
          </div>
        ) : (
          /* Connected State: Playlist browser */
          <div className="flex flex-col gap-[12px]">
            {/* Search Input */}
            <div className="relative">
              <TextInput
                type="text"
                placeholder="Filter playlists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                className="pl-[32px] !rounded-md"
              />
              <Search2Line className="absolute left-[10px] top-[9px] text-[15px] text-text-tertiary pointer-events-none" />
            </div>

            {/* Playlists List */}
            <div className="flex flex-col gap-[8px] max-h-[360px] overflow-y-auto pr-[4px]">
              {loading && playlists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-[48px] text-text-tertiary gap-[8px]">
                  <span className="inline-block h-[20px] w-[20px] rounded-full border-[2px] border-border-subtle border-t-text-primary animate-spin" />
                  <span className="text-[13px]">Loading playlists...</span>
                </div>
              ) : filteredPlaylists.length === 0 ? (
                <div className="py-[32px] text-center text-text-tertiary text-[13px]">
                  {searchQuery ? "No matching playlists found." : "No playlists found in your Spotify account."}
                </div>
              ) : (
                filteredPlaylists.map((playlist) => {
                  const isImporting = importingId === playlist.id;
                  const coverImage = playlist.images[0]?.url;

                  return (
                    <div
                      key={playlist.id}
                      className="flex items-center justify-between p-[8px] rounded-lg bg-bg-surface/50 hover:bg-bg-elevated border border-border-subtle/50 transition"
                    >
                      <div className="flex items-center gap-[12px] min-w-0">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={playlist.name}
                            className="w-[44px] h-[44px] rounded object-cover flex-shrink-0 bg-bg-surface"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-[44px] h-[44px] rounded bg-bg-surface flex items-center justify-center text-text-tertiary text-[18px] flex-shrink-0">
                            🎵
                          </div>
                        )}
                        <div className="min-w-0 flex flex-col">
                          <p className="m-0 text-[14px] font-[500] text-text-primary truncate">
                            {playlist.name}
                          </p>
                          <div className="flex items-center gap-[8px] text-[12px] text-text-tertiary">
                            <span>{playlist.tracksCount} tracks</span>
                            <span>•</span>
                            <span className="capitalize">{playlist.isPublic ? "Public" : "Private"}</span>
                            {playlist.ownerName && (
                              <>
                                <span>•</span>
                                <span className="truncate">by {playlist.ownerName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleImportPlaylist(playlist)}
                        disabled={isImporting || Boolean(importingId)}
                        className="flex-shrink-0 ml-[12px] !rounded-md !text-[12px]"
                      >
                        {isImporting ? (
                          <span className="inline-block h-[12px] w-[12px] rounded-full border-[2px] border-text-primary/30 border-t-text-primary animate-spin" />
                        ) : (
                          "Import"
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
