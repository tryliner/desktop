export type OverlayAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PlacementRequest {
  title: string;
  width: number;
  height: number;
  anchor: OverlayAnchor;
  pinned: boolean;
  margin: number;
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const POLL_ATTEMPTS = 25;
const POLL_INTERVAL_MS = 40;

export function overlayOrigin(
  area: WorkArea,
  request: Pick<PlacementRequest, "width" | "height" | "anchor" | "margin">,
): { x: number; y: number } {
  const y = Math.round(
    request.anchor.startsWith("bottom-")
      ? area.y + area.height - request.height - request.margin
      : area.y + request.margin,
  );
  if (request.anchor.endsWith("-left")) {
    return { x: Math.round(area.x + request.margin), y };
  }
  if (request.anchor.endsWith("-right")) {
    return {
      x: Math.round(area.x + area.width - request.width - request.margin),
      y,
    };
  }
  return { x: Math.round(area.x + (area.width - request.width) / 2), y };
}

export async function waitFor<T>(
  probe: () => Promise<T | null>,
): Promise<T | null> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const found = await probe().catch(() => null);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}
