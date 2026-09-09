import { useEffect, useRef, useState } from "react";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import { LinkLine } from "@mingcute/react";
import { useCreatePlaylist } from "../../hooks";
import { notifyLibraryChanged } from "../../hooks/usePlaylists";
import Dialog from "@/shared/ui/Dialog";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import { api } from "@/shared/api";

export default function CreatePlaylistModal() {
  const { t } = useTranslation();

  const open = useModalStore((state) => state.createPlaylistOpen);
  const initialUrl = useModalStore((state) => state.createPlaylistInitialUrl);
  const close = useModalStore((state) => state.closeCreatePlaylist);

  const [title, setTitle] = useState("");
  const [importUrl, setImportUrl] = useState("");

  const [importing, setImporting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [importError, setImportError] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const createPlaylist = useCreatePlaylist();

  useEffect(() => {
    if (open) {
      setTitle("");
      setImportUrl(initialUrl || "");
      setCreateError("");
      setImportError("");
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open, initialUrl]);

  async function handleCreate() {
    if (createPlaylist.isPending) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError(t("common.name_required"));
      return;
    }
    setCreateError("");
    try {
      await createPlaylist.mutateAsync({ title: trimmed });
      close();
    } catch {
      setCreateError(t("common.failed_create_playlist"));
    }
  }

  async function handleImport(overrideUrl?: string) {
    if (importing) return;
    const target = (overrideUrl ?? importUrl).trim();
    if (!target) {
      setImportError(t("common.paste_link_first"));
      return;
    }

    try {
      new URL(target);
    } catch {
      setImportError(t("common.unsupported_link"));
      return;
    }

    setImportError("");
    setImporting(true);
    try {
      await useImportStore.getState().startImport(target);
      close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.failed_import_playlist");
      setImportError(msg);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={360}>
      <div className="flex flex-col gap-[20px] px-[20px] pb-[20px]">
        <div>
          <h2
            className="m-0 text-[18px] font-[500] text-text-primary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.from_scratch")}
          </h2>
          <p
            className="m-0 mt-[2px] text-[13px] text-text-tertiary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.create_empty_playlist")}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
          className="flex flex-col gap-[8px]"
        >
          <TextInput
            ref={titleRef}
            placeholder={t("common.playlist_name")}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (createError) setCreateError("");
            }}
            disabled={createPlaylist.isPending}
          />
          {createError && (
            <span
              className="text-[12px] text-accent-primary"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {createError}
            </span>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={createPlaylist.isPending}
            className="w-full mt-[4px]"
          >
            {createPlaylist.isPending
              ? t("common.adding")
              : t("common.create")}
          </Button>
        </form>

        <div className="flex items-center gap-[12px]">
          <div className="flex-1 h-px bg-border-primary" />
          <span
            className="text-[12px] text-text-tertiary uppercase tracking-wider"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.import")}
          </span>
          <div className="flex-1 h-px bg-border-primary" />
        </div>

        <div>
          <h2
            className="m-0 text-[16px] font-[500] text-text-primary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.import_playlist")}
          </h2>
          <p
            className="m-0 mt-[2px] text-[13px] text-text-tertiary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("common.import_playlist_description")}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleImport();
          }}
          className="flex flex-col gap-[8px]"
        >
          <TextInput
            icon={<LinkLine size={16} />}
            placeholder={t("common.paste_link_placeholder")}
            value={importUrl}
            onChange={(e) => {
              setImportUrl(e.target.value);
              if (importError) setImportError("");
            }}
            disabled={importing}
          />
          {importError && (
            <span
              className="text-[12px] text-accent-primary"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {importError}
            </span>
          )}
          <Button
            type="submit"
            variant="secondary"
            disabled={importing}
            className="w-full mt-[4px]"
          >
            {importing
              ? t("common.importing")
              : t("common.import")}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
