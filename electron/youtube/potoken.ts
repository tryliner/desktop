import { BrowserWindow, ipcMain, type IpcMainEvent } from "electron";
import { registerYoutubeWorkerIpc } from "./worker-ipc.js";

const BOTGUARD_PAGE = "https://www.youtube.com/robots.txt";
const START_TIMEOUT_MS = 20_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const INTERPRETER_HOSTS = new Set(["www.google.com", "www.gstatic.com"]);
const IDLE_SHUTDOWN_MS = 5 * 60_000;
const MINT_CACHE_LIMIT = 256;
const N_CACHE_LIMIT = 1024;

export type WorkerMethod = "mint" | "tv-session" | "solve-n";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface Expiring<T> {
  value: T;
  expiresAt: number;
}

interface SolveResult {
  signatureTimestamp: number;
  values: string[];
}

function remember<K, V>(map: Map<K, V>, key: K, value: V, limit: number) {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) {
    const oldest = map.keys().next().value as K;
    map.delete(oldest);
  }
}

function readExpiry(value: unknown): number {
  const expiresAt = (value as { expiresAt?: unknown } | null)?.expiresAt;
  return typeof expiresAt === "number" && Number.isFinite(expiresAt)
    ? expiresAt
    : 0;
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
  private idleTimer: NodeJS.Timeout | null = null;
  private used = false;
  private playbackActive = false;
  private readonly mints = new Map<string, Expiring<string>>();
  private tvSession: Expiring<unknown> | null = null;
  private readonly solvedN = new Map<string, string>();
  private readonly signatureTimestamps = new Map<string, number>();

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
    this.scheduleIdleShutdown();
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

  warm(): void {
    if (!this.used) return;
    if (this.window && !this.window.isDestroyed()) {
      this.scheduleIdleShutdown();
      return;
    }
    this.cancelIdleShutdown();
    void this.start()
      .then(() => this.scheduleIdleShutdown())
      .catch(() => {});
  }

  setPlaybackActive(active: boolean): void {
    this.playbackActive = active;
    if (active) this.warm();
    else this.scheduleIdleShutdown();
  }

  private cancelIdleShutdown(): void {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private scheduleIdleShutdown(): void {
    this.cancelIdleShutdown();
    if (!this.window || this.window.isDestroyed()) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.pending.size > 0 || this.playbackActive) {
        this.scheduleIdleShutdown();
        return;
      }
      this.destroy();
    }, IDLE_SHUTDOWN_MS);
  }

  async request(
    method: WorkerMethod,
    payload: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    this.used = true;
    this.cancelIdleShutdown();
    try {
      await this.start();
    } catch (error) {
      this.scheduleIdleShutdown();
      throw error;
    }
    const win = this.window;
    if (!win || win.isDestroyed())
      throw new Error("PO token window is not available");
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.scheduleIdleShutdown();
        reject(new Error(`YouTube worker ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      win.webContents.send("potoken:request", { id, method, payload });
    });
  }

  async mint(identifier: string): Promise<string> {
    const cached = this.mints.get(identifier);
    if (cached && Date.now() < cached.expiresAt) return cached.value;
    const result = await this.request("mint", { identifier });
    const token = (result as { token?: unknown } | null)?.token;
    if (typeof token !== "string") throw new Error("PO token minting failed");
    remember(
      this.mints,
      identifier,
      { value: token, expiresAt: readExpiry(result) },
      MINT_CACHE_LIMIT,
    );
    return token;
  }

  async getTvSession(timeoutMs: number): Promise<unknown> {
    const cached = this.tvSession;
    if (cached && Date.now() < cached.expiresAt) return cached.value;
    const result = (await this.request("tv-session", {}, timeoutMs)) as {
      session?: unknown;
    } | null;
    if (!result?.session) throw new Error("YouTube TV session failed");
    this.tvSession = { value: result.session, expiresAt: readExpiry(result) };
    return result.session;
  }

  async solveN(
    playerId: string,
    values: string[],
    timeoutMs: number,
  ): Promise<SolveResult> {
    const key = (value: string) => `${playerId}:${value}`;
    const missing = [
      ...new Set(values.filter((value) => !this.solvedN.has(key(value)))),
    ];
    const knownTimestamp = this.signatureTimestamps.get(playerId);
    if (missing.length > 0 || knownTimestamp === undefined) {
      const result = (await this.request(
        "solve-n",
        { playerId, values: missing },
        timeoutMs,
      )) as SolveResult;
      if (
        typeof result?.signatureTimestamp !== "number" ||
        !Array.isArray(result.values) ||
        result.values.length !== missing.length
      )
        throw new Error("YouTube n solving failed");
      this.signatureTimestamps.set(playerId, result.signatureTimestamp);
      missing.forEach((value, index) =>
        remember(
          this.solvedN,
          key(value),
          String(result.values[index]),
          N_CACHE_LIMIT,
        ),
      );
    }
    return {
      signatureTimestamp: this.signatureTimestamps.get(playerId)!,
      values: values.map((value) => this.solvedN.get(key(value))!),
    };
  }

  destroy(): void {
    this.cancelIdleShutdown();
    const win = this.window;
    if (win && !win.isDestroyed()) win.destroy();
    if (win) this.reset(win);
  }
}
