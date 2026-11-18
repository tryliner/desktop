import { useCallback, useEffect, useRef, useState } from "react";
import {
  PicLine,
  PlaylistFill,
  RefreshAnticlockwise1Line,
  ZoomInLine,
  ZoomOutLine,
} from "@mingcute/react";
import Dialog from "@/shared/ui/Dialog";
import {
  DialogActions,
  DialogButton,
  DialogHeader,
  Slider,
  showToast,
} from "@/shared/ui";
import { useTranslation } from "@/languages";
import CoverImage from "../ui/CoverImage";
import { prepareCoverFallback } from "../lib/coverSigner";
import { useCoverEditorStore } from "./coverEditorStore";
import {
  PlaylistCoverError,
  useCustomPlaylistCover,
  usePlaylistCoversStore,
} from "./playlistCoverStore";
import {
  MAX_ANIMATED_BYTES,
  MAX_ZOOM,
  MIN_ZOOM,
  clampOffset,
  isAnimatedImage,
  renderCroppedCover,
  zoomAround,
  type Point,
  type Size,
} from "./coverCrop";

const VIEWPORT = 280;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const ZOOM_STEP = 1.25;

// the slider runs on a log scale: equal distances feel like equal zoom
// steps, so 1x-2x gets as much room as 2x-4x instead of a quarter of it
const LOG_RANGE = Math.log(MAX_ZOOM / MIN_ZOOM);
const zoomToSlider = (zoom: number) => Math.log(zoom / MIN_ZOOM) / LOG_RANGE;
const sliderToZoom = (value: number) => MIN_ZOOM * Math.exp(value * LOG_RANGE);
const CENTER: Point = { x: VIEWPORT / 2, y: VIEWPORT / 2 };

const ICON_BUTTON =
  "flex h-[28px] w-[28px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";

interface LoadedImage {
  blob: Blob;
  url: string;
  size: Size;
  bitmap: ImageBitmap | null;
  animated: boolean;
}

async function fetchBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (response.ok) return await response.blob();
  } catch {}
  // cover CDNs without CORS go through the signed proxy, like CoverImage does
  const fallback = await prepareCoverFallback(url);
  if (!fallback) throw new Error("unreachable");
  const response = await fetch(fallback, { mode: "cors" });
  if (!response.ok) throw new Error(`cover ${response.status}`);
  return response.blob();
}

async function decode(blob: Blob): Promise<LoadedImage> {
  if (blob.size > MAX_SOURCE_BYTES) throw new PlaylistCoverError("too-large");
  const head = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer());
  const animated = isAnimatedImage(head);
  if (animated && blob.size > MAX_ANIMATED_BYTES) {
    throw new PlaylistCoverError("too-large");
  }
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) throw new PlaylistCoverError("unsupported-type");
  return {
    blob,
    url: URL.createObjectURL(blob),
    size: { width: bitmap.width, height: bitmap.height },
    bitmap,
    animated,
  };
}

function errorMessage(
  error: unknown,
  t: (key: string) => string,
  fallback: string,
): string {
  const reason = error instanceof PlaylistCoverError ? error.reason : "";
  if (reason === "unsupported-type") return t("playlist_cover.error_type");
  if (reason === "too-large") return t("playlist_cover.error_size");
  return fallback;
}

