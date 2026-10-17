import { useState, useEffect, useRef } from "react";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import { CameraLine, Delete2Line, MusicLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { linerDb } from "@/shared/storage";
import { usePlayerStore } from "@/features/player";
import { useToast } from "@/shared/ui";
import type { Track } from "@/shared/types";
import { updateTrackInOfflinePlaylists } from "@/shared/storage/offlinePlaylists";

export default function EditTrackMetadataModal() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const open = useModalStore((state) => state.editTrackMetadataOpen);
  const detail = useModalStore((state) => state.editTrackMetadataDetail);
  const close = useModalStore((state) => state.closeEditTrackMetadata);

  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [albumTitle, setAlbumTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && detail) {
      setTitle(detail.title || "");
      setArtists(detail.artists || "");
      setAlbumTitle(detail.albumTitle || "");
      setCoverUrl(detail.coverUrl || "");
      setIsSaving(false);
    }
  }, [open, detail]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast(t("common.invalid_image"), "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setCoverUrl(res);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveCover = () => {
    setCoverUrl("");
  };

  const handleSave = async () => {
    if (!detail || isSaving) return;
    setIsSaving(true);

    try {
      const updatedTrack: Track = {
        id: detail.id,
        title: title.trim() || detail.title,
        artists: artists.trim() || detail.artists,
        album: albumTitle.trim() ? { id: "", title: albumTitle.trim() } : undefined,
        coverUrl: coverUrl.trim(),
        durationMs: detail.durationMs ?? 0,
        playCount: 0,
      };

      await linerDb.putTrack(updatedTrack);
      updateTrackInOfflinePlaylists(updatedTrack);

      const playerState = usePlayerStore.getState();
      if (playerState.currentTrack && playerState.currentTrack.id === detail.id) {
        usePlayerStore.setState({
          currentTrack: {
            ...playerState.currentTrack,
            title: updatedTrack.title,
            artists: updatedTrack.artists,
            album: updatedTrack.album,
            coverUrl: updatedTrack.coverUrl,
          },
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("liner:cache_changed"));
        window.dispatchEvent(new Event("library:changed"));
      }

      toast(t("common.metadata_saved"), "checkmark", {
        description: updatedTrack.title,
      });

      close();
    } catch (err) {
      console.error("[EditTrackMetadataModal] Save error:", err);
      toast(t("common.failed_to_save"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={420}
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
            {t("common.edit_track_metadata")}
          </p>
          <p
            className="text-text-tertiary text-[12px] m-0 font-[350]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.edit_track_metadata_desc")}
          </p>
        </div>

        {/* Hidden Cover File Input */}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverChange}
        />

        {/* Content Layout: Cover on left, inputs on right */}
        <div className="flex flex-row gap-4 items-start pt-1">
          {/* Cover Art Box */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div
              onClick={() => coverInputRef.current?.click()}
              className="group relative w-[100px] h-[100px] rounded-xl overflow-hidden bg-bg-panel border border-border-primary/50 cursor-pointer flex items-center justify-center select-none"
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title || "Cover"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                />
              ) : (
                <MusicLine size={32} className="text-text-tertiary" />
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[11px] font-[500]">
                <CameraLine size={20} />
                <span>{t("common.change_cover")}</span>
              </div>
            </div>

            {coverUrl && (
              <button
                type="button"
                onClick={handleRemoveCover}
                className="text-[11.5px] text-accent-secondary hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
              >
                <Delete2Line size={12} />
                <span>{t("common.remove_cover")}</span>
              </button>
            )}
          </div>

          {/* Text Fields */}
          <div className="flex flex-col gap-2.5 flex-1 min-w-0">
            <div className="flex flex-col gap-1">
              <label
                className="text-[11.5px] font-[500] text-text-secondary"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {t("common.title")}
              </label>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("common.title_placeholder")}
                size="sm"
                className="!h-[32px] !rounded-md"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="text-[11.5px] font-[500] text-text-secondary"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {t("common.artist")}
              </label>
              <TextInput
                value={artists}
                onChange={(e) => setArtists(e.target.value)}
                placeholder={t("common.artist_placeholder")}
                size="sm"
                className="!h-[32px] !rounded-md"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="text-[11.5px] font-[500] text-text-secondary"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {t("common.album")}
              </label>
              <TextInput
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                placeholder={t("common.album_placeholder")}
                size="sm"
                className="!h-[32px] !rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary/30">
          <Button
            variant="outline"
            onClick={close}
            disabled={isSaving}
            className="!h-[34px] !text-[13px] px-3"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="!h-[34px] !text-[13px] px-4"
          >
            {isSaving ? t("common.saving") : t("common.save_changes")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
