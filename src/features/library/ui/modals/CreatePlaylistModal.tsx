import { useEffect, useRef, useState } from "react";
import TextInput from "@/shared/ui/TextInput";
import Tooltip from "@/shared/ui/Tooltip";
import { CheckLine, InformationLine, LinkLine } from "@mingcute/react";
import { useAddPlaylistTracks, useCreatePlaylist } from "../../hooks";
import { notifyLibraryChanged } from "../../hooks/usePlaylists";
import Dialog from "@/shared/ui/Dialog";
import {
  useToast,
  DialogActions,
  DialogButton,
  DialogHeader,
} from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import { resolveApiErrorMessage } from "@/shared/api";
import { isYoutubeHost } from "@/shared/youtube";

type Tab = "create" | "import";

const TITLE_MAX = 20;

// mirrors backend detectImportSource, labels only
function detectSourceLabel(raw: string): string | null {
  try {
    let text = raw.trim();
    if (!text.startsWith("http://") && !text.startsWith("https://")) {
      text = `https://${text}`;
    }
    const host = new URL(text).hostname.toLowerCase().replace(/^www\./, "");
    if (isYoutubeHost(host)) return "YouTube";
    if (host === "soundcloud.com" || host.endsWith(".soundcloud.com"))
      return "SoundCloud";
    if (host === "open.spotify.com") return "Spotify";
    if (host === "deezer.com" || host.endsWith(".deezer.com")) return "Deezer";
    if (
      ["music.apple.com", "geo.music.apple.com", "itunes.apple.com"].includes(
        host,
      ) ||
      host.endsWith(".music.apple.com")
    )
      return "Apple Music";
  } catch {
    // not a url yet
  }
  return null;
}

export default function CreatePlaylistModal() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const open = useModalStore((state) => state.createPlaylistOpen);
  const initialUrl = useModalStore((state) => state.createPlaylistInitialUrl);
  const pendingTrack = useModalStore(
    (state) => state.createPlaylistPendingTrack,
  );
  const close = useModalStore((state) => state.closeCreatePlaylist);

  const [tab, setTab] = useState<Tab>("create");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [importUrl, setImportUrl] = useState("");

  const [importing, setImporting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [importError, setImportError] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const createPlaylist = useCreatePlaylist();
  const addTrack = useAddPlaylistTracks();

  const detectedSource = detectSourceLabel(importUrl);
  const isCreate = tab === "create";

  useEffect(() => {
    if (open) {
      setTab(initialUrl ? "import" : "create");
      setTitle("");
      setDescription("");
      setShowDescription(false);
      setImportUrl(initialUrl || "");
      setCreateError("");
      setImportError("");
      requestAnimationFrame(() =>
        (initialUrl ? linkRef : titleRef).current?.focus(),
      );
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
      const playlist = await createPlaylist.mutateAsync({
        title: trimmed.slice(0, TITLE_MAX),
        description: description.trim() || undefined,
      });
      notifyLibraryChanged();

      if (pendingTrack) {
        try {
          await addTrack.mutateAsync({
            playlistId: playlist.id,
            trackId: pendingTrack.id,
          });
          toast(t("common.added_to_playlist"), "checkmark", {
            description: playlist.title || trimmed,
          });
        } catch {
          toast(t("common.failed_add_playlist"), "error");
        }
      }

      close();
    } catch {
      setCreateError(t("common.failed_create_playlist"));
    }
  }

  async function handleImport(overrideUrl?: string) {
    if (importing) return;
    let target = (overrideUrl ?? importUrl).trim();
    if (!target) {
      setImportError(t("common.paste_link_first"));
      return;
    }

    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
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
      await useImportStore.getState().startImport(target, pendingTrack);
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
      maxWidth={440}
    >
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px]">
        <DialogHeader
          title={
            isCreate ? t("common.from_scratch") : t("common.import_playlist")
          }
          description={
            isCreate
              ? t("common.create_empty_playlist")
              : t("common.import_playlist_description")
          }
        />

        <div className="flex p-[4px] rounded-[12px] bg-black/[0.05] dark:bg-white/[0.07]">
          {(
            [
              { id: "create", label: t("common.from_scratch") },
              { id: "import", label: t("common.import") },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 h-[34px] rounded-[9px] text-[13px] font-[500] transition-all cursor-pointer border-none ${
                tab === item.id
                  ? "bg-black/[0.07] dark:bg-white/[0.12] text-text-primary"
                  : "bg-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isCreate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
            className="flex flex-col gap-[10px]"
          >
            <TextInput
              className="!rounded-[12px] !border-transparent !bg-black/[0.05] dark:!bg-white/[0.07]"
              ref={titleRef}
              placeholder={t("common.playlist_name")}
              value={title}
              maxLength={TITLE_MAX}
              hasError={Boolean(createError)}
              onChange={(e) => {
                setTitle(e.target.value);
                if (createError) setCreateError("");
              }}
              disabled={createPlaylist.isPending}
              rightSlot={
                <span className="text-[11px] text-text-tertiary tabular-nums">
                  {title.length}/{TITLE_MAX}
                </span>
              }
            />
            {showDescription ? (
              <textarea
                autoFocus
                placeholder={t("common.description_placeholder")}
                value={description}
                maxLength={300}
                rows={2}
                disabled={createPlaylist.isPending}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-[12px] border-0 bg-black/[0.05] dark:bg-white/[0.07] px-[14px] py-[12px] text-[14px] font-[400] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus:bg-black/[0.07] dark:focus:bg-white/[0.1] disabled:opacity-50"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="self-start bg-transparent border-none p-0 text-[12px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                + {t("common.description_placeholder")}
              </button>
            )}
            {createError && (
              <span className="text-[12px] text-accent-primary">
                {createError}
              </span>
            )}
            <DialogActions className="mt-[6px]">
              <DialogButton type="button" onClick={close}>
                {t("common.cancel")}
              </DialogButton>
              <DialogButton
                type="submit"
                variant="primary"
                loading={createPlaylist.isPending}
              >
                {createPlaylist.isPending
                  ? t("common.adding")
                  : t("common.create")}
              </DialogButton>
            </DialogActions>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleImport();
            }}
            className="flex flex-col gap-[10px]"
          >
            <TextInput
              className="!rounded-[12px] !border-transparent !bg-black/[0.05] dark:!bg-white/[0.07]"
              ref={linkRef}
              icon={<LinkLine size={16} />}
              placeholder={t("common.paste_link_placeholder")}
              value={importUrl}
              hasError={Boolean(importError)}
              onChange={(e) => {
                setImportUrl(e.target.value);
                if (importError) setImportError("");
              }}
              disabled={importing}
              rightSlot={
                detectedSource ? (
                  <Tooltip content={detectedSource} side="top">
                    <span className="inline-flex cursor-help">
                      <CheckLine size={16} className="text-accent-primary" />
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip
                    side="top"
                    multiline
                    content={t("common.import_sources_hint")}
                  >
                    <span className="inline-flex text-text-tertiary hover:text-text-secondary transition-colors cursor-help">
                      <InformationLine size={16} />
                    </span>
                  </Tooltip>
                )
              }
            />
            {importError && (
              <span className="text-[12px] text-accent-primary">
                {importError}
              </span>
            )}
            <DialogActions className="mt-[6px]">
              <DialogButton type="button" onClick={close}>
                {t("common.cancel")}
              </DialogButton>
              <DialogButton type="submit" variant="primary" loading={importing}>
                {importing ? t("common.importing") : t("common.import")}
              </DialogButton>
            </DialogActions>
          </form>
        )}
      </div>
    </Dialog>
  );
}
