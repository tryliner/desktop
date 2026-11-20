import { useEffect, useRef } from "react";
import Dialog from "@/shared/ui/Dialog";
import {
  DialogActions,
  DialogButton,
  DialogHeader,
  showToast,
} from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useCoverEditorStore } from "./coverEditorStore";
import { coverErrorMessage } from "./coverErrors";
import { useCoverImage } from "./useCoverImage";
import { useCropState } from "./useCropState";
import { useCoverEditorActions } from "./useCoverEditorActions";
import { CoverCropArea } from "./CoverCropArea";
import { CoverZoomBar } from "./CoverZoomBar";
import { CoverSongPicks } from "./CoverSongPicks";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";

export default function PlaylistCoverEditorModal() {
  const { t } = useTranslation();
  const editor = useCoverEditorStore();
  const { open, initialFile, currentCover, trackCovers } = editor;
  const fileInput = useRef<HTMLInputElement>(null);

  const cover = useCoverImage((error) =>
    showToast(
      coverErrorMessage(error, t, "playlist_cover.error_load"),
      "error",
    ),
  );
  const { image, loadBlob, clear } = cover;
  const crop = useCropState(image?.size ?? null);
  const { reset } = crop;
  const actions = useCoverEditorActions(editor, image, crop);
  const busy = cover.loading || actions.saving;

  useEffect(() => reset(), [image, reset]);
  useEffect(() => {
    if (open && initialFile) void loadBlob(initialFile);
  }, [open, initialFile, loadBlob]);
  useEffect(() => {
    if (!open) clear();
  }, [open, clear]);
  useEffect(() => {
    if (!open) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((f) =>
        f.type.startsWith("image/"),
      );
      if (!file) return;
      event.preventDefault();
      void loadBlob(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, loadBlob]);

  const choose = () => fileInput.current?.click();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? editor.close() : undefined)}
      maxWidth={420}
    >
      <div
        className="flex flex-col gap-[16px] px-[20px] pb-[20px] pt-[4px]"
        data-own-drop="screen"
      >
        <DialogHeader
          title={t("playlist_cover.title")}
          description={editor.playlistTitle}
        />
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void loadBlob(file);
          }}
        />
        <CoverCropArea
          image={image}
          crop={crop}
          busy={busy}
          currentCover={currentCover}
          onChoose={choose}
          onFile={(file) => void loadBlob(file)}
        />
        {image && !image.animated && (
          <CoverZoomBar crop={crop} onChange={choose} />
        )}
        {image?.animated && (
          <p className="m-0 text-caption text-text-tertiary">
            {t("playlist_cover.animated_note")}
          </p>
        )}
        {!image && (
          <CoverSongPicks
            covers={trackCovers}
            disabled={busy}
            onPick={(url) => void cover.loadUrl(url)}
          />
        )}
        <DialogActions>
          {currentCover && !image && (
            <DialogButton
              type="button"
              disabled={busy}
              onClick={() => void actions.remove()}
            >
              {t("playlist_cover.remove")}
            </DialogButton>
          )}
          <DialogButton type="button" onClick={editor.close}>
            {t("playlist_cover.cancel")}
          </DialogButton>
          <DialogButton
            type="button"
            variant="primary"
            disabled={!image || cover.loading}
            loading={actions.saving}
            onClick={() => void actions.save()}
          >
            {t("playlist_cover.save")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
