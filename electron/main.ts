import {
  app,
  BaseWindow,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  shell,
  screen,
  dialog,
  session,
  nativeImage,
  powerSaveBlocker,
} from "electron";
import type { Display, Rectangle } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";
import https from "node:https";
import {
  execFile as nodeExecFile,
  type ChildProcess,
} from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  signCoverUrl,
  signRequest,
  signMonitorRequest,
  signRawPayload,
  setDevSigningSecret,
  syncServerTime,
  getServerTimeOffset,
  type SignRequestInput,
} from "./crypto.js";
import {
  DEEP_LINK_SCHEME,
  findDeeplinkArg,
  parseDeeplink,
  type DeeplinkTarget,
} from "./deeplink.js";
import {
  MAIN_NET_HOST_RE,
  MAIN_NET_MAX_HOSTS,
  MAIN_NET_TRACE_MAX_HOPS,
  maskIp,
  parseTraceOutput,
  type MainNetResult,
} from "./netdiag.js";
import { TouchBarManager } from "./touchbar.js";
import { registerAuthSessionIpc } from "./auth-session-ipc.js";
import { ThumbarController } from "./thumbar.js";
import { OverlayManager } from "./overlay.js";
import { detectCompositor } from "./compositor/index.js";
import { BundleManager } from "./bundle-manager.js";
import { createBundleErrorStamp } from "./bundle-stamp.js";
import { createSleepBlocker } from "./sleep-blocker.js";
import { withOpenCors } from "./cors.js";
import { createShutdown } from "./shutdown.js";
import {
  computeDragBounds,
  isInTopSnapZone,
  restoreUnderCursor,
} from "./window-drag.js";
import {
  isWindows11,
  loadSnapPreviewAddon,
  NativeSnapPreview,
} from "./snap-native.js";
import { DiscordRpcManager } from "./discord.js";
import { PoTokenService } from "./youtube/potoken.js";
import {
  YOUTUBE_REQUEST_URLS,
  youtubeOriginFor,
} from "./youtube/request-origin.js";

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
// forces resilient http/1.1 to prevent chromium err_http2_ping_failed on dropped network frames
app.commandLine.appendSwitch("disable-http2");
if (detectCompositor() !== "none") {
  app.commandLine.appendSwitch("enable-features", "GlobalShortcutsPortal");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let mainWindow: BrowserWindow | null = null;
let touchBarManager: TouchBarManager | null = null;
let overlayManager: OverlayManager | null = null;
let thumbar: ThumbarController | null = null;
let bundleManager: BundleManager | null = null;
let discordRpcManager: DiscordRpcManager | null = null;
let poTokenService: PoTokenService | null = null;

// every helper process we spawn (tracert, icon cache refresh, ...) is tracked so
// quitting can kill whatever is still running instead of leaving orphans behind
const spawnedChildren = new Set<ChildProcess>();
const execFile = ((...args: Parameters<typeof nodeExecFile>) => {
  const child = nodeExecFile(...args);
  spawnedChildren.add(child);
  child.once("exit", () => spawnedChildren.delete(child));
  child.once("error", () => spawnedChildren.delete(child));
  return child;
}) as typeof nodeExecFile;

// single owner of "the app is going away": releases the overlay, shortcuts,
// translucent "drop to maximize" preview shown while dragging to the top edge
let snapPreview: BaseWindow | null = null;
// compositor-driven preview (native add-on); preferred over snapPreview when built
let nativeSnap: NativeSnapPreview | null = null;

function syncResizable() {
  if (process.platform !== "win32" || !mainWindow || mainWindow.isDestroyed())
    return;
  const locked = mainWindow.isMaximized() || mainWindow.isFullScreen();
  if (mainWindow.isResizable() === locked) mainWindow.setResizable(!locked);
}

// maximize / restore: on windows 11 with the native add-on, a vsync-paced morph of a
// live thumbnail (see NativeSnapPreview.morph); otherwise instant
function maximizeWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const resize = () => {
    mainWindow?.maximize();
    syncResizable();
  };
  if (nativeSnap) nativeSnap.morph(resize);
  else resize();
}

function unmaximizeWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const resize = () => {
    mainWindow?.unmaximize();
    syncResizable();
  };
  if (nativeSnap) nativeSnap.morph(resize);
  else resize();
}

// single owner of "the app is going away": releases the overlay, shortcuts,
// helper processes and every window, then quits and force-exits if that stalls
const shutdown = createShutdown({
  cleanup: [
    () => touchBarManager?.unregisterShortcut(),
    () => overlayManager?.dispose(),
    () => {
      // drop the discord ipc socket so presence clears and nothing keeps the process alive
      discordRpcManager?.destroy();
      discordRpcManager = null;
    },
    () => {
      if (snapPreview && !snapPreview.isDestroyed()) snapPreview.destroy();
      snapPreview = null;
      nativeSnap?.destroy();
      nativeSnap = null;
    },
    () => {
      poTokenService?.destroy();
      poTokenService = null;
    },
    () => globalShortcut.unregisterAll(),
    () => {
      for (const child of spawnedChildren) {
        try {
          child.kill();
        } catch {}
      }
      spawnedChildren.clear();
    },
    () => {
      // destroy() skips close handlers, so a hidden or stuck window cannot veto the quit
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.destroy();
      }
    },
  ],
  quit: () => app.quit(),
  forceExit: () => app.exit(0),
  watchdogMs: 4000,
});

// liner:// deeplink support (share links bounce here from link.tryliner.fun)

// cold-start url arrives before the window exists, stash it until renderer is ready
let pendingDeeplink: DeeplinkTarget | null = findDeeplinkArg(process.argv)
  ? parseDeeplink(findDeeplinkArg(process.argv)!)
  : null;

function deliverDeeplink(target: DeeplinkTarget | null) {
  if (!target) return;
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send("deeplink:open", target);
  } else {
    pendingDeeplink = target;
  }
}

