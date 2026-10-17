import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import Select from "@/shared/ui/Select";
import {
  Upload2Line,
  MusicLine,
  CloseLine,
  CheckLine,
  WifiOffLine,
  PlaylistLine,
  AddLine,
} from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import {
  importAudioFilesToCache,
  isAudioFile,
} from "@/shared/utils/localAudioImporter";
import {
  getOfflinePlaylists,
  addTrackToOfflinePlaylist,
  createOfflinePlaylist,
  type OfflinePlaylist,
} from "@/shared/storage/offlinePlaylists";
import { useToast } from "@/shared/ui";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export default function ImportAudioModal() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const open = useModalStore((state) => state.importAudioOpen);
  const initialFiles = useModalStore((state) => state.importAudioInitialFiles);
  const targetPlaylistIdFromStore = useModalStore(
    (state) => state.importAudioTargetPlaylistId,
  );
  const close = useModalStore((state) => state.closeImportAudio);

  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [offlinePlaylists, setOfflinePlaylists] = useState<OfflinePlaylist[]>([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>("new");
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessResult, setImportSuccessResult] = useState<{
    count: number;
    playlistId: string;
    playlistTitle: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const playlists = getOfflinePlaylists();
      setOfflinePlaylists(playlists);

      if (initialFiles && initialFiles.length > 0) {
        const valid = initialFiles.filter(isAudioFile);
        setStagedFiles(valid);
      } else {
        setStagedFiles([]);
      }

      if (
        targetPlaylistIdFromStore &&
        playlists.some((p) => p.id === targetPlaylistIdFromStore)
      ) {
        setTargetPlaylistId(targetPlaylistIdFromStore);
      } else if (playlists.length > 0) {
        setTargetPlaylistId(playlists[0].id);
      } else {
        setTargetPlaylistId("new");
      }

      setNewPlaylistTitle("");
      setIsImporting(false);
      setImportSuccessResult(null);
      setIsDragOver(false);
    }
  }, [open, initialFiles, targetPlaylistIdFromStore]);

  const selectOptions = useMemo(() => {
    const list: Array<{ value: string; label: string; icon?: React.ReactNode }> =
      offlinePlaylists.map((pl) => ({
        value: pl.id,
        label: `${pl.title} (${pl.tracks.length} ${t("common.songs")})`,
        icon: <PlaylistLine size={14} className="text-text-tertiary" />,
      }));
    list.push({
      value: "new",
      label: t("playlist.create_new_offline_playlist"),
      icon: <AddLine size={14} className="text-accent" />,
    });
    return list;
  }, [offlinePlaylists, t]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(isAudioFile);
    if (list.length === 0) {
      toast(t("playlist.no_audio_files_found"), "info");
      return;
    }
    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const newItems = list.filter((f) => !existingNames.has(`${f.name}_${f.size}`));
      return [...prev, ...newItems];
    });
    setImportSuccessResult(null);
  }, [t, toast]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (stagedFiles.length === 0 || isImporting) return;
    setIsImporting(true);

    try {
      const imported = await importAudioFilesToCache(stagedFiles);
      if (imported.length === 0) {
        toast(t("playlist.no_audio_files_found"), "info");
        return;
      }

      let destId = targetPlaylistId;
      let destTitle = "";

      if (destId === "new" || !destId || offlinePlaylists.length === 0) {
        const fallbackTitle =
          newPlaylistTitle.trim() ||
          t("playlist.default_local_playlist") ||
          "Local Music";
        const newPl = createOfflinePlaylist(fallbackTitle, undefined, imported[0]);
        for (let i = 1; i < imported.length; i++) {
          addTrackToOfflinePlaylist(newPl.id, imported[i]);
        }
        destId = newPl.id;
        destTitle = newPl.title;
      } else {
        const pl = offlinePlaylists.find((p) => p.id === destId);
        destTitle = pl?.title || "";
        for (const tr of imported) {
          addTrackToOfflinePlaylist(destId, tr);
        }
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("library:changed"));
        window.dispatchEvent(new CustomEvent("liner:cache_changed"));
      }

      setImportSuccessResult({
        count: imported.length,
        playlistId: destId,
        playlistTitle: destTitle,
      });

      toast(
        t("playlist.imported_audio", { count: imported.length }),
        "checkmark",
        {
          description: destTitle,
        },
      );
    } catch (err) {
      console.error("[ImportAudioModal] Import failed:", err);
      toast(t("playlist.import_failed"), "error");
    } finally {
      setIsImporting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={460}
    >
      <div className="flex flex-col gap-[14px] px-[18px] pb-[18px] pt-[2px]">
        {/* Header */}
        <div className="flex flex-col gap-[2px]">
          <p
            className="text-text-primary text-[15px] font-[600] m-0"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {t("common.import_audio_modal_title")}
          </p>
          <p
            className="text-text-tertiary text-[12.5px] m-0 font-[350]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.import_audio_modal_desc")}
          </p>
        </div>

        {importSuccessResult !== null ? (
          /* Success Screen */
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckLine size={28} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-[500] text-text-primary m-0">
                {t("common.import_success", { count: importSuccessResult.count })}
              </p>
              <p className="text-[12.5px] text-text-tertiary m-0">
                {t("playlist.added_to_playlist_desc", {
                  playlist: importSuccessResult.playlistTitle,
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3 w-full">
              <Button
                variant="outline"
                onClick={close}
                className="flex-1 !h-[34px] !text-[13px]"
              >
                {t("common.close")}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  close();
                  navigate(
                    `/library/playlist?id=${encodeURIComponent(
                      importSuccessResult.playlistId,
                    )}`,
                  );
                }}
                className="flex-1 !h-[34px] !text-[13px]"
              >
                {t("common.go_to_playlist")}
              </Button>
            </div>
          </div>
        ) : (
          /* Staging & Drop Zone */
          <div className="flex flex-col gap-[12px]">
            {/* Hidden Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.opus,.aac,.webm"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  addFiles(e.dataTransfer.files);
                }
              }}
              className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none ${
                isDragOver
                  ? "border-accent bg-accent/10"
                  : "border-border-primary/60 hover:border-text-secondary/60 bg-bg-panel/40 hover:bg-bg-panel/80"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-border-alpha-14 flex items-center justify-center text-text-primary mb-2">
                <Upload2Line size={20} />
              </div>
              <p className="text-[13px] font-[500] text-text-primary m-0 text-center">
                {t("common.drag_drop_here")}
              </p>
              <p className="text-[11.5px] text-text-tertiary mt-1 m-0 text-center">
                MP3, WAV, FLAC, M4A, OGG, OPUS, AAC
              </p>
            </div>

            {/* Staged Files List */}
            {stagedFiles.length > 0 && (
              <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto overscroll-contain pr-1">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[12px] font-[500] text-text-secondary">
                    {t("common.tracks", { count: stagedFiles.length })}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStagedFiles([]);
                    }}
                    className="text-[11.5px] text-text-tertiary hover:text-text-primary bg-transparent border-0 cursor-pointer p-0"
                  >
                    {t("common.clear_all")}
                  </button>
                </div>

                {stagedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-bg-panel border border-border-primary/40 text-[12.5px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MusicLine size={14} className="shrink-0 text-text-tertiary" />
                      <span className="truncate text-text-primary font-[450]">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-text-tertiary">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={isImporting}
                      className="shrink-0 p-1 rounded hover:bg-border-alpha-14 text-text-tertiary hover:text-text-primary bg-transparent border-0 cursor-pointer transition-colors"
                    >
                      <CloseLine size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Destination Offline Playlist Picker (NO cached storage permitted) */}
            <div className="flex flex-col gap-[8px] pt-1">
              <label
                className="text-[12px] font-[500] text-text-secondary flex items-center justify-between"
                style={font}
              >
                <span className="flex items-center gap-[5px]">
                  <WifiOffLine size={13} className="text-amber-400" />
                  {t("common.destination_playlist")}
                </span>
              </label>

              {offlinePlaylists.length > 0 && (
                <Select
                  options={selectOptions}
                  value={targetPlaylistId}
                  onChange={(val) => setTargetPlaylistId(val)}
                  disabled={isImporting}
                  className="w-full"
                  align="bottom-left"
                />
              )}

              {(offlinePlaylists.length === 0 || targetPlaylistId === "new") && (
                <div className="flex flex-col gap-[6px]">
                  <TextInput
                    placeholder={t("common.new_playlist_name_placeholder")}
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    disabled={isImporting}
                    className="w-full"
                    maxLength={40}
                    autoFocus={offlinePlaylists.length > 0}
                  />
                  <span className="text-[11px] text-text-tertiary" style={font}>
                    {t("playlist.create_new_offline_playlist_hint")}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={close}
                disabled={isImporting}
                className="!h-[34px] !text-[13px] px-3"
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={stagedFiles.length === 0 || isImporting}
                className="!h-[34px] !text-[13px] px-4 flex items-center gap-1.5"
              >
                {isImporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t("playlist.importing_audio")}</span>
                  </>
                ) : (
                  <>
                    <Upload2Line size={14} />
                    <span>
                      {t("common.import_files_action", {
                        count: stagedFiles.length,
                      })}
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