export default function PlaylistCoverEditorModal() {
  const { t } = useTranslation();
  const open = useCoverEditorStore((s) => s.open);
  const playlistId = useCoverEditorStore((s) => s.playlistId);
  const playlistTitle = useCoverEditorStore((s) => s.playlistTitle);
  const trackCovers = useCoverEditorStore((s) => s.trackCovers);
  const initialFile = useCoverEditorStore((s) => s.initialFile);
  const close = useCoverEditorStore((s) => s.close);
  const existing = useCustomPlaylistCover(playlistId);

  const [image, setImage] = useState<LoadedImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; start: Point; from: Point } | null>(null);
  const imageRef = useRef<LoadedImage | null>(null);

  const replaceImage = useCallback((next: LoadedImage | null) => {
    const previous = imageRef.current;
    if (previous && previous !== next) {
      URL.revokeObjectURL(previous.url);
      previous.bitmap?.close();
    }
    imageRef.current = next;
    setImage(next);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const loadBlob = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      try {
        replaceImage(await decode(blob));
      } catch (error) {
        showToast(
          errorMessage(error, t, t("playlist_cover.error_load")),
          "error",
        );
      } finally {
        setBusy(false);
      }
    },
    [replaceImage, t],
  );

  const loadUrl = useCallback(
    async (url: string) => {
      setBusy(true);
      try {
        replaceImage(await decode(await fetchBlob(url)));
      } catch (error) {
        showToast(
          errorMessage(error, t, t("playlist_cover.error_load")),
          "error",
        );
      } finally {
        setBusy(false);
      }
    },
    [replaceImage, t],
  );

  useEffect(() => {
    if (open && initialFile) void loadBlob(initialFile);
  }, [open, initialFile, loadBlob]);

  useEffect(() => {
    if (!open) replaceImage(null);
  }, [open, replaceImage]);

  // paste an image straight from the clipboard while the editor is open
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

  const setZoomAt = (nextZoom: number, anchor: Point) => {
    if (!image) return;
    const next = zoomAround(
      image.size,
      VIEWPORT,
      zoom,
      offset,
      nextZoom,
      anchor,
    );
    setZoom(next.zoom);
    setOffset(next.offset);
  };

  const resetCrop = () => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  };
  const cropChanged =
    zoom > MIN_ZOOM + 0.001 || offset.x !== 0 || offset.y !== 0;

  const save = async () => {
    if (!playlistId || !image) return;
    setBusy(true);
    try {
      const blob = image.animated
        ? image.blob
        : await renderCroppedCover(
            image.bitmap!,
            image.size,
            VIEWPORT,
            zoom,
            offset,
          );
      await usePlaylistCoversStore.getState().setCover(playlistId, blob);
      showToast(t("playlist_cover.saved"), "checkmark", {
        description: playlistTitle,
      });
      close();
    } catch (error) {
      showToast(
        errorMessage(error, t, t("playlist_cover.error_save")),
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeCustom = async () => {
    if (!playlistId) return;
    await usePlaylistCoversStore.getState().removeCover(playlistId);
    showToast(t("playlist_cover.removed"), "checkmark", {
      description: playlistTitle,
    });
    close();
  };

  const displayScale = image
    ? (VIEWPORT / Math.min(image.size.width, image.size.height)) * zoom
    : 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={420}
    >
      <div
        className="flex flex-col gap-[16px] px-[20px] pb-[20px] pt-[4px]"
        data-own-drop="screen"
      >
        <DialogHeader
          title={t("playlist_cover.title")}
          description={playlistTitle}
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

        <div
          className={`relative mx-auto overflow-hidden rounded-[14px] bg-bg-elevated outline-none transition-shadow ${
            dragOver ? "ring-2 ring-text-primary/60" : ""
          } ${image && !image.animated ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{ width: VIEWPORT, height: VIEWPORT, touchAction: "none" }}
          tabIndex={image ? 0 : -1}
          aria-label={image ? t("playlist_cover.drag_hint") : undefined}
          onDragOver={(e) => {
            if ([...e.dataTransfer.items].some((i) => i.kind === "file")) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void loadBlob(file);
          }}
          onWheel={(e) => {
            if (!image || image.animated) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setZoomAt(zoom * Math.exp(-e.deltaY * 0.0025), {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onPointerDown={(e) => {
            if (!image || image.animated) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: e.pointerId,
              start: { x: e.clientX, y: e.clientY },
              from: offset,
            };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            const current = drag.current;
            if (!current || current.id !== e.pointerId || !image) return;
            setOffset(
              clampOffset(image.size, VIEWPORT, zoom, {
                x: current.from.x + e.clientX - current.start.x,
                y: current.from.y + e.clientY - current.start.y,
              }),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
            setDragging(false);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
          onKeyDown={(e) => {
            if (!image || image.animated) return;
            const step = e.shiftKey ? 40 : 10;
            const moves: Record<string, Point> = {
              ArrowLeft: { x: step, y: 0 },
              ArrowRight: { x: -step, y: 0 },
              ArrowUp: { x: 0, y: step },
              ArrowDown: { x: 0, y: -step },
            };
            const move = moves[e.key];
            if (move) {
              e.preventDefault();
              setOffset(
                clampOffset(image.size, VIEWPORT, zoom, {
                  x: offset.x + move.x,
                  y: offset.y + move.y,
                }),
              );
            } else if (e.key === "+" || e.key === "=") {
              setZoomAt(zoom * 1.15, CENTER);
            } else if (e.key === "-") {
              setZoomAt(zoom / 1.15, CENTER);
            } else if (e.key === "0") {
              resetCrop();
            }
          }}
        >
          {image ? (
            image.animated ? (
              <img
                src={image.url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <img
                src={image.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: image.size.width * displayScale,
                  height: image.size.height * displayScale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-[10px] border-none bg-transparent text-text-secondary transition-colors hover:text-text-primary"
            >
              {existing ? (
                <img
                  src={existing}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
              ) : null}
              <span className="relative flex h-[48px] w-[48px] items-center justify-center rounded-full bg-fill">
                <PicLine size={22} />
              </span>
              <span className="relative text-label font-[500] text-text-primary">
                {t("playlist_cover.choose")}
              </span>
              <span className="relative text-caption text-text-tertiary">
                {t("playlist_cover.drop_hint")}
              </span>
            </button>
          )}
          {image && !image.animated && (
            // rule-of-thirds guide while moving the picture around
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
                dragging ? "opacity-100" : "opacity-0"
              }`}
              style={{
                backgroundImage:
                  "linear-gradient(to right, transparent calc(33.333% - 0.5px), rgba(255,255,255,0.45) calc(33.333% - 0.5px), rgba(255,255,255,0.45) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgba(255,255,255,0.45) calc(66.666% - 0.5px), rgba(255,255,255,0.45) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px)), linear-gradient(to bottom, transparent calc(33.333% - 0.5px), rgba(255,255,255,0.45) calc(33.333% - 0.5px), rgba(255,255,255,0.45) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgba(255,255,255,0.45) calc(66.666% - 0.5px), rgba(255,255,255,0.45) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px))",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
              }}
            />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="h-[20px] w-[20px] animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
            </div>
          )}
        </div>

        {image && !image.animated && (
          <div className="flex flex-col gap-[8px]">
            <div className="flex h-[40px] items-center gap-[2px] rounded-full bg-fill px-[6px]">
              <button
                type="button"
                aria-label={t("playlist_cover.zoom_out")}
                title={t("playlist_cover.zoom_out")}
                disabled={zoom <= MIN_ZOOM + 0.001}
                onClick={() => setZoomAt(zoom / ZOOM_STEP, CENTER)}
                className={ICON_BUTTON}
              >
                <ZoomOutLine size={16} />
              </button>
              <div className="min-w-0 flex-1 px-[2px]">
                <Slider
                  ariaLabel={t("playlist_cover.zoom")}
                  ariaValueText={`${Math.round(zoom * 100)}%`}
                  value={zoomToSlider(zoom)}
                  min={0}
                  max={1}
                  step={0.01}
                  thumb
                  showValue={false}
                  onChange={(value) => setZoomAt(sliderToZoom(value), CENTER)}
                />
              </div>
              <button
                type="button"
                aria-label={t("playlist_cover.zoom_in")}
                title={t("playlist_cover.zoom_in")}
                disabled={zoom >= MAX_ZOOM - 0.001}
                onClick={() => setZoomAt(zoom * ZOOM_STEP, CENTER)}
                className={ICON_BUTTON}
              >
                <ZoomInLine size={16} />
              </button>
              <span className="w-[42px] shrink-0 pr-[6px] text-right text-caption font-[500] tabular-nums text-text-secondary">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-[8px] px-[4px]">
              <span className="min-w-0 truncate text-caption text-text-tertiary">
                {t("playlist_cover.drag_hint")}
              </span>
              <div className="flex shrink-0 items-center gap-[6px]">
                {cropChanged && (
                  <button
                    type="button"
                    onClick={resetCrop}
                    className="flex cursor-pointer items-center gap-[4px] rounded-control border-none bg-transparent px-[8px] py-[5px] text-caption font-[500] text-text-secondary hover:bg-fill-hover hover:text-text-primary"
                  >
                    <RefreshAnticlockwise1Line size={13} />
                    {t("playlist_cover.reset")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="shrink-0 cursor-pointer rounded-control border-none bg-fill px-[10px] py-[5px] text-caption font-[500] text-text-primary hover:bg-fill-hover"
                >
                  {t("playlist_cover.change")}
                </button>
              </div>
            </div>
          </div>
        )}
        {image?.animated && (
          <p className="m-0 text-caption text-text-tertiary">
            {t("playlist_cover.animated_note")}
          </p>
        )}

        {!image && trackCovers.length > 0 && (
          <div className="flex flex-col gap-[8px]">
            <span className="text-caption font-[500] uppercase tracking-[0.04em] text-text-tertiary">
              {t("playlist_cover.from_songs")}
            </span>
            <div className="grid grid-cols-6 gap-[6px]">
              {trackCovers.map((url) => (
                <button
                  key={url}
                  type="button"
                  disabled={busy}
                  onClick={() => void loadUrl(url)}
                  className="relative aspect-square cursor-pointer overflow-hidden rounded-[8px] border-none bg-bg-elevated p-0 transition-transform hover:scale-[1.04] disabled:opacity-50"
                >
                  <CoverImage
                    src={url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="m-0 flex items-center gap-[6px] text-caption text-text-tertiary">
          <PlaylistFill size={13} />
          {t("playlist_cover.this_device")}
        </p>

        <DialogActions>
          {existing && !image && (
            <DialogButton type="button" onClick={() => void removeCustom()}>
              {t("playlist_cover.remove")}
            </DialogButton>
          )}
          <DialogButton type="button" onClick={close}>
            {t("playlist_cover.cancel")}
          </DialogButton>
          <DialogButton
            type="button"
            variant="primary"
            disabled={!image}
            loading={busy && Boolean(image)}
            onClick={() => void save()}
          >
            {t("playlist_cover.save")}
          </DialogButton>
        </DialogActions>
      </div>
    </Dialog>
  );
}