function flushPendingDeeplink() {
  if (pendingDeeplink && mainWindow) {
    mainWindow.webContents.send("deeplink:open", pendingDeeplink);
    pendingDeeplink = null;
  }
}

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
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: true,
      backgroundThrottling: false, // keeps audio timer and playback ticks running when app is in background or another workspace
      webSecurity: true,
    },
  });

  // sync window state changes to renderer
  const broadcastWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("window:state-changed", {
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
      isVisible: mainWindow.isVisible() && !mainWindow.isMinimized(),
    });
  };

  // no edge resizing while maximized / fullscreen: the top edge would otherwise show the
  // resize cursor and grabbing it to drag the window down resizes it instead
  const onMaximizeStateChanged = () => {
    syncResizable();
    broadcastWindowState();
  };
  mainWindow.on("maximize", onMaximizeStateChanged);
  mainWindow.on("unmaximize", onMaximizeStateChanged);
  mainWindow.on("enter-full-screen", onMaximizeStateChanged);
  mainWindow.on("leave-full-screen", onMaximizeStateChanged);
  // transparent windows "maximize" by filling the work area, so catch it on resize too
  mainWindow.on("resize", syncResizable);
  mainWindow.on("minimize", () => {
    broadcastWindowState();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("window:minimized");
  });
  mainWindow.on("restore", () => {
    broadcastWindowState();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("window:restored");
  });
  mainWindow.on("hide", broadcastWindowState);
  mainWindow.on("show", broadcastWindowState);

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
    console.warn(
      "\x1b[43;30m window \x1b[0m window is temporarily unresponsive",
    );
  });

  mainWindow.webContents.on("responsive", () => {
    console.log("\x1b[42;30m window \x1b[0m window became responsive");
  });

  mainWindow.webContents.on("console-message", (_event, level, message) => {
    // clean devtools format directives for terminal readability
    const cleanMsg = message.replace(/%c/g, "").trim();
    try {
      fs.appendFileSync(
        path.join(process.cwd(), "renderer.log"),
        `[${level}] ${cleanMsg}\n`,
      );
    } catch {}
    if (level >= 3) {
      console.error(`\x1b[41;37m renderer error \x1b[0m ${cleanMsg}`);
    } else if (level === 2) {
      console.warn(`\x1b[43;30m renderer warn \x1b[0m ${cleanMsg}`);
    } else if (process.env.VITE_DEV_SERVER_URL) {
      console.log(`\x1b[44;37m renderer \x1b[0m ${cleanMsg}`);
    }
  });

  const bundleErrorStamp = createBundleErrorStamp(
    {
      getVersionInfo: () => {
        const active = bundleManager?.getActiveState();
        return {
          version: active?.bundleVersion || app.getVersion(),
          isOta: Boolean(active),
          sha256: active?.sha256 || null,
        };
      },
      peekUpdate: async () =>
        bundleManager ? bundleManager.peekUpdate() : { kind: "inactive" },
    },
    { emit: (line) => mainWindow?.webContents.send("bundle:stamp", line) },
  );
  mainWindow.webContents.on("console-message", (_event, level) => {
    if (level >= 3) bundleErrorStamp.onRendererError();
  });
  mainWindow.on("closed", () => bundleErrorStamp.dispose());

  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.type === "keyDown") {
      if (
        input.key === "F12" ||
        ((input.control || input.meta) &&
          input.shift &&
          input.key.toLowerCase() === "i")
      ) {
        mainWindow?.webContents.toggleDevTools();
      }
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    bundleManager = new BundleManager({
      defaultRendererDist: RENDERER_DIST,
    });
    bundleManager.setMainWindow(mainWindow);
    const manager = bundleManager;
    const win = mainWindow;
    void (async () => {
      if (app.isPackaged)
        await manager.updateBeforeLaunch().catch(() => undefined);
      if (!win.isDestroyed()) win.loadFile(manager.getEffectiveIndexPath());
    })();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // renderer ready, deliver any cold-start deeplink waiting in the queue
  mainWindow.webContents.on("did-finish-load", () => {
    flushPendingDeeplink();
  });

  mainWindow.on("closed", () => {
    // a hidden drag-snap preview would otherwise keep window-all-closed from firing
    if (snapPreview && !snapPreview.isDestroyed()) snapPreview.destroy();
    snapPreview = null;
    nativeSnap?.destroy();
    nativeSnap = null;
    poTokenService?.destroy();
    mainWindow = null;
    if (process.platform === "darwin") {
      // macOS keeps the app alive without windows; the overlay can be rebuilt on activate
      overlayManager?.destroy();
    } else {
      // closing the main window (title bar button, taskbar, alt+f4) ends the whole app
      shutdown.quit();
    }
  });

  touchBarManager?.setMainWindow(mainWindow);
  overlayManager?.setMainWindow(mainWindow);
  mainWindow.on("show", () => thumbar?.refresh());
  mainWindow.on("restore", () => thumbar?.refresh());
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.warn(
    "\n\x1b[33m[Liner]\x1b[0m Another instance of Liner is already running in the background. Exiting development instance.\nTo run in development mode, please close the running Liner application first.\n",
  );
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // running instance gets here when xdg-open / os launches liner:// again
    const raw = findDeeplinkArg(argv);
    if (shutdown.isQuitting()) {
      // this process is on its way out and can no longer show a window; the new
      // launch already handed over to us and exited, so start a fresh instance
      // once we are gone instead of swallowing the launch
      app.relaunch({
        args: process.argv.slice(1).filter((a) => !a.startsWith("--inspect")),
      });
      app.exit(0);
      return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    if (raw) deliverDeeplink(parseDeeplink(raw));
  });

  // macos cold-start / running deeplink delivery
  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverDeeplink(parseDeeplink(url));
  });

  app.whenReady().then(() => {
    if (!app.isPackaged && process.env.LINER_DEV_SIGNING_SECRET) {
      setDevSigningSecret(process.env.LINER_DEV_SIGNING_SECRET);
      console.log(
        "\x1b[43;30m signer \x1b[0m dev signing secret active (unpackaged build only)",
      );
    }

    // register liner:// so browsers / xdg-open route share links to us
    // (on linux the packaged .desktop carries the mime handler too)
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [
        path.resolve(process.argv[1]!),
      ]);
    } else {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    }
    touchBarManager = new TouchBarManager(
      path.join(__dirname, "preload.cjs"),
      RENDERER_DIST,
    );
    touchBarManager.registerShortcut();

    const updateSleepBlocker = createSleepBlocker(powerSaveBlocker);
    thumbar = new ThumbarController(
      () => mainWindow,
      (type) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send("overlay:action", { type });
      },
    );
    ipcMain.on(
      "touchbar:update-state",
      (_event, state: { status: string; track?: unknown }) => {
        updateSleepBlocker(state.status);
        thumbar?.update(state);
      },
    );

    overlayManager = new OverlayManager(
      path.join(__dirname, "preload.cjs"),
      RENDERER_DIST,
    );
    overlayManager.setIndexPathResolver(
      () =>
        bundleManager?.getEffectiveIndexPath() ??
        path.join(RENDERER_DIST, "index.html"),
    );
    overlayManager.setMainWindow(mainWindow);
    // F in the overlay: the window grows back out of the pill (windows 11 + add-on)
    overlayManager.setFocusMainHandler((restore) => {
      const overlay = overlayManager;
      if (nativeSnap && overlay) {
        overlay.holdForTransition(); // it is closed (hidden) once the transform lands
        void nativeSnap.fromOverlay(overlay.getWindow(), restore, () =>
          overlay.closeOverlay(),
        );
      } else restore();
    });
    overlayManager.setRestoreInterceptor(() => {
      const overlay = overlayManager;
      if (!nativeSnap || !overlay || !nativeSnap.takeRestoredCloaked())
        return false;
      void nativeSnap.fromOverlay(
        overlay.getWindow(),
        () => {},
        () => overlay.closeOverlay(),
        true,
      );
      return true;
    });
    overlayManager.registerShortcut();

    discordRpcManager = new DiscordRpcManager();
    poTokenService = new PoTokenService(path.join(__dirname, "preload.cjs"));

    const isHyprland = Boolean(
      process.env.HYPRLAND_INSTANCE_SIGNATURE ||
      process.env.XDG_CURRENT_DESKTOP?.toLowerCase().includes("hyprland") ||
      process.env.XDG_SESSION_DESKTOP?.toLowerCase().includes("hyprland"),
    );

    // window controls
    ipcMain.handle("window:minimize", () => {
      // cannot minimize a native fullscreen window or under hyprland tiling wm
      if (!mainWindow || mainWindow.isFullScreen() || isHyprland) return;
      // windows 11 + add-on: the window flies into the overlay pill it is about to become
      if (
        nativeSnap &&
        overlayManager?.willShowOnMinimize() &&
        overlayManager.isReadyForTransition()
      ) {
        const overlay = overlayManager;
        void nativeSnap.toOverlay(
          (beforeShow) => overlay.openForTransition(beforeShow),
          () => mainWindow?.minimize(),
        );
        return;
      }
      mainWindow.minimize();
    });

    ipcMain.handle("window:toggle-maximize", () => {
      if (!mainWindow) return;
      // on macos, frameless windows enter native fullscreen mode
      if (process.platform === "darwin") {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      } else {
        if (mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(false);
        } else if (mainWindow.isMaximized()) {
          unmaximizeWindow();
        } else {
          maximizeWindow();
        }
      }
    });

    ipcMain.handle("window:toggle-fullscreen", () => {
      if (!mainWindow) return;
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });

    ipcMain.handle("window:close", () => {
      mainWindow?.close();
    });

    ipcMain.handle("window:is-maximized", () => {
      return mainWindow?.isMaximized() ?? false;
    });

    ipcMain.handle("window:is-fullscreen", () => {
      return mainWindow?.isFullScreen() ?? false;
    });

    ipcMain.handle("app:get-version", () => {
      return app.getVersion();
    });

    let lastIconBytes: Buffer | null = null;
    // serialize fs work on the icon theme so rapid accent switches cannot
    // leave an install and a remove interleaved
    let linuxIconTask: Promise<void> = Promise.resolve();

    // linux dash/taskbar/launcher icons come from the freedesktop icon theme,
    // not from the window (wayland has no window-icon protocol at all, and
    // gnome ignores _NET_WM_ICON), so persist the rendered branding icon into
    // the user-level hicolor theme and refresh caches best-effort.
    //
    // sizes mirror every one the .deb ships in /usr/share/icons/hicolor so the
    // dock keeps exact-match resolution across the whole range (an
    // exact 48px hit beats a themed lookup into our 512px icon).
    const HICON_SIZES = [16, 32, 48, 64, 128, 256, 512] as const;

    const linuxDataHome = () =>
      process.env.XDG_DATA_HOME && path.isAbsolute(process.env.XDG_DATA_HOME)
        ? process.env.XDG_DATA_HOME
        : path.join(os.homedir(), ".local", "share");

    const appIconPaths = (iconName: string) =>
      HICON_SIZES.map((size) => {
        const dir = path.join(
          linuxDataHome(),
          "icons",
          "hicolor",
          `${size}x${size}`,
          "apps",
        );
        return { size, dir, file: path.join(dir, `${iconName}.png`) };
      });

    const refreshLinuxIconCaches = () => {
      const dataHome = linuxDataHome();
      const tryOnce = (cmd: string, args: string[]) => {
        try {
          // missing binaries (and their output) are ignored quietly
          execFile(cmd, args, { timeout: 5000 }, () => {});
        } catch {}
      };
      // gtk's icon cache is the only one our injected files affect;
      // update-desktop-database rebuilds the MIME cache and never touches
      // icons
      tryOnce("gtk-update-icon-cache", [
        "-f",
        "-t",
        path.join(dataHome, "icons", "hicolor"),
      ]);
    };

    // electron-builder writes `desktopName` into the packaged package.json
    // (syncDesktopName) and uses it for /usr/share/applications/<name>.desktop
    // and the Icon= key; app.getDesktopFileName() doesn't exist in this
    // Electron, so read the field Electron would.
    const resolveLinuxDesktopIconName = async (): Promise<string> => {
      try {
        const raw = await fs.promises.readFile(
          path.join(app.getAppPath(), "package.json"),
          "utf8",
        );
        const desktopName = JSON.parse(raw)?.desktopName as unknown;
        if (typeof desktopName === "string" && desktopName.trim()) {
          return desktopName.trim();
        }
      } catch {}
      return "liner";
    };

    const installLinuxAppIcon = async (iconName: string, png: Buffer) => {
      const source = nativeImage.createFromBuffer(png);
      if (source.isEmpty()) return;
      for (const { size, dir, file } of appIconPaths(iconName)) {
        await fs.promises.mkdir(dir, { recursive: true });
        // the incoming bitmap IS 512px; keep its exact bytes there and
        // downscale for every other directory in the theme
        if (size === 512) {
          await fs.promises.writeFile(file, png);
        } else {
          await fs.promises.writeFile(
            file,
            source
              .resize({ width: size, height: size, quality: "best" })
              .toPNG(),
          );
        }
      }
      refreshLinuxIconCaches();
    };

    const removeLinuxAppIcon = async (iconName: string) => {
      let removedAny = false;
      for (const { file } of appIconPaths(iconName)) {
        try {
          // only real removals (and the cache refresh) matter; force keeps
          // an already-missing file silent
          await fs.promises.access(file);
          removedAny = true;
          await fs.promises.rm(file, { force: true });
        } catch {}
      }
      if (removedAny) refreshLinuxIconCaches();
    };

    ipcMain.handle(
      "app:set-icon",
      async (_event, dataUrl: string, options?: { isDefault?: boolean }) => {
        if (!mainWindow || !dataUrl) return;
        try {
          const icon = nativeImage.createFromDataURL(dataUrl);
          if (!icon.isEmpty()) {
            mainWindow.setIcon(icon);
            if (process.platform === "darwin" && app.dock) {
              app.dock.setIcon(icon);
            }
            // linux: apply to the icon dash/taskbar actually shows. only in the
            // packaged app so dev runs do not pollute the user's icon theme.
            if (process.platform === "linux" && app.isPackaged) {
              const png = /^data:image\/png;base64,(.+)$/.exec(dataUrl)?.[1];
              if (png) {
                const bytes = Buffer.from(png, "base64");
                // chain onto the previous icon task so a fast accent switch
                // (e.g. spotify then default) cannot interleave install/remove
                const runIconTask = async () => {
                  try {
                    if (options?.isDefault) {
                      // branding back to stock: drop the injected icon and let the
                      // packaged system icon win again
                      lastIconBytes = null;
                      await removeLinuxAppIcon(
                        await resolveLinuxDesktopIconName(),
                      );
                    } else if (!lastIconBytes || !lastIconBytes.equals(bytes)) {
                      lastIconBytes = bytes;
                      await installLinuxAppIcon(
                        await resolveLinuxDesktopIconName(),
                        bytes,
                      );
                    }
                  } catch (err) {
                    console.error(
                      "\x1b[41;37m icon \x1b[0m set-icon error:",
                      err,
                    );
                  }
                };
                linuxIconTask = linuxIconTask.then(runIconTask);
              }
            }
          }
        } catch (err) {
          console.error("\x1b[41;37m icon \x1b[0m set-icon error:", err);
        }
      },
    );

    session.defaultSession.webRequest.onBeforeSendHeaders(
      {
        urls: [
          ...YOUTUBE_REQUEST_URLS,
          "*://api.music.apple.com/*",
          "*://amp-api.music.apple.com/*",
        ],
      },
      (details, callback) => {
        const requestHeaders: Record<string, string> = {};
        let userAgentOverride: string | undefined;
        for (const [name, value] of Object.entries(details.requestHeaders)) {
          const lower = name.toLowerCase();
          if (lower === "x-liner-user-agent") {
            userAgentOverride = value;
          } else if (lower !== "origin" && lower !== "referer") {
            requestHeaders[name] = value;
          }
        }
        const origin = details.url.includes("music.apple.com/")
          ? "https://music.apple.com"
          : youtubeOriginFor(details.url);
        requestHeaders["Origin"] = origin;
        requestHeaders["Referer"] = `${origin}/`;
        if (userAgentOverride) {
          for (const name of Object.keys(requestHeaders)) {
            if (name.toLowerCase() === "user-agent")
              delete requestHeaders[name];
          }
          requestHeaders["User-Agent"] = userAgentOverride;
        }
        callback({ requestHeaders });
      },
    );

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback(withOpenCors(details.responseHeaders, details.method));
    });

    let lastSavedExportPath: string | null = null;

    session.defaultSession.on("will-download", (_event, item) => {
      item.once("done", (_e, state) => {
        if (state === "completed") {
          lastSavedExportPath = item.getSavePath();
        }
      });
    });

    const openFolderOrItem = async (customPath?: string) => {
      try {
        const targetPath = customPath || lastSavedExportPath;
        if (targetPath && fs.existsSync(targetPath)) {
          // opens explorer/finder highlighting the exported file
          shell.showItemInFolder(targetPath);
          return true;
        }
        if (targetPath) {
          const dir = path.dirname(targetPath);
          if (fs.existsSync(dir)) {
            await shell.openPath(dir);
            return true;
          }
        }
        const downloadsPath = app.getPath("downloads");
        await shell.openPath(downloadsPath);
        return true;
      } catch (err) {
        console.error(
          "\x1b[41;37m shell \x1b[0m open-export-folder error:",
          err,
        );
        return false;
      }
    };

    ipcMain.handle(
      "shell:open-downloads",
      async (_event, customPath?: string) => {
        return openFolderOrItem(customPath);
      },
    );

    ipcMain.handle(
      "shell:open-export-folder",
      async (_event, customPath?: string) => {
        return openFolderOrItem(customPath);
      },
    );

    // locates provider path where cache is collected
    const getCacheDirectory = () => {
      const userData = app.getPath("userData");
      const subCache = path.join(userData, "Cache");
      if (fs.existsSync(subCache)) return subCache;
      return userData;
    };

    // recursively sums folder size in bytes safely
    const getDirectorySizeSafe = async (dirPath: string): Promise<number> => {
      let total = 0;
      try {
        if (!fs.existsSync(dirPath)) return 0;
        const entries = await fs.promises.readdir(dirPath, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          const full = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            total += await getDirectorySizeSafe(full);
          } else if (entry.isFile()) {
            const s = await fs.promises.stat(full);
            total += s.size;
          }
        }
      } catch {}
      return total;
    };

    // recursively deletes all files and subdirectories inside dirPath safely
    const clearDirectoryContentsSafe = async (
      dirPath: string,
    ): Promise<void> => {
      try {
        if (!fs.existsSync(dirPath)) return;
        const entries = await fs.promises.readdir(dirPath, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          const full = path.join(dirPath, entry.name);
          try {
            await fs.promises.rm(full, { recursive: true, force: true });
          } catch {}
        }
      } catch {}
    };

    // recursively clears all *.indexeddb.blob directories within IndexedDB folder
    const clearIndexedDbBlobsSafe = async (idbDir: string): Promise<void> => {
      try {
        if (!fs.existsSync(idbDir)) return;
        const entries = await fs.promises.readdir(idbDir, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.endsWith(".indexeddb.blob")) {
            await clearDirectoryContentsSafe(path.join(idbDir, entry.name));
            try {
              await fs.promises.rm(path.join(idbDir, entry.name), {
                recursive: true,
                force: true,
              });
            } catch {}
          }
        }
      } catch {}
    };

    ipcMain.handle("storage:get-cache-stats", async () => {
      try {
        const userData = app.getPath("userData");
        const cachePath = getCacheDirectory();

        const [
          sessionCache,
          diskHttpCache,
          diskCodeCache,
          swCache,
          idbCache,
          lsCache,
          blobCache,
        ] = await Promise.all([
          session.defaultSession.getCacheSize().catch(() => 0),
          getDirectorySizeSafe(path.join(userData, "Cache")),
          getDirectorySizeSafe(path.join(userData, "Code Cache")),
          getDirectorySizeSafe(path.join(userData, "Service Worker")),
          getDirectorySizeSafe(path.join(userData, "IndexedDB")),
          getDirectorySizeSafe(path.join(userData, "Local Storage")),
          getDirectorySizeSafe(path.join(userData, "blob_storage")),
        ]);

        const httpCacheSize = Math.max(sessionCache, diskHttpCache);

        return {
          cacheSize: httpCacheSize + diskCodeCache,
          httpCacheSize,
          codeCacheSize: diskCodeCache,
          serviceWorkerSize: swCache,
          indexedDbSize: idbCache,
          localStorageSize: lsCache,
          blobStorageSize: blobCache,
          cachePath,
        };
      } catch (err) {
        console.error(
          "\x1b[41;37m storage \x1b[0m get-cache-stats error:",
          err,
        );
        return {
          cacheSize: 0,
          httpCacheSize: 0,
          codeCacheSize: 0,
          serviceWorkerSize: 0,
          indexedDbSize: 0,
          localStorageSize: 0,
          blobStorageSize: 0,
          cachePath: app.getPath("userData"),
        };
      }
    });

    ipcMain.handle("shell:open-cache-folder", async () => {
      try {
        const cachePath = getCacheDirectory();
        await shell.openPath(cachePath);
        return true;
      } catch (err) {
        console.error(
          "\x1b[41;37m shell \x1b[0m open-cache-folder error:",
          err,
        );
        return false;
      }
    });

    ipcMain.handle("storage:clear-covers-cache", async () => {
      try {
        await session.defaultSession.clearStorageData({
          storages: ["serviceworkers", "cachestorage"],
        });
        const userData = app.getPath("userData");
        await clearDirectoryContentsSafe(path.join(userData, "Service Worker"));
        return true;
      } catch (err) {
        console.error(
          "\x1b[41;37m storage \x1b[0m clear-covers-cache error:",
          err,
        );
        return false;
      }
    });

    ipcMain.handle(
      "storage:clear-audio-cache",
      async (_event, clearEntireDb?: boolean) => {
        try {
          const userData = app.getPath("userData");
          if (clearEntireDb) {
            await session.defaultSession
              .clearStorageData({
                storages: ["indexdb"],
              })
              .catch(() => {});
          }
          await clearIndexedDbBlobsSafe(path.join(userData, "IndexedDB"));
          await clearDirectoryContentsSafe(path.join(userData, "blob_storage"));
          await session.defaultSession.clearCache().catch(() => {});
          return true;
        } catch (err) {
          console.error(
            "\x1b[41;37m storage \x1b[0m clear-audio-cache error:",
            err,
          );
          return false;
        }
      },
    );

    // clears chromium http and v8 code cache
    ipcMain.handle("storage:clear-http-cache", async () => {
      try {
        await session.defaultSession.clearCache();
        await session.defaultSession.clearCodeCaches({});
        const userData = app.getPath("userData");
        await clearDirectoryContentsSafe(path.join(userData, "Cache"));
        await clearDirectoryContentsSafe(path.join(userData, "Code Cache"));
        return true;
      } catch (err) {
        console.error(
          "\x1b[41;37m storage \x1b[0m clear-http-cache error:",
          err,
        );
        return false;
      }
    });

    // manual window move for windows/macos, anchored on the system cursor.
    // linux uses css app-region instead (see useWindowDrag): wayland ignores setPosition.
    // moves go through setBounds with the size locked at drag start: setPosition
    // on scaled / mixed-dpi windows displays rounds the size and grows the window
    // (see window-drag.ts)
    let dragStartCursor: { x: number; y: number } | null = null;
    let dragging = false; // between the renderer's drag-start and drag-end
    let dragStartBounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null;

    const beginDrag = () => {
      if (!mainWindow) return;
      dragStartCursor = screen.getCursorScreenPoint();
      dragStartBounds = mainWindow.getBounds();
    };

    // drag-to-top snap (windows only). the custom drag bypasses aero snap, so we
    // mirror it: touching the top edge shows windows' own acrylic blur over the work
    // area (over every other app, under ours); pulling away hides it; dropping
    // maximizes instantly.
    //
    // why there is no js animation: a backdrop window resized from js can't be smooth
    // (dwm recomputes the acrylic per resize and main-process timers aren't vsync), so
    // the preview is placed at its final size once and shown / hidden; windows itself
    // draws the transition. nothing runs per frame, so nothing can stutter.
    // the drag never pays for it either: no screen capture, the preview is a bare
    // native window created (and primed) in the background after startup, and per
    // drag move only a couple of cheap checks run.
    // a windows 11 exclusive (elsewhere dragging to the top just moves the window)
    const snapEnabled = isWindows11();
    // acrylic needs windows 11 22h2 (build 22621)+; older builds get a flat tint
    const acrylicSupported =
      snapEnabled && Number(os.release().split(".")[2] ?? 0) >= 22621;
    const SNAP_RELEASE_PX = 24; // armed snap holds until the cursor is this far below the edge
    const SNAP_INSET = 8; // gap between the preview and the work area edges

    let snapReady = false;
    let snapArmed = false;
    let snapDisplay: Display | null = null;
    let previewVisible = false;
    let mainRaised = false;
    let mainWasOnTop = false;
    let previewHideTimer: ReturnType<typeof setTimeout> | null = null;

    const previewRectFor = (display: Display): Rectangle => {
      const area = display.workArea;
      return {
        x: area.x + SNAP_INSET,
        y: area.y + SNAP_INSET,
        width: area.width - SNAP_INSET * 2,
        height: area.height - SNAP_INSET * 2,
      };
    };

    const createSnapPreview = () => {
      if (snapPreview && !snapPreview.isDestroyed()) return;
      // a bare native window (no web contents); the tint is its background colour
      // (#AARRGGBB) over the acrylic. it is NOT always-on-top: shown, it lands at the
      // top of the normal band (above every other app) while ours is raised above it,
      // so it can never cover us, not even for a frame
      const preview = new BaseWindow({
        show: false,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        focusable: false,
        skipTaskbar: true,
        hasShadow: false,
        ...(acrylicSupported
          ? {
              backgroundMaterial: "acrylic" as const,
              backgroundColor: "#29808080",
            }
          : { transparent: true, backgroundColor: "#9a767676" }),
      });
      snapPreview = preview;
      preview.setIgnoreMouseEvents(true);
      preview.on("closed", () => {
        snapReady = false;
        previewVisible = false;
      });
      // prime: show it once off-screen at full size so dwm sets up the backdrop now,
      // not on the first real snap
      const primary = screen.getPrimaryDisplay();
      const rect = previewRectFor(primary);
      preview.setBounds({
        x: -32000,
        y: -32000,
        width: rect.width,
        height: rect.height,
      });
      preview.showInactive();
      setTimeout(() => {
        if (preview.isDestroyed()) return;
        preview.hide();
        snapReady = true;
      }, 300);
    };

    // one-time cost (creating + priming the window), paid in the background, never in a drag
    if (snapEnabled) {
      const warmUp = () => {
        if (dragStartCursor) {
          setTimeout(warmUp, 1000);
          return;
        }
        // preferred: the compositor-driven native preview (smooth, no per-frame work)
        const addon = loadSnapPreviewAddon(
          process.env.APP_ROOT ?? path.join(__dirname, ".."),
        );
        if (addon) {
          nativeSnap = NativeSnapPreview.create(addon, () => mainWindow, {
            insetDip: SNAP_INSET,
            tuckInsetDip: 20,
            radiusDip: 8,
            growMs: 220,
            collapseMs: 240,
            tint: 0x29808080,
            tintNoBlur: 0x9a767676,
          });
          if (nativeSnap) {
            nativeSnap.prime(screen.getPrimaryDisplay());
            overlayManager?.enablePrewarm(); // the first hand-off to the overlay starts at once
            return;
          }
        }
        if (!addon)
          console.warn(
            "[snap-preview] native add-on not available (using the plain preview)",
          );
        // fallback: a plain acrylic window, shown / hidden without animation
        try {
          createSnapPreview();
        } catch {
          // no preview: drop-to-maximize still works
        }
      };
      app.whenReady().then(() => setTimeout(warmUp, 2500));
    }

    const raiseMain = () => {
      if (!mainWindow || mainWindow.isDestroyed() || mainRaised) return;
      mainRaised = true;
      mainWasOnTop = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(true, "pop-up-menu");
    };

    const lowerMain = () => {
      if (!mainRaised) return;
      mainRaised = false;
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.setAlwaysOnTop(mainWasOnTop);
    };

    const hidePreview = () => {
      if (previewHideTimer) {
        clearTimeout(previewHideTimer);
        previewHideTimer = null;
      }
      if (previewVisible && snapPreview && !snapPreview.isDestroyed())
        snapPreview.hide();
      previewVisible = false;
      lowerMain();
    };

    const armSnap = (display: Display) => {
      snapArmed = true;
      snapDisplay = display;
      if (nativeSnap) {
        nativeSnap.arm(display);
        return;
      }
      const preview = snapPreview;
      // not ready yet: still armed for drop-to-maximize, just no preview this time
      if (!snapReady || !preview || preview.isDestroyed()) return;
      if (previewHideTimer) {
        clearTimeout(previewHideTimer);
        previewHideTimer = null;
      }
      raiseMain(); // first, so the preview can only ever appear below us
      preview.setBounds(previewRectFor(display));
      if (!previewVisible) {
        preview.showInactive();
        // top of the normal band: above every other app, still below our raised window
        preview.moveTop();
        previewVisible = true;
      }
    };

    const disarmSnap = () => {
      snapArmed = false;
      snapDisplay = null;
      if (nativeSnap) {
        nativeSnap.collapse();
        return;
      }
      hidePreview();
    };

    const settleSnap = () => {
      const display = snapEnabled && snapArmed ? snapDisplay : null;
      if (
        !display ||
        !mainWindow ||
        mainWindow.isDestroyed() ||
        mainWindow.isMaximized()
      ) {
        if (snapArmed || previewVisible) disarmSnap();
        else nativeSnap?.follow();
        return;
      }
      snapArmed = false;
      snapDisplay = null;
      const area = display.workArea;
      const from = mainWindow.getBounds();
      // park the window inside the target display first (same size, no resize) so
      // electron maximizes onto the display under the cursor
      const parked = {
        ...from,
        x:
          from.width >= area.width
            ? area.x
            : Math.min(
                Math.max(from.x, area.x),
                area.x + area.width - from.width,
              ),
        y: Math.max(from.y, area.y),
      };
      if (parked.x !== from.x || parked.y !== from.y)
        mainWindow.setBounds(parked);
      // the window morphs into the screen over the blur (native add-on), or fills it at
      // once with the plain fallback preview
      if (nativeSnap) {
        nativeSnap.morph(() => {
          mainWindow?.maximize();
          syncResizable();
        });
        return;
      }
      mainWindow.maximize();
      syncResizable();
      if (previewVisible) previewHideTimer = setTimeout(hidePreview, 120);
      else lowerMain();
    };

    const trackSnap = (cursor: { x: number; y: number }) => {
      const display = screen.getDisplayNearestPoint(cursor);
      // arms on the very top edge; once armed it holds until the cursor clearly
      // leaves (like windows), so a small wobble doesn't flicker it away
      const holding =
        snapArmed &&
        snapDisplay?.id === display.id &&
        isInTopSnapZone(cursor, display.bounds, SNAP_RELEASE_PX);
      if (holding || isInTopSnapZone(cursor, display.bounds)) {
        if (!snapArmed || snapDisplay?.id !== display.id) armSnap(display);
      } else if (snapArmed) {
        disarmSnap();
      } else {
        nativeSnap?.follow(); // collapsing: keep the box on the window
      }
    };

    // dragging a maximized window out: restore it under the cursor instead of
    // jumping back to wherever it was before maximize (instant, like windows)
    const restoreForDrag = () => {
      if (!mainWindow) return;
      const maximized = mainWindow.getBounds();
      const normal = mainWindow.getNormalBounds();
      const restoredSize =
        normal.width > 0 &&
        normal.height > 0 &&
        (normal.width < maximized.width || normal.height < maximized.height)
          ? normal
          : null;
      const targetUnderCursor = (size: { width: number; height: number }) =>
        restoreUnderCursor(maximized, size, screen.getCursorScreenPoint());
      const resize = () => {
        if (!mainWindow) return;
        mainWindow.unmaximize();
        mainWindow.setBounds(
          targetUnderCursor(restoredSize ?? mainWindow.getBounds()),
        );
        syncResizable();
        // the drag continues from where the window landed
        if (dragging) beginDrag();
      };
      // windows 11 + add-on: the window shrinks down into place under the cursor and
      // keeps following it (see followMorph in drag-move)
      if (nativeSnap) nativeSnap.morphDragOut(resize);
      else resize();
    };

    ipcMain.on("window:drag-start", () => {
      if (!mainWindow || mainWindow.isFullScreen()) return;
      dragging = true;
      if (mainWindow.isMaximized()) restoreForDrag();
      beginDrag();
    });

    ipcMain.on("window:drag-end", () => {
      dragging = false;
      dragStartCursor = null;
      dragStartBounds = null;
      if (snapEnabled) settleSnap();
    });

    ipcMain.on("window:drag-move", () => {
      if (!mainWindow || mainWindow.isFullScreen()) return;
      if (mainWindow.isMaximized()) {
        restoreForDrag();
        beginDrag();
      }
      if (!dragStartCursor || !dragStartBounds) beginDrag();
      if (!dragStartCursor || !dragStartBounds) return;

      const cursor = screen.getCursorScreenPoint();
      const next = computeDragBounds(dragStartBounds, dragStartCursor, cursor);
      const cur = mainWindow.getBounds();
      if (
        next.x !== cur.x ||
        next.y !== cur.y ||
        next.width !== cur.width ||
        next.height !== cur.height
      ) {
        mainWindow.setBounds(next);
      }
      nativeSnap?.followMorph(); // restoring from maximize: keep the morph on the window
      if (snapEnabled) trackSnap(cursor);
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
          console.error(
            "\x1b[41;37m signer \x1b[0m signMonitorRequest error:",
            err,
          );
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
          console.error(
            "\x1b[41;37m signer \x1b[0m signRawPayload error:",
            err,
          );
          return "";
        }
      },
    );

    ipcMain.handle(
      "signer:sync-time",
      (_event, dateHeaderOrMs: string | number) => {
        try {
          return syncServerTime(dateHeaderOrMs);
        } catch (err) {
          console.error(
            "\x1b[41;37m signer \x1b[0m syncServerTime error:",
            err,
          );
          return 0;
        }
      },
    );

    ipcMain.handle("signer:get-time-offset", () => {
      return getServerTimeOffset();
    });

    const authSessions = registerAuthSessionIpc();
    overlayManager?.bindAuthSource(
      () => Boolean(authSessions.get()),
      (listener) => authSessions.onChange(() => listener()),
    );

    createWindow();

    // offline-dump diagnostics: real dns + tcp from the user machine.
    // hosts come from the renderer but are re-validated here.
    ipcMain.handle(
      "net:diagnose",
      async (_event, hosts: unknown): Promise<MainNetResult> => {
        const list = (
          Array.isArray(hosts)
            ? hosts.filter(
                (h): h is string =>
                  typeof h === "string" && MAIN_NET_HOST_RE.test(h),
              )
            : []
        ).slice(0, MAIN_NET_MAX_HOSTS);

        const timed = async <T>(
          fn: () => Promise<T>,
        ): Promise<{ ok: boolean; ms: number; value?: T; error?: string }> => {
          const start = Date.now();
          try {
            return { ok: true, ms: Date.now() - start, value: await fn() };
          } catch (err: any) {
            return {
              ok: false,
              ms: Date.now() - start,
              error: String(err?.code || err?.message || err).slice(0, 120),
            };
          }
        };

        const dnsChecks = await Promise.all(
          list.map(async (host) => {
            const r = await timed(() => dns.promises.lookup(host));
            return {
              host,
              ok: r.ok,
              ...(r.value ? { addresses: [r.value.address] } : {}),
              ms: r.ms,
              ...(!r.ok ? { error: r.error } : {}),
            };
          }),
        );

        const tcpChecks = await Promise.all(
          list.map(
            (host) =>
              new Promise<{
                host: string;
                port: number;
                ok: boolean;
                ms: number;
                error?: string;
              }>((resolve) => {
                const start = Date.now();
                const done = (ok: boolean, error?: string) =>
                  resolve({
                    host,
                    port: 443,
                    ok,
                    ms: Date.now() - start,
                    ...(error ? { error } : {}),
                  });
                const sock = new net.Socket();
                sock.setTimeout(5000);
                sock.once("connect", () => {
                  sock.destroy();
                  done(true);
                });
                sock.once("timeout", () => {
                  sock.destroy();
                  done(false, "timed out");
                });
                sock.once("error", (err) => {
                  sock.destroy();
                  done(
                    false,
                    String((err as any)?.code || err.message).slice(0, 120),
                  );
                });
                sock.connect(443, host);
              }),
          ),
        );

        // tls handshake with verification off on purpose: a portal or proxy
        // still answers, and its (untrusted) cert + failed authorized flag
        // is exactly the evidence support needs.
        const tlsChecks = await Promise.all(
          list.map(
            (host) =>
              new Promise<{
                host: string;
                ok: boolean;
                protocol?: string;
                authorized?: boolean;
                subject?: string;
                issuer?: string;
                ms: number;
                error?: string;
              }>((resolve) => {
                const start = Date.now();
                const done = (patch: Record<string, unknown>) =>
                  resolve({ host, ms: Date.now() - start, ...patch } as any);
                let sock: tls.TLSSocket;
                try {
                  sock = tls.connect(
                    {
                      host,
                      port: 443,
                      servername: host,
                      rejectUnauthorized: false,
                      timeout: 5000,
                    },
                    () => {
                      const cert = sock.getPeerCertificate() as any;
                      const subject =
                        cert?.subject?.CN ||
                        JSON.stringify(cert?.subject || {}).slice(0, 120) ||
                        undefined;
                      const issuer =
                        cert?.issuer?.O ||
                        cert?.issuer?.CN ||
                        JSON.stringify(cert?.issuer || {}).slice(0, 120) ||
                        undefined;
                      const protocol = sock.getProtocol() || undefined;
                      const authorized = sock.authorized;
                      sock.destroy();
                      done({
                        ok: true,
                        protocol,
                        authorized,
                        ...(subject ? { subject } : {}),
                        ...(issuer ? { issuer } : {}),
                      });
                    },
                  );
                } catch (err: any) {
                  done({
                    ok: false,
                    error: String(err?.message || err).slice(0, 120),
                  });
                  return;
                }
                sock!.once("error", (err) => {
                  sock.destroy();
                  done({
                    ok: false,
                    error: String((err as any)?.code || err.message).slice(
                      0,
                      120,
                    ),
                  });
                });
                sock!.once("timeout", () => {
                  sock.destroy();
                  done({ ok: false, error: "timed out" });
                });
              }),
          ),
        );

        // control endpoints outside our infra: if these pass but ours fail,
        // the break is past the user's lan, not on their machine.
        const fetchControl = (
          name: string,
          url: string,
          pick?: (body: string) => string | undefined,
        ): Promise<{
          name: string;
          ok: boolean;
          status?: number;
          detail?: string;
          ms: number;
          error?: string;
        }> =>
          new Promise((resolve) => {
            const start = Date.now();
            const done = (patch: Record<string, unknown>) =>
              resolve({ name, ms: Date.now() - start, ...patch } as any);
            let req: ReturnType<typeof https.get>;
            try {
              req = https.get(
                url,
                {
                  timeout: 6000,
                  headers: { "user-agent": "liner-connectivity/1.0" },
                },
                (res) => {
                  let body = "";
                  res.on("data", (chunk) => {
                    if (body.length < 2048)
                      body += chunk.toString().slice(0, 2048 - body.length);
                  });
                  res.on("end", () => {
                    const detail = pick?.(body);
                    done({
                      ok: (res.statusCode ?? 0) < 400,
                      status: res.statusCode,
                      ...(detail ? { detail } : {}),
                    });
                  });
                },
              );
            } catch (err: any) {
              done({
                ok: false,
                error: String(err?.message || err).slice(0, 120),
              });
              return;
            }
            req!.once("timeout", () => {
              req.destroy(new Error("timed out"));
            });
            req!.once("error", (err) => {
              done({
                ok: false,
                error: String((err as any)?.code || err.message).slice(0, 120),
              });
            });
          });

        const controls = await Promise.all([
          fetchControl("google", "https://www.google.com/generate_204"),
          fetchControl(
            "cloudflare",
            "https://cloudflare.com/cdn-cgi/trace",
            (body) => {
              // egress fingerprint for support: masked exit ip + colo, nothing else
              const ip = /^ip=(.+)$/m.exec(body)?.[1]?.trim();
              const loc = /^loc=(.+)$/m.exec(body)?.[1]?.trim();
              return ip
                ? `ip ${maskIp(ip)}${loc ? ` · ${loc}` : ""}`
                : loc
                  ? loc
                  : undefined;
            },
          ),
        ]);

        // best-effort system traceroute to the api host, shows the dying hop.
        // unprivileged udp mode, skipped quietly when the tool is missing.
        const traceHost = list[0];
        let trace: MainNetResult["trace"] = null;
        if (traceHost) {
          const start = Date.now();
          const isWin = process.platform === "win32";
          const cmd = isWin ? "tracert" : "traceroute";
          const args = isWin
            ? [
                "-d",
                "-w",
                "1000",
                "-h",
                String(MAIN_NET_TRACE_MAX_HOPS),
                traceHost,
              ]
            : [
                "-n",
                "-w",
                "1",
                "-q",
                "1",
                "-m",
                String(MAIN_NET_TRACE_MAX_HOPS),
                traceHost,
              ];
          trace = await new Promise((resolve) => {
            execFile(
              cmd,
              args,
              { timeout: 30000, maxBuffer: 16 * 1024 },
              (err, stdout) => {
                const hops = parseTraceOutput(String(stdout || ""));
                if (err && (err as any)?.code === "ENOENT") {
                  resolve({
                    host: traceHost,
                    ok: false,
                    hops: [],
                    ms: Date.now() - start,
                    error: "traceroute not installed",
                  });
                } else {
                  resolve({
                    host: traceHost,
                    ok: hops.length > 0,
                    hops,
                    ms: Date.now() - start,
                    ...(!err
                      ? {}
                      : {
                          error: String(
                            (err as any)?.code || err.message,
                          ).slice(0, 120),
                        }),
                  });
                }
              },
            );
          });
        }

        let resolvers: string[] | undefined;
        try {
          resolvers = dns.getServers();
        } catch {
          resolvers = undefined;
        }

        return {
          dns: dnsChecks.map((d) => ({
            ...d,
            ...(resolvers ? { resolvers } : {}),
          })),
          tcp: tcpChecks,
          tls: tlsChecks,
          controls,
          trace,
          platform: `${process.platform} ${process.arch}`,
        };
      },
    );

    // updater config: production github releases only, no prereleases or auto-install on close
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    autoUpdater.on("update-available", (info) => {
      mainWindow?.webContents.send("updater:update-available", {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes:
          typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
      });
    });

    autoUpdater.on("download-progress", (progressObj) => {
      mainWindow?.webContents.send("updater:download-progress", {
        percent: Math.round(progressObj.percent * 10) / 10,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      mainWindow?.webContents.send("updater:update-downloaded", {
        version: info.version,
      });
    });

    autoUpdater.on("error", (err) => {
      console.error(
        "\x1b[31m updater \x1b[0m autoUpdater error:",
        err?.message || err,
      );
      mainWindow?.webContents.send("updater:error", {
        message: err?.message || "Update check failed",
      });
    });

    ipcMain.handle("updater:check-for-updates", async () => {
      if (!app.isPackaged) {
        return { available: false, error: "Updater is disabled in dev mode" };
      }
      try {
        const result = await autoUpdater.checkForUpdates();
        return {
          available: Boolean(
            result?.updateInfo?.version &&
            result.updateInfo.version !== app.getVersion(),
          ),
          version: result?.updateInfo?.version,
          releaseNotes:
            typeof result?.updateInfo?.releaseNotes === "string"
              ? result.updateInfo.releaseNotes
              : undefined,
        };
      } catch (err: any) {
        return {
          available: false,
          error: err?.message || "Failed to check for updates",
        };
      }
    });

    ipcMain.handle("updater:download-update", async () => {
      if (!app.isPackaged) {
        return { success: false, error: "Updater is disabled in dev mode" };
      }
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Failed to download update",
        };
      }
    });

    ipcMain.handle("updater:quit-and-install", () => {
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
      return true;
    });

    // OTA bundle updater IPC handlers
    ipcMain.handle("bundle:check", async () => {
      if (!bundleManager) {
        return {
          available: false,
          error: "Bundle updater inactive (dev mode)",
        };
      }
      return await bundleManager.checkForUpdates();
    });

    ipcMain.handle("bundle:download-and-install", async (_event, manifest) => {
      if (!bundleManager) {
        return { success: false, error: "Bundle updater inactive (dev mode)" };
      }
      return await bundleManager.downloadAndInstall(manifest);
    });

    ipcMain.handle("bundle:hot-swap", () => {
      if (!bundleManager) return false;
      return bundleManager.hotSwap();
    });

    ipcMain.handle("bundle:rollback", () => {
      if (!bundleManager) return false;
      return bundleManager.rollback();
    });

    ipcMain.handle("bundle:get-status", () => {
      const activeState = bundleManager?.getActiveState?.() || null;
      return {
        appVersion: app.getVersion(),
        bundleVersion: activeState?.bundleVersion || app.getVersion(),
        isOta: Boolean(activeState),
        sha256: activeState?.sha256 || null,
        effectivePath: bundleManager
          ? bundleManager.getEffectiveIndexPath()
          : RENDERER_DIST,
      };
    });

    // automatic update check after window initialization (packaged app only)
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          console.error(
            "\x1b[31m updater \x1b[0m background check error:",
            err?.message || err,
          );
        });
      }, 4000);

      // check for OTA bundles every 15 minutes silently in background
      setInterval(
        () => {
          bundleManager?.checkForUpdates().catch(() => {});
        },
        15 * 60 * 1000,
      );
    }

    app.on("activate", () => {
      if (
        !shutdown.isQuitting() &&
        BrowserWindow.getAllWindows().length === 0
      ) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    shutdown.quit();
  }
});

// covers every other way out: cmd+q, the updater's quitAndInstall, os shutdown
app.on("before-quit", () => shutdown.begin());
app.on("will-quit", () => shutdown.begin());
