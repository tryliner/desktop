import { useEffect, useRef, useState } from "react";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import Dialog from "@/shared/ui/Dialog";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import { api, resolveApiErrorMessage } from "@/shared/api";

export default function ImportLikesModal() {
  const { t } = useTranslation();

  const open = useModalStore((state) => state.importLikesOpen);
  const initialUsername = useModalStore((state) => state.importLikesInitialUsername);
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

    const sourceUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://soundcloud.com/${encodeURIComponent(trimmed)}/likes`;

    setImportError("");
    setImporting(true);

    try {
      await useImportStore.getState().startImport(sourceUrl);
      close();
    } catch (err: unknown) {
      setImportError(resolveApiErrorMessage(err, t, "common.failed_import_playlist"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={360}>
      <div className="flex flex-col gap-[12px] px-[16px] pb-[16px]">
        {/* Header */}
        <div className="flex flex-col gap-[2px]">
          <p
            className="text-text-primary text-[13px] font-[500] m-0"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {t("common.import_soundcloud_likes")}
          </p>
          <p
            className="text-text-tertiary text-[12px] m-0 font-[350]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.import_soundcloud_description")}
          </p>
        </div>

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
          size="sm"
          className="!rounded-md"
        />

        {importError && (
          <p
            className="text-accent-secondary text-[12px] m-0 font-[350]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {importError}
          </p>
        )}

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleImport()}
          disabled={importing}
          className={`w-full !rounded-md ${importing ? "pointer-events-none" : ""}`}
        >
          {importing ? (
            <span className="inline-block h-[13px] w-[13px] rounded-full border-[2px] border-btn-primary-text/30 border-t-btn-primary-text animate-spin" />
          ) : (
            t("common.import_likes")
          )}
        </Button>
      </div>
    </Dialog>
  );
}
