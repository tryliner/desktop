import { BrowserWindow, ipcMain, type IpcMainEvent } from "electron";
import { registerYoutubeWorkerIpc } from "./worker-ipc.js";

const BOTGUARD_PAGE = "https://www.youtube.com/robots.txt";
const START_TIMEOUT_MS = 20_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const INTERPRETER_HOSTS = new Set(["www.google.com", "www.gstatic.com"]);

export type WorkerMethod = "mint" | "tv-session" | "solve-n";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface WorkerResult {
  id: number;
  value?: unknown;
  error?: string;
}

export class PoTokenService {
  private window: BrowserWindow | null = null;
  private ready: Promise<void> | null = null;
  private markReady: (() => void) | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(private readonly preloadPath: string) {
    ipcMain.on("potoken:ready", (event) => {
      if (event.sender === this.window?.webContents) this.markReady?.();
    });
    ipcMain.on("potoken:result", (event: IpcMainEvent, result: WorkerResult) =>
      this.settle(event, result),
    );
    ipcMain.handle("potoken:interpreter", async (event, url: unknown) => {
      if (event.sender !== this.window?.webContents || typeof url !== "string")
        throw new Error("not allowed");
      const target = new URL(url);
      if (
        target.protocol !== "https:" ||
        !INTERPRETER_HOSTS.has(target.hostname)
      )
        throw new Error("interpreter host not allowed");
      const response = await fetch(target, {
        signal: AbortSignal.timeout(START_TIMEOUT_MS),
      });
      if (!response.ok)
        throw new Error(`interpreter download failed with ${response.status}`);
      return response.text();
    });
    registerYoutubeWorkerIpc(this);
  }

  private settle(event: IpcMainEvent, result: WorkerResult): void {
    if (event.sender !== this.window?.webContents) return;
    const entry = this.pending.get(result.id);
    if (!entry) return;
    this.pending.delete(result.id);
    clearTimeout(entry.timer);
    if (result.error === undefined) entry.resolve(result.value);
    else entry.reject(new Error(result.error || "YouTube worker failed"));
  }

  private start(): Promise<void> {
    if (this.window && !this.window.isDestroyed() && this.ready)
      return this.ready;
    const win = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      width: 320,
      height: 240,
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.webContents.setAudioMuted(true);
    this.window = win;
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("PO token window did not start")),
        START_TIMEOUT_MS,
      );
      this.markReady = () => {
        clearTimeout(timer);
        resolve();
      };
      win.webContents.once("did-fail-load", (_event, _code, description) => {
        clearTimeout(timer);
        reject(new Error(`PO token window failed to load: ${description}`));
      });
    });
    this.ready = ready;
    ready.catch(() => this.destroy());
    win.on("closed", () => this.reset(win));
    void win.loadURL(BOTGUARD_PAGE);
    return ready;
  }

  private reset(win: BrowserWindow): void {
    if (this.window !== win) return;
    this.window = null;
    this.ready = null;
    this.markReady = null;
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error("PO token window closed"));
      this.pending.delete(id);
    }
  }

  async request(
    method: WorkerMethod,
    payload: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    await this.start();
    const win = this.window;
    if (!win || win.isDestroyed())
      throw new Error("PO token window is not available");
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`YouTube worker ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      win.webContents.send("potoken:request", { id, method, payload });
    });
  }

  async mint(identifier: string): Promise<string> {
    const token = await this.request("mint", { identifier });
    if (typeof token !== "string") throw new Error("PO token minting failed");
    return token;
  }

  destroy(): void {
    const win = this.window;
    if (win && !win.isDestroyed()) win.destroy();
    if (win) this.reset(win);
  }
}
