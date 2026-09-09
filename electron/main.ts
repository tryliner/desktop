import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  signCoverUrl,
  signRequest,
  signMonitorRequest,
  signRawPayload,
  type SignRequestInput,
} from "./crypto.js";

// root error handling for main process
process.on("uncaughtException", (error) => {
  console.error("\x1b[41;37m main error \x1b[0m uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("\x1b[41;37m main error \x1b[0m unhandled rejection:", reason);
});

// gpu & performance switches (keeps cpu low inside vms / budget laptops)
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let mainWindow: BrowserWindow | null = null;

const DEFAULT_WINDOW_WIDTH = 1200;
const DEFAULT_WINDOW_HEIGHT = 780;
const MIN_WINDOW_WIDTH = 1100;
const MIN_WINDOW_HEIGHT = 705;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Liner",
    icon: path.join(process.env.VITE_PUBLIC!, "icon.png"),
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(
      `\x1b[41;37m crash \x1b[0m renderer process gone (reason: ${details.reason}, exitCode: ${details.exitCode})`,
    );
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.warn("\x1b[43;30m window \x1b[0m window is temporarily unresponsive");
  });

  mainWindow.webContents.on("responsive", () => {
    console.log("\x1b[42;30m window \x1b[0m window became responsive");
  });

  mainWindow.webContents.on("console-message", (_event, level, message) => {
    // clean devtools format directives for terminal readability
    const cleanMsg = message.replace(/%c/g, "").trim();
    if (level >= 3) {
      console.error(`\x1b[41;37m renderer error \x1b[0m ${cleanMsg}`);
    } else if (level === 2) {
      console.warn(`\x1b[43;30m renderer warn \x1b[0m ${cleanMsg}`);
    } else if (process.env.VITE_DEV_SERVER_URL) {
      console.log(`\x1b[44;37m renderer \x1b[0m ${cleanMsg}`);
    }
  });

  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.type === "keyDown") {
      if (
        input.key === "F12" ||
        ((input.control || input.meta) && input.shift && input.key.toLowerCase() === "i")
      ) {
        mainWindow?.webContents.toggleDevTools();
      }
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // window controls
    ipcMain.handle("window:minimize", () => {
      mainWindow?.minimize();
    });

    ipcMain.handle("window:toggle-maximize", () => {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    });

    ipcMain.handle("window:close", () => {
      mainWindow?.close();
    });

    ipcMain.handle("window:is-maximized", () => {
      return mainWindow?.isMaximized() ?? false;
    });

    ipcMain.on("window:drag-move", (_event, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    });

    // signing ipc handlers
    ipcMain.handle("signer:sign-cover-url", (_event, payload: string) => {
      try {
        return signCoverUrl(payload);
      } catch (err: any) {
        console.error("\x1b[41;37m signer \x1b[0m signCoverUrl error:", err);
        return payload;
      }
    });

    ipcMain.handle(
      "signer:sign-request",
      (_event, request: SignRequestInput) => {
        try {
          return signRequest(request);
        } catch (err: any) {
          console.error("\x1b[41;37m signer \x1b[0m signRequest error:", err);
          return { error: String(err?.message || err) };
        }
      },
    );

    ipcMain.handle(
      "signer:sign-monitor-request",
      (_event, request: SignRequestInput) => {
        try {
          return signMonitorRequest(request);
        } catch (err: any) {
          console.error("\x1b[41;37m signer \x1b[0m signMonitorRequest error:", err);
          return { error: String(err?.message || err) };
        }
      },
    );

    ipcMain.handle(
      "signer:sign-raw-payload",
      (_event, payload: number[] | Uint8Array) => {
        try {
          const buf = Buffer.from(payload);
          return signRawPayload(buf);
        } catch (err) {
          console.error("\x1b[41;37m signer \x1b[0m signRawPayload error:", err);
          return "";
        }
      },
    );

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
