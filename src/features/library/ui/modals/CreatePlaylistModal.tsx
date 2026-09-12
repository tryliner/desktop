import { useEffect, useRef, useState } from "react";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import Tooltip from "@/shared/ui/Tooltip";
import { CheckLine, InformationLine, LinkLine } from "@mingcute/react";
import { useAddPlaylistTracks, useCreatePlaylist } from "../../hooks";
import { notifyLibraryChanged } from "../../hooks/usePlaylists";
import Dialog from "@/shared/ui/Dialog";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import { resolveApiErrorMessage } from "@/shared/api";

type Tab = "create" | "import";

const TITLE_MAX = 20;

// mirrors backend detectImportSource, labels only
function detectSourceLabel(raw: string): string | null {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, "");
    if (["youtube.com", "music.youtube.com", "m.youtube.com", "youtu.be"].includes(host)) return "YouTube";
    if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) return "SoundCloud";
    if (host === "open.spotify.com") return "Spotify";
    if (host === "deezer.com" || host.endsWith(".deezer.com")) return "Deezer";
  } catch {
    // not a url yet
  }
  return null;
}

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export default function CreatePlaylistModal() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const open = useModalStore((state) => state.createPlaylistOpen);
  const initialUrl = useModalStore((state) => state.createPlaylistInitialUrl);
  const pendingTrack = useModalStore((state) => state.createPlaylistPendingTrack);
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
          await addTrack.mutateAsync({ playlistId: playlist.id, trackId: pendingTrack.id });
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
      await useImportStore.getState().startImport(target, pendingTrack);
      close();
    } catch (err: unknown) {
      setImportError(resolveApiErrorMessage(err, t, "common.failed_import_playlist"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)} maxWidth={440}>
      <div className="flex flex-col gap-[14px] px-[20px] pb-[16px]">
        <div>
          <h2 className="m-0 text-[18px] font-[500] text-text-primary" style={font}>
            {isCreate ? t("common.from_scratch") : t("common.import_playlist")}
          </h2>
          <p className="m-0 mt-[2px] text-[13px] text-text-tertiary" style={font}>
            {isCreate ? t("common.create_empty_playlist") : t("common.import_playlist_description")}
          </p>
        </div>

        <div className="flex p-[3px] rounded-lg bg-border-alpha-14">
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
              className={`flex-1 h-[30px] rounded-md text-[13px] font-[500] transition-all cursor-pointer border-none ${
                tab === item.id
                  ? "bg-bg-primary text-text-primary shadow-sm"
                  : "bg-transparent text-text-secondary hover:text-text-primary"
              }`}
              style={font}
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
                <span className="text-[11px] text-text-tertiary tabular-nums" style={font}>
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
                className="w-full resize-none rounded-md border border-border-primary bg-bg-primary px-[14px] py-[10px] text-[14px] font-[400] text-text-primary placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-text-secondary focus:ring-1 focus:ring-text-secondary disabled:opacity-50"
                style={font}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="self-start bg-transparent border-none p-0 text-[12px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                style={font}
              >
                + {t("common.description_placeholder")}
              </button>
            )}
            {createError && (
              <span className="text-[12px] text-accent-primary" style={font}>
                {createError}
              </span>
            )}
            <div className="flex items-center justify-end gap-[8px] mt-[2px]">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={createPlaylist.isPending}>
                {createPlaylist.isPending ? t("common.adding") : t("common.create")}
              </Button>
            </div>
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
                    <span className="inline-flex cursor-default">
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
              <span className="text-[12px] text-accent-primary" style={font}>
                {importError}
              </span>
            )}
            <div className="flex items-center justify-end gap-[8px] mt-[2px]">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={importing}>
                {importing ? t("common.importing") : t("common.import")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
