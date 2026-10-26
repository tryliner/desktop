import { openCommandPipe } from "./commandPipe";
import { activeHyprWindow, placeHyprlandWindow } from "./hyprland";
import { bindHyprlandShortcut, unbindHyprlandShortcut } from "./hyprlandBinds";
import { parseAccelerator } from "./keys";
import type { PlacementRequest } from "./placement";
import { detectCompositor, isLinuxWaylandSession } from "./session";
import {
  bindSwayShortcut,
  focusedSwayNode,
  placeSwayWindow,
  unbindSwayShortcut,
} from "./sway";

export type { OverlayAnchor, PlacementRequest } from "./placement";
export { detectCompositor, isLinuxWaylandSession };

export interface CompositorBridge {
  readonly kind: "hyprland" | "sway";
  captureFocus: () => Promise<void>;
  placeOverlay: (request: PlacementRequest) => Promise<boolean>;
  bindShortcut: (id: string, accelerator: string) => Promise<boolean>;
  unbindShortcut: (id: string) => Promise<void>;
  dispose: () => Promise<void>;
}

export function createCompositorBridge(
  onAction: (action: string) => void,
): CompositorBridge | null {
  const kind = detectCompositor();
  if (kind !== "hyprland" && kind !== "sway") return null;
  const pipe = openCommandPipe(onAction);
  const boundIds = new Set<string>();
  let hyprFocus: string | null = null;
  let swayFocus: number | null = null;

  const unbind = (id: string) =>
    kind === "hyprland" ? unbindHyprlandShortcut(id) : unbindSwayShortcut(id);

  return {
    kind,
    captureFocus: async () => {
      if (kind === "hyprland") hyprFocus = await activeHyprWindow();
      else swayFocus = await focusedSwayNode();
    },
    placeOverlay: (request) =>
      (kind === "hyprland"
        ? placeHyprlandWindow(request, hyprFocus)
        : placeSwayWindow(request, swayFocus)
      ).catch((error) => {
        console.warn(`[compositor] ${kind} placement failed:`, error);
        return false;
      }),
    bindShortcut: async (id, accelerator) => {
      const combo = parseAccelerator(accelerator);
      if (!pipe || !combo) return false;
      const command = pipe.commandFor(id);
      const ok = await (
        kind === "hyprland"
          ? bindHyprlandShortcut(id, combo, command)
          : bindSwayShortcut(id, combo, command)
      ).catch((error) => {
        console.warn(`[compositor] ${kind} bind failed:`, error);
        return false;
      });
      if (ok) boundIds.add(id);
      return ok;
    },
    unbindShortcut: async (id) => {
      boundIds.delete(id);
      await unbind(id).catch(() => undefined);
    },
    dispose: async () => {
      await Promise.all(
        [...boundIds].map((id) => unbind(id).catch(() => undefined)),
      );
      boundIds.clear();
      pipe?.dispose();
    },
  };
}
