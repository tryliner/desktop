import { vi } from "vitest";

export interface SmtcMediaUpdatePayload {
  status: "playing" | "paused" | "loading" | "idle";
  track: {
    id: string;
    title: string;
    artists: string;
    coverUrl?: string;
    durationMs: number;
  } | null;
  positionMs: number;
  durationMs: number;
}

export type SmtcMediaAction = "play" | "pause" | "togglePlay" | "next" | "prev" | "stop";

export class MockElectronSmtcBridge {
  public recordedUpdates: SmtcMediaUpdatePayload[] = [];
  public registeredShortcuts: Map<string, () => void> = new Map();
  public actionListeners: Set<(action: SmtcMediaAction) => void> = new Set();
  public shortcutRegistrationBlocked = false;

  public reset(): void {
    this.recordedUpdates = [];
    this.registeredShortcuts.clear();
    this.actionListeners.clear();
    this.shortcutRegistrationBlocked = false;
  }

  // Called by renderer via IPC "desktop:media-update"
  public sendMediaUpdate(payload: SmtcMediaUpdatePayload): void {
    this.recordedUpdates.push({ ...payload });
  }

  // Register listener in renderer for "desktop:media-action"
  public onMediaAction(callback: (action: SmtcMediaAction) => void): () => void {
    this.actionListeners.add(callback);
    return () => {
      this.actionListeners.delete(callback);
    };
  }

  // Simulate Windows SMTC or Taskbar firing an action into the renderer
  public triggerMediaAction(action: SmtcMediaAction): void {
    for (const listener of this.actionListeners) {
      listener(action);
    }
  }

  // Global shortcut registry (Electron main process simulation)
  public registerShortcut(accelerator: string, callback: () => void): boolean {
    if (this.shortcutRegistrationBlocked) {
      return false;
    }
    this.registeredShortcuts.set(accelerator, callback);
    return true;
  }

  public unregisterShortcut(accelerator: string): void {
    this.registeredShortcuts.delete(accelerator);
  }

  public unregisterAllShortcuts(): void {
    this.registeredShortcuts.clear();
  }

  public isRegistered(accelerator: string): boolean {
    return this.registeredShortcuts.has(accelerator);
  }

  // Simulate hardware media key press
  public triggerHardwareKey(accelerator: string): boolean {
    const callback = this.registeredShortcuts.get(accelerator);
    if (callback) {
      callback();
      return true;
    }
    return false;
  }

  public getLatestUpdate(): SmtcMediaUpdatePayload | undefined {
    return this.recordedUpdates[this.recordedUpdates.length - 1];
  }
}

let activeSmtcBridge: MockElectronSmtcBridge | null = null;
let originalLinerElectron: any = undefined;

export function installElectronSmtcMock(): MockElectronSmtcBridge {
  const bridge = new MockElectronSmtcBridge();
  activeSmtcBridge = bridge;

  if (typeof window !== "undefined") {
    originalLinerElectron = (window as any).linerElectron;

    const mockApi = {
      ...originalLinerElectron,
      // Desktop SMTC bridge
      sendMediaUpdate: (payload: SmtcMediaUpdatePayload) => bridge.sendMediaUpdate(payload),
      onMediaAction: (cb: (action: SmtcMediaAction) => void) => bridge.onMediaAction(cb),
      // Touchbar / Thumbar bridge compatibility
      touchbarUpdateState: (state: any) => {
        bridge.sendMediaUpdate({
          status: state.status ?? "idle",
          track: state.track ?? null,
          positionMs: 0,
          durationMs: state.track?.durationMs ?? 0,
        });
      },
      onTouchBarAction: (cb: (action: string) => void) => {
        return bridge.onMediaAction((action) => cb(action));
      },
    };

    (window as any).linerElectron = mockApi;
  }

  return bridge;
}

export function uninstallElectronSmtcMock(): void {
  if (typeof window !== "undefined") {
    (window as any).linerElectron = originalLinerElectron;
  }
  activeSmtcBridge = null;
}

export function getActiveSmtcBridge(): MockElectronSmtcBridge | null {
  return activeSmtcBridge;
}
