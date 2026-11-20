import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { vi } from "vitest";
import type { OverlayManager } from "./overlay";

export const electron = createElectronMock();

function createElectronMock() {
  const ipcOn = new Map<string, (...args: unknown[]) => unknown>();
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const windows: FakeWindow[] = [];
  let nextId = 1;

  class FakeContents extends EventEmitter {
    id = nextId++;
    send = vi.fn();
    executeJavaScript = vi.fn(async () => 1);
  }

  class FakeWindow extends EventEmitter {
    webContents = new FakeContents();
    visible: boolean;
    destroyed = false;
    bounds: { x: number; y: number; width: number; height: number };
    loadFile = vi.fn(async () => {});
    loadURL = vi.fn(async () => {});
    showInactive = vi.fn(() => {
      this.visible = true;
    });
    hide = vi.fn(() => {
      this.visible = false;
    });
    constructor(
      options: {
        show?: boolean;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      } = {},
    ) {
      super();
      this.visible = options.show ?? true;
      this.bounds = {
        x: options.x ?? 0,
        y: options.y ?? 0,
        width: options.width ?? 0,
        height: options.height ?? 0,
      };
      windows.push(this);
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
    isVisible() {
      return this.visible;
    }
    focused = false;
    isFocused() {
      return this.focused;
    }
    getBounds() {
      return this.bounds;
    }
    setBounds(b: { x: number; y: number; width: number; height: number }) {
      this.bounds = b;
    }
    opacity = 1;
    setOpacity = vi.fn((value: number) => {
      this.opacity = value;
    });
    setAlwaysOnTop() {}
    moveTop = vi.fn(() => {
      this.visible = true;
    });
    setVisibleOnAllWorkspaces() {}
  }

  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  return {
    ipcOn,
    handlers,
    windows,
    FakeWindow,
    module: {
      BrowserWindow: FakeWindow,
      ipcMain: {
        on: (channel: string, handler: (...args: unknown[]) => unknown) =>
          ipcOn.set(channel, handler),
        handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
          handlers.set(channel, handler),
      },
      screen: {
        getPrimaryDisplay: () => display,
        getDisplayMatching: () => display,
      },
      globalShortcut: { register: () => true, unregister: () => {} },
      app: {
        getPath: () => tmpdir() + "/liner-overlay-test-missing",
      },
    },
  };
}

type Win = InstanceType<typeof electron.FakeWindow>;

export function setupOverlay(Overlay: typeof OverlayManager, signedIn = true) {
  const manager = new Overlay("/preload.cjs", "/dist");
  const main = new electron.FakeWindow({ show: true });
  manager.setMainWindow(main as never);
  manager.bindAuthSource(
    () => signedIn,
    () => {},
  );
  const overlays = () => electron.windows.filter((w) => w !== main);
  const ready = (win: Win) =>
    electron.ipcOn.get("overlay:ready")?.({ sender: win.webContents });
  return { manager, main, overlays, ready };
}
