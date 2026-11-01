import { globalShortcut } from "electron";
import type { CompositorBridge } from "./compositor/index.js";

export const MEDIA_SHORTCUT_ACTIONS = [
  "playPause",
  "nextTrack",
  "prevTrack",
  "seekForward",
  "seekBackward",
  "volumeUp",
  "volumeDown",
  "toggleMute",
  "showMainWindow",
] as const;

export type MediaShortcutAction = (typeof MEDIA_SHORTCUT_ACTIONS)[number];
export type MediaShortcutBindings = Partial<
  Record<MediaShortcutAction, string>
>;

const COMPOSITOR_PREFIX = "media-";

function isMediaAction(value: string): value is MediaShortcutAction {
  return (MEDIA_SHORTCUT_ACTIONS as readonly string[]).includes(value);
}

export function sanitizeMediaBindings(
  value: unknown,
  normalize: (raw: string) => string,
): MediaShortcutBindings {
  const bindings: MediaShortcutBindings = {};
  if (!value || typeof value !== "object") return bindings;
  for (const action of MEDIA_SHORTCUT_ACTIONS) {
    const raw = (value as Record<string, unknown>)[action];
    if (typeof raw !== "string") continue;
    const accelerator = normalize(raw.trim());
    if (accelerator) bindings[action] = accelerator;
  }
  return bindings;
}

export function mediaActionFromCompositor(
  id: string,
): MediaShortcutAction | null {
  if (!id.startsWith(COMPOSITOR_PREFIX)) return null;
  const action = id.slice(COMPOSITOR_PREFIX.length);
  return isMediaAction(action) ? action : null;
}

export class MediaShortcuts {
  private bindings: MediaShortcutBindings = {};
  private readonly registered = new Map<MediaShortcutAction, string>();
  private generation = 0;

  constructor(
    private readonly compositor: () => CompositorBridge | null,
    private readonly onAction: (action: MediaShortcutAction) => void,
  ) {}

  getBindings(): MediaShortcutBindings {
    return { ...this.bindings };
  }

  matches(next: MediaShortcutBindings): boolean {
    return MEDIA_SHORTCUT_ACTIONS.every(
      (action) => (this.bindings[action] ?? "") === (next[action] ?? ""),
    );
  }

  setBindings(next: MediaShortcutBindings) {
    this.bindings = { ...next };
  }

  register() {
    this.unregister();
    const generation = this.generation;
    const compositor = this.compositor();
    for (const action of MEDIA_SHORTCUT_ACTIONS) {
      const accelerator = this.bindings[action];
      if (!accelerator) continue;
      if (!compositor) {
        this.registerGlobal(action, accelerator);
        continue;
      }
      void compositor
        .bindShortcut(`${COMPOSITOR_PREFIX}${action}`, accelerator)
        .then((ok) => {
          if (!ok && generation === this.generation) {
            this.registerGlobal(action, accelerator);
          }
        });
    }
  }

  unregister() {
    this.generation += 1;
    const compositor = this.compositor();
    if (compositor) {
      for (const action of MEDIA_SHORTCUT_ACTIONS) {
        void compositor.unbindShortcut(`${COMPOSITOR_PREFIX}${action}`);
      }
    }
    for (const accelerator of this.registered.values()) {
      try {
        globalShortcut.unregister(accelerator);
      } catch {}
    }
    this.registered.clear();
  }

  private registerGlobal(action: MediaShortcutAction, accelerator: string) {
    try {
      const ok = globalShortcut.register(accelerator, () =>
        this.onAction(action),
      );
      if (ok) this.registered.set(action, accelerator);
      else
        console.warn(
          "[shortcuts] Failed to register global shortcut:",
          action,
          accelerator,
        );
    } catch (e) {
      console.error("[shortcuts] Error registering global shortcut:", e);
    }
  }
}
