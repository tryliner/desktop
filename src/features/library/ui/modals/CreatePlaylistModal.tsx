import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { useElementSize } from "@/shared/hooks/useElementSize";

type Tab = "create" | "import";

const TITLE_MAX = 20;
const HEIGHT_TWEEN_MS = 260;
const HEIGHT_TRANSITION = `height ${HEIGHT_TWEEN_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
const CONTENT_EASE = [0.32, 0.72, 0, 1] as const;
const CONTENT_ENTER = { duration: 0.2, ease: CONTENT_EASE };
const CONTENT_EXIT = { duration: 0.12, ease: "easeOut" } as const;
const PILL_SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;

function useHeightTween() {
  const { attach, size } = useElementSize<HTMLDivElement>();
  const [tweening, setTweening] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const start = useCallback(() => {
    setTweening(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => setTweening(false),
      HEIGHT_TWEEN_MS + 60,
    );
  }, []);

  const style: CSSProperties | undefined =
    tweening && size
      ? {
          height: size.height,
          overflow: "clip",
          transition: HEIGHT_TRANSITION,
        }
      : undefined;

  return { attach, style, start };
}

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

  const pillId = useId();
  const body = useHeightTween();
  const descriptionSlot = useHeightTween();

  const detectedSource = detectSourceLabel(importUrl);
  const isCreate = tab === "create";

  const [openedWith, setOpenedWith] = useState<{
    open: boolean;
    initialUrl: typeof initialUrl;
  }>({ open: false, initialUrl });
  if (openedWith.open !== open || openedWith.initialUrl !== initialUrl) {
    setOpenedWith({ open, initialUrl });
    if (open) {
      setTab(initialUrl ? "import" : "create");
      setTitle("");
      setDescription("");
      setShowDescription(false);
      setImportUrl(initialUrl || "");
      setCreateError("");
      setImportError("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      (initialUrl ? linkRef : titleRef).current?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, initialUrl]);

  function switchTab(next: Tab) {
    if (next === tab) return;
    body.start();
    setTab(next);
  }

  function revealDescription() {
    descriptionSlot.start();
    setShowDescription(true);
  }

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
        <div className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: CONTENT_ENTER }}
              exit={{ opacity: 0, transition: CONTENT_EXIT }}
            >
              <DialogHeader
                title={
                  isCreate
                    ? t("common.from_scratch")
                    : t("common.import_playlist")
                }
                description={
                  isCreate
                    ? t("common.create_empty_playlist")
                    : t("common.import_playlist_description")
                }
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex p-[4px] rounded-item bg-fill">
          {(
            [
              { id: "create", label: t("common.from_scratch") },
              { id: "import", label: t("common.import") },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => switchTab(item.id)}
              className={`relative flex-1 h-[34px] rounded-[9px] bg-transparent text-body font-[500] transition-colors cursor-pointer border-none ${
                tab === item.id
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab === item.id && (
                <motion.span
                  layoutId={pillId}
                  transition={PILL_SPRING}
                  className="absolute inset-0 rounded-[9px] bg-fill-hover"
                />
              )}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>

        <div style={body.style}>
          <div ref={body.attach} className="relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {isCreate ? (
                <motion.form
                  key="create"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: CONTENT_ENTER }}
                  exit={{ opacity: 0, y: -4, transition: CONTENT_EXIT }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleCreate();
                  }}
                  className="flex flex-col gap-[10px]"
                >
                  <TextInput
                    className="!rounded-item !border-transparent !bg-fill"
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
                  <div style={descriptionSlot.style}>
                    <div ref={descriptionSlot.attach} className="relative flex">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {showDescription ? (
                          <motion.div
                            key="field"
                            className="w-full"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: CONTENT_ENTER,
                            }}
                            exit={{ opacity: 0, transition: CONTENT_EXIT }}
                          >
                            <textarea
                              autoFocus
                              placeholder={t("common.description_placeholder")}
                              value={description}
                              maxLength={300}
                              rows={2}
                              disabled={createPlaylist.isPending}
                              onChange={(e) => setDescription(e.target.value)}
                              className="block w-full resize-none rounded-item border-0 bg-fill px-[14px] py-[12px] text-label font-[400] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus:bg-fill-hover disabled:opacity-50"
                            />
                          </motion.div>
                        ) : (
                          <motion.button
                            key="link"
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: CONTENT_ENTER }}
                            exit={{ opacity: 0, transition: CONTENT_EXIT }}
                            onClick={revealDescription}
                            className="bg-transparent border-none p-0 text-caption text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                          >
                            + {t("common.description_placeholder")}
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  {createError && (
                    <span className="text-caption text-accent-primary">
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
                </motion.form>
              ) : (
                <motion.form
                  key="import"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: CONTENT_ENTER }}
                  exit={{ opacity: 0, y: -4, transition: CONTENT_EXIT }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleImport();
                  }}
                  className="flex flex-col gap-[10px]"
                >
                  <TextInput
                    className="!rounded-item !border-transparent !bg-fill"
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
                            <CheckLine
                              size={16}
                              className="text-accent-primary"
                            />
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
                    <span className="text-caption text-accent-primary">
                      {importError}
                    </span>
                  )}
                  <DialogActions className="mt-[6px]">
                    <DialogButton type="button" onClick={close}>
                      {t("common.cancel")}
                    </DialogButton>
                    <DialogButton
                      type="submit"
                      variant="primary"
                      loading={importing}
                    >
                      {importing ? t("common.importing") : t("common.import")}
                    </DialogButton>
                  </DialogActions>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
