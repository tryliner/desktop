import { app, BrowserWindow, ipcMain, shell, screen } from "electron";
import path from "node:path";
import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";
import https from "node:https";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  signCoverUrl,
  signRequest,
  signMonitorRequest,
  signRawPayload,
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
  parseTraceOutput,
  type MainNetResult,
} from "./netdiag.js";

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

  // renderer ready, deliver any cold-start deeplink waiting in the queue
  mainWindow.webContents.on("did-finish-load", () => {
    flushPendingDeeplink();
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // running instance gets here when xdg-open / os launches liner:// again
    const raw = findDeeplinkArg(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (raw) deliverDeeplink(parseDeeplink(raw));
    } else if (raw) {
      pendingDeeplink = parseDeeplink(raw);
    }
  });

  // macos cold-start / running deeplink delivery
  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverDeeplink(parseDeeplink(url));
  });

  app.whenReady().then(() => {
    // register liner:// so browsers / xdg-open route share links to us
    // (on linux the packaged .desktop carries the mime handler too)
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1]!)]);
    } else {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    }
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

    ipcMain.handle("shell:open-downloads", async () => {
      try {
        const downloadsPath = app.getPath("downloads");
        await shell.openPath(downloadsPath);
        return true;
      } catch (err) {
        console.error("\x1b[41;37m shell \x1b[0m open-downloads error:", err);
        return false;
      }
    });

    // native os window move + system cursor fallback to stop wayland jitter feedback loop
    let dragStartCursor: { x: number; y: number } | null = null;
    let dragStartWinPos: { x: number; y: number } | null = null;

    ipcMain.on("window:start-drag", () => {
      if (!mainWindow) return;
      try {
        if (typeof (mainWindow as any).startWindowMove === "function") {
          (mainWindow as any).startWindowMove();
        }
      } catch {
        // fallback to manual cursor drag if startWindowMove is unsupported
      }
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }
      const [wx, wy] = mainWindow.getPosition();
      dragStartCursor = screen.getCursorScreenPoint();
      dragStartWinPos = { x: wx, y: wy };
    });

    ipcMain.on("window:drag-start", () => {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }
      const [wx, wy] = mainWindow.getPosition();
      dragStartCursor = screen.getCursorScreenPoint();
      dragStartWinPos = { x: wx, y: wy };
    });

    ipcMain.on("window:drag-end", () => {
      dragStartCursor = null;
      dragStartWinPos = null;
    });

    ipcMain.on("window:drag-move", (_event, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        const [wx, wy] = mainWindow.getPosition();
        dragStartCursor = screen.getCursorScreenPoint();
        dragStartWinPos = { x: wx, y: wy };
      }

      if (!dragStartCursor || !dragStartWinPos) {
        const [wx, wy] = mainWindow.getPosition();
        dragStartCursor = screen.getCursorScreenPoint();
        dragStartWinPos = { x: wx, y: wy };
      }

      const currentCursor = screen.getCursorScreenPoint();
      const dx = currentCursor.x - dragStartCursor.x;
      const dy = currentCursor.y - dragStartCursor.y;

      if ((dx !== 0 || dy !== 0) && dragStartWinPos) {
        mainWindow.setPosition(Math.round(dragStartWinPos.x + dx), Math.round(dragStartWinPos.y + dy));
      } else {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
      }
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

    // offline-dump diagnostics: real dns + tcp from the user machine.
    // hosts come from the renderer but are re-validated here.
    ipcMain.handle("net:diagnose", async (_event, hosts: unknown): Promise<MainNetResult> => {
      const list = (
        Array.isArray(hosts)
          ? hosts.filter(
              (h): h is string => typeof h === "string" && MAIN_NET_HOST_RE.test(h),
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
            new Promise<{ host: string; port: number; ok: boolean; ms: number; error?: string }>(
              (resolve) => {
                const start = Date.now();
                const done = (ok: boolean, error?: string) =>
                  resolve({ host, port: 443, ok, ms: Date.now() - start, ...(error ? { error } : {}) });
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
                  done(false, String((err as any)?.code || err.message).slice(0, 120));
                });
                sock.connect(443, host);
              },
            ),
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
                  { host, port: 443, servername: host, rejectUnauthorized: false, timeout: 5000 },
                  () => {
                    const cert = sock.getPeerCertificate() as any;
                    const subject =
                      cert?.subject?.CN || JSON.stringify(cert?.subject || {}).slice(0, 120) || undefined;
                    const issuer =
                      cert?.issuer?.O || cert?.issuer?.CN || JSON.stringify(cert?.issuer || {}).slice(0, 120) || undefined;
                    const protocol = sock.getProtocol() || undefined;
                    const authorized = sock.authorized;
                    sock.destroy();
                    done({ ok: true, protocol, authorized, ...(subject ? { subject } : {}), ...(issuer ? { issuer } : {}) });
                  },
                );
              } catch (err: any) {
                done({ ok: false, error: String(err?.message || err).slice(0, 120) });
                return;
              }
              sock!.once("error", (err) => {
                sock.destroy();
                done({ ok: false, error: String((err as any)?.code || err.message).slice(0, 120) });
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
      ): Promise<{ name: string; ok: boolean; status?: number; detail?: string; ms: number; error?: string }> =>
        new Promise((resolve) => {
          const start = Date.now();
          const done = (patch: Record<string, unknown>) =>
            resolve({ name, ms: Date.now() - start, ...patch } as any);
          let req: ReturnType<typeof https.get>;
          try {
            req = https.get(
              url,
              { timeout: 6000, headers: { "user-agent": "liner-connectivity/1.0" } },
              (res) => {
                let body = "";
                res.on("data", (chunk) => {
                  if (body.length < 2048) body += chunk.toString().slice(0, 2048 - body.length);
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
            done({ ok: false, error: String(err?.message || err).slice(0, 120) });
            return;
          }
          req!.once("timeout", () => {
            req.destroy(new Error("timed out"));
          });
          req!.once("error", (err) => {
            done({ ok: false, error: String((err as any)?.code || err.message).slice(0, 120) });
          });
        });

      const controls = await Promise.all([
        fetchControl("google", "https://www.google.com/generate_204"),
        fetchControl("cloudflare", "https://cloudflare.com/cdn-cgi/trace", (body) => {
          // egress fingerprint for support: exit ip + colo, nothing else
          const ip = /^ip=(.+)$/m.exec(body)?.[1]?.trim();
          const loc = /^loc=(.+)$/m.exec(body)?.[1]?.trim();
          return ip ? `ip ${ip}${loc ? ` · ${loc}` : ""}` : loc ? loc : undefined;
        }),
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
          ? ["-d", "-w", "1000", "-h", String(MAIN_NET_TRACE_MAX_HOPS), traceHost]
          : ["-n", "-w", "1", "-q", "1", "-m", String(MAIN_NET_TRACE_MAX_HOPS), traceHost];
        trace = await new Promise((resolve) => {
          execFile(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 }, (err, stdout) => {
            const hops = parseTraceOutput(String(stdout || ""));
            if (err && (err as any)?.code === "ENOENT") {
              resolve({ host: traceHost, ok: false, hops: [], ms: Date.now() - start, error: "traceroute not installed" });
            } else {
              resolve({
                host: traceHost,
                ok: hops.length > 0,
                hops,
                ms: Date.now() - start,
                ...(!err ? {} : { error: String((err as any)?.code || err.message).slice(0, 120) }),
              });
            }
          });
        });
      }

      let resolvers: string[] | undefined;
      try {
        resolvers = dns.getServers();
      } catch {
        resolvers = undefined;
      }

      return {
        dns: dnsChecks.map((d) => ({ ...d, ...(resolvers ? { resolvers } : {}) })),
        tcp: tcpChecks,
        tls: tlsChecks,
        controls,
        trace,
        platform: `${process.platform} ${process.arch}`,
      };
    });

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
