type VisibilityListener = (visible: boolean) => void;

let visible = true;
let subscribed = false;
const listeners = new Set<VisibilityListener>();

export function applyWindowVisibility(next: boolean): void {
  if (next === visible) return;
  visible = next;
  for (const listener of listeners) listener(visible);
}

function ensureSubscribed(): void {
  if (subscribed || typeof window === "undefined") return;
  subscribed = true;
  window.linerElectron?.onWindowStateChange?.((state) => {
    applyWindowVisibility(state.isVisible !== false);
  });
}

export function isWindowVisible(): boolean {
  ensureSubscribed();
  return visible;
}

export function onWindowVisibilityChange(listener: VisibilityListener): () => void {
  ensureSubscribed();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
