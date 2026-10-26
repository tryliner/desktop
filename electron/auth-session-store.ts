import fs from "node:fs";
import path from "node:path";

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  user?: unknown;
  [key: string]: unknown;
};

export type AuthRefreshOutcome = "refreshed" | "rotated" | "signed_out" | "transient" | "no_session";

export type AuthRefreshResult = {
  outcome: AuthRefreshOutcome;
  session: StoredAuthSession | null;
  reason?: string;
};

export type SessionCipher = {
  available: () => boolean;
  encrypt: (plain: string) => Buffer;
  decrypt: (data: Buffer) => string;
};

export type AuthSessionStoreDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  syncClock: (dateHeader: string) => void;
  signHeaders?: (method: string, path: string, body: string) => Record<string, string>;
};

export type AuthSessionListener = (session: StoredAuthSession | null, origin?: number) => void;

const DEAD_REFRESH_CODES = new Set(["INVALID_REFRESH_TOKEN", "REFRESH_SESSION_EXPIRED"]);
const REFRESH_PATH = "/v1/auth/refresh";
const REFRESH_TIMEOUT_MS = 15_000;
const REFRESH_ATTEMPTS = 2;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isTrustedApiBase(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" || (protocol === "http:" && LOOPBACK_HOSTS.has(hostname));
  } catch {
    return false;
  }
}

export function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === "string" &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === "string" &&
    candidate.refreshToken.length > 0
  );
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as Record<string, unknown> | null;
    return typeof data?.code === "string" ? data.code : "";
  } catch {
    return "";
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class AuthSessionStore {
  private session: StoredAuthSession | null = null;
  private loaded = false;
  private inFlight: Promise<AuthRefreshResult> | null = null;
  private readonly listeners = new Set<AuthSessionListener>();

  constructor(
    private readonly filePath: string,
    private readonly cipher: SessionCipher,
    private readonly deps: AuthSessionStoreDeps,
  ) {}

  get(): StoredAuthSession | null {
    if (!this.loaded) {
      this.session = this.read();
      this.loaded = true;
    }
    return this.session;
  }

  set(next: unknown, origin?: number): StoredAuthSession | null {
    const session = isStoredAuthSession(next) ? next : null;
    this.commit(session, origin);
    return session;
  }

  onChange(listener: AuthSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  refresh(apiBaseUrl: string, usedRefreshToken?: string, origin?: number): Promise<AuthRefreshResult> {
    const current = this.get();
    if (!current) return Promise.resolve({ outcome: "no_session", session: null });
    if (usedRefreshToken && usedRefreshToken !== current.refreshToken && !this.inFlight) {
      return Promise.resolve({ outcome: "rotated", session: current });
    }
    if (!isTrustedApiBase(apiBaseUrl)) {
      return Promise.resolve({ outcome: "transient", session: current, reason: "untrusted api base url" });
    }
    if (!this.inFlight) {
      this.inFlight = this.runRefresh(apiBaseUrl.replace(/\/+$/, ""), current, origin).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async runRefresh(
    apiBaseUrl: string,
    current: StoredAuthSession,
    origin?: number,
  ): Promise<AuthRefreshResult> {
    let reason = "";
    for (let attempt = 0; attempt < REFRESH_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await this.postRefresh(apiBaseUrl, current.refreshToken);
      } catch (err) {
        return { outcome: "transient", session: this.get(), reason: describeError(err) };
      }

      const dateHeader = response.headers.get("date");
      if (dateHeader) this.deps.syncClock(dateHeader);

      if (response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch (err) {
          return { outcome: "transient", session: this.get(), reason: describeError(err) };
        }
        const next = (body && typeof body === "object" ? body : {}) as Partial<StoredAuthSession>;
        const merged = { ...current, ...next, user: next.user ?? current.user };
        if (!isStoredAuthSession(merged)) {
          return { outcome: "transient", session: this.get(), reason: "malformed refresh response" };
        }
        if (this.get()?.refreshToken !== current.refreshToken) {
          return { outcome: "rotated", session: this.get() };
        }
        this.commit(merged, origin);
        return { outcome: "refreshed", session: merged };
      }

      const code = await readErrorCode(response);
      reason = [String(response.status), code].filter(Boolean).join(" ");
      if (response.status !== 401 && response.status !== 403) break;
      if (DEAD_REFRESH_CODES.has(code)) {
        if (this.get()?.refreshToken === current.refreshToken) this.commit(null, origin);
        return { outcome: this.get() ? "rotated" : "signed_out", session: this.get(), reason };
      }
    }
    return { outcome: "transient", session: this.get(), reason };
  }

  private postRefresh(apiBaseUrl: string, refreshToken: string): Promise<Response> {
    const body = JSON.stringify({ refreshToken });
    return this.deps.fetch(`${apiBaseUrl}${REFRESH_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.deps.signHeaders?.("POST", REFRESH_PATH, body),
      },
      body,
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  }

  private commit(next: StoredAuthSession | null, origin?: number): void {
    this.session = next;
    this.loaded = true;
    this.write(next);
    for (const listener of this.listeners) {
      try {
        listener(next, origin);
      } catch (err) {
        console.error("[auth] session listener failed:", err);
      }
    }
  }

  private read(): StoredAuthSession | null {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, "utf8");
    } catch {
      return null;
    }
    try {
      const envelope = JSON.parse(raw) as { encrypted?: unknown; data?: unknown };
      if (typeof envelope.data !== "string") return null;
      const bytes = Buffer.from(envelope.data, "base64");
      const json = envelope.encrypted === true ? this.cipher.decrypt(bytes) : bytes.toString("utf8");
      const parsed: unknown = JSON.parse(json);
      return isStoredAuthSession(parsed) ? parsed : null;
    } catch (err) {
      console.error("[auth] stored session is unreadable:", describeError(err));
      return null;
    }
  }

  private write(next: StoredAuthSession | null): void {
    try {
      if (!next) {
        fs.rmSync(this.filePath, { force: true });
        return;
      }
      const json = JSON.stringify(next);
      const encrypted = this.cipher.available();
      const data = (encrypted ? this.cipher.encrypt(json) : Buffer.from(json, "utf8")).toString("base64");
      const contents = JSON.stringify({ version: 1, encrypted, data });
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      const fd = fs.openSync(tempPath, "w", 0o600);
      try {
        fs.writeSync(fd, contents);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      try {
        fs.renameSync(tempPath, this.filePath);
      } catch {
        fs.writeFileSync(this.filePath, contents, { mode: 0o600 });
        fs.rmSync(tempPath, { force: true });
      }
    } catch (err) {
      console.error("[auth] failed to persist session:", describeError(err));
    }
  }
}
