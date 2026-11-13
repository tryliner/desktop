import type { BrowserWindow, Input } from "electron";

export type ZoomAction = "in" | "out" | "reset";

export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

type ZoomKey = Pick<
  Input,
  "type" | "key" | "code" | "control" | "meta" | "alt"
>;

export function zoomActionFor(input: ZoomKey): ZoomAction | null {
  if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt)
    return null;
  if (input.key === "=" || input.key === "+" || input.code === "NumpadAdd")
    return "in";
  if (input.key === "-" || input.code === "NumpadSubtract") return "out";
  if (input.key === "0" || input.code === "Numpad0") return "reset";
  return null;
}

export function maxZoomFor(
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
): number {
  const fit = Math.min(width / minWidth, height / minHeight);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(fit * 10) / 10));
}

export function effectiveZoom(preferred: number, maxZoom: number): number {
  return Math.round(Math.min(preferred, maxZoom) * 10) / 10;
}

export function normalizeZoom(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)) * 10) / 10;
}

export interface ZoomControls {
  current: () => number;
  setPreferred: (value: unknown) => number;
}

export function sizeForZoom(
  current: readonly [number, number],
  zoom: number,
  minWidth: number,
  minHeight: number,
  area: { width: number; height: number },
): [number, number] {
  const width = Math.max(current[0], Math.ceil(minWidth * zoom));
  const height = Math.max(current[1], Math.ceil(minHeight * zoom));
  return [Math.min(width, area.width), Math.min(height, area.height)];
}

export function nextZoomFactor(
  current: number,
  action: ZoomAction,
  maxZoom: number,
): number {
  const target =
    action === "reset"
      ? 1
      : current + (action === "in" ? ZOOM_STEP : -ZOOM_STEP);
  const clamped = Math.min(maxZoom, Math.max(MIN_ZOOM, target));
  return Math.round(clamped * 10) / 10;
}

export function attachZoomControls(
  window: BrowserWindow,
  minWidth: number,
  minHeight: number,
  workArea?: () => { width: number; height: number },
): ZoomControls {
  const contents = window.webContents;
  const maxZoom = () => {
    const [width, height] = window.getContentSize();
    return maxZoomFor(width, height, minWidth, minHeight);
  };
  let preferred = 1;
  const sync = () => {
    const target = effectiveZoom(preferred, maxZoom());
    if (contents.getZoomFactor() !== target) contents.setZoomFactor(target);
  };
  const apply = (action: ZoomAction) => {
    preferred = nextZoomFactor(
      effectiveZoom(preferred, maxZoom()),
      action,
      Math.max(1, maxZoom()),
    );
    sync();
  };

  contents.setVisualZoomLevelLimits(1, 1).catch(() => undefined);
  contents.on("before-input-event", (event, input) => {
    const action = zoomActionFor(input);
    if (!action) return;
    event.preventDefault();
    apply(action);
  });
  contents.on("zoom-changed", (_event, direction) => apply(direction));
  window.on("resize", sync);
  contents.on("did-finish-load", sync);
  sync();

  return {
    current: () => contents.getZoomFactor(),
    setPreferred: (value) => {
      const next = normalizeZoom(value);
      if (next !== null) {
        preferred = next;
        const area = workArea?.();
        if (area && !window.isMaximized() && !window.isFullScreen()) {
          const current = window.getContentSize() as [number, number];
          const [width, height] = sizeForZoom(
            current,
            next,
            minWidth,
            minHeight,
            area,
          );
          if (width !== current[0] || height !== current[1])
            window.setContentSize(width, height);
        }
        sync();
      }
      return contents.getZoomFactor();
    },
  };
}
