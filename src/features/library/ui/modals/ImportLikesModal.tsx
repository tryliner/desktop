import { useEffect, useRef, useState } from "react";
import TextInput from "@/shared/ui/TextInput";
import Dialog from "@/shared/ui/Dialog";
import { DialogActions, DialogButton, DialogHeader } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import { resolveApiErrorMessage } from "@/shared/api";

export default function ImportLikesModal() {
  const { t } = useTranslation();

  const open = useModalStore((state) => state.importLikesOpen);
  const initialUsername = useModalStore(
    (state) => state.importLikesInitialUsername,
  );
  const close = useModalStore((state) => state.closeImportLikes);

  const [username, setUsername] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUsername(initialUsername || "");
      setImportError("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialUsername]);

  async function handleImport() {
    if (importing) return;
    const trimmed = username.trim().replace(/^@/, "");
    if (!trimmed) {
      setImportError(t("common.username_required"));
      return;
    }

    const sourceUrl =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://soundcloud.com/${encodeURIComponent(trimmed)}/likes`;

    setImportError("");
    setImporting(true);

    try {
      await useImportStore.getState().startImport(sourceUrl);
      close();
    } catch (err: unknown) {
      setImportError(
        resolveApiErrorMessage(err, t, "common.failed_import_playlist"),
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={360}
    >
      <div className="flex flex-col gap-[14px] px-[20px] pb-[20px]">
        <DialogHeader
          title={t("common.import_soundcloud_likes")}
          description={t("common.import_soundcloud_description")}
        />

        {/* Username input */}
        <TextInput
          ref={inputRef}
          type="text"
          placeholder={t("common.soundcloud_username_placeholder")}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (importError) setImportError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleImport();
          }}
          maxLength={100}
          className="!rounded-[12px] !border-transparent !bg-black/[0.05] dark:!bg-white/[0.07]"
        />

        {importError && (
          <p className="text-accent-secondary text-[12px] m-0 font-[350]">
            {importError}
          </p>
        )}

        <DialogActions>
          <DialogButton
            type="button"
            variant="primary"
            onClick={() => void handleImport()}
            loading={importing}
          >
            {t("common.import_likes")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
