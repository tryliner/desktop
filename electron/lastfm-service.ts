import type {
  LastfmCredentials,
  LastfmListen,
  LastfmStatus,
} from "../src/features/lastfm/contracts";
import {
  LastfmApi,
  LastfmError,
  validCredentials,
  validLastfmListen,
  validLastfmTrack,
} from "./lastfm-api";
import { emptyLastfmData, type LastfmData } from "./lastfm-store";

interface LastfmDeps {
  api: LastfmApi;
  credentials?: LastfmCredentials;
  load: (owner: string) => LastfmData;
  save: (owner: string, data: LastfmData) => void;
  secure: () => boolean;
  openBrowser: (url: string) => Promise<unknown>;
  changed: (status: LastfmStatus) => void;
}

export class LastfmService {
  private owner: string | null = null;
  private data = emptyLastfmData();
  private error?: string;
  private pendingAuth?: {
    token: string;
    expiresAt: number;
    credentials: LastfmCredentials;
  };
  private controller = new AbortController();
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private flushing = false;
  private authorizing = false;
  private failures = 0;
  private nowPlayingId = "";
  private blocked = false;
  private storageUnreadable = false;

  constructor(private readonly deps: LastfmDeps) {}

  private credentials(): LastfmCredentials | undefined {
    return this.data.credentials ?? this.deps.credentials;
  }

  status(): LastfmStatus {
    return {
      ownerId: this.owner ?? undefined,
      configured: validCredentials(this.credentials()),
      connected: Boolean(this.data.session),
      username: this.data.session?.username ?? this.data.username,
      authorizing: this.authorizing || Boolean(this.pendingAuth),
      enabled: this.data.enabled,
      nowPlaying: this.data.nowPlaying,
      pending: this.data.queue.length,
      sessionOnly: !this.deps.secure(),
      error: this.storageUnreadable ? "storage_unreadable" : this.error,
    };
  }

  private emit() {
    this.deps.changed(this.status());
  }

  private persist() {
    if (!this.owner) return;
    if (this.storageUnreadable)
      throw new Error("Stored Last.fm data is unreadable.");
    this.deps.save(this.owner, this.data);
  }

  private resetRequests() {
    this.generation++;
    this.controller.abort();
    this.controller = new AbortController();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.flushing = false;
    this.authorizing = false;
    this.pendingAuth = undefined;
    this.nowPlayingId = "";
    this.blocked = false;
    this.failures = 0;
  }

  setOwner(owner: string | null) {
    if (this.owner === owner && !this.storageUnreadable) return;
    this.resetRequests();
    this.owner = owner;
    this.data = emptyLastfmData();
    this.storageUnreadable = false;
    this.error = undefined;
    if (owner) {
      try {
        this.data = this.deps.load(owner);
      } catch {
        this.storageUnreadable = true;
      }
    }
    this.emit();
    void this.flush();
  }

  async connect(credentials?: LastfmCredentials): Promise<LastfmStatus> {
    if (!this.owner) throw new Error("Sign in to Liner first.");
    if (this.storageUnreadable)
      throw new Error("Stored Last.fm data is unreadable.");
    if (credentials !== undefined && !validCredentials(credentials))
      throw new Error("Invalid Last.fm application credentials.");
    const config = credentials ?? this.credentials();
    if (!validCredentials(config))
      throw new Error("Last.fm application credentials are required.");
    this.resetRequests();
    const generation = this.generation;
    this.authorizing = true;
    this.error = undefined;
    this.emit();
    try {
      const result = await this.deps.api.request(
        config,
        "auth.getToken",
        {},
        this.controller.signal,
      );
      if (generation !== this.generation) return this.status();
      if (typeof result.token !== "string" || !result.token)
        throw new Error("Invalid Last.fm token response.");
      this.pendingAuth = {
        token: result.token,
        expiresAt: Date.now() + 60 * 60 * 1000,
        credentials: config,
      };
      const url = new URL("https://www.last.fm/api/auth/");
      url.search = new URLSearchParams({
        api_key: config.apiKey,
        token: result.token,
      }).toString();
      await this.deps.openBrowser(url.toString());
    } catch {
      if (generation === this.generation) {
        this.pendingAuth = undefined;
        this.error = "authorization_failed";
      }
    } finally {
      if (generation === this.generation) {
        this.authorizing = false;
        this.emit();
      }
    }
    return this.status();
  }

  async finish(): Promise<LastfmStatus> {
    const pending = this.pendingAuth;
    if (this.authorizing) return this.status();
    if (!pending || Date.now() >= pending.expiresAt) {
      this.pendingAuth = undefined;
      this.error = "authorization_expired";
      this.emit();
      return this.status();
    }
    const generation = this.generation;
    this.authorizing = true;
    try {
      const result = await this.deps.api.request(
        pending.credentials,
        "auth.getSession",
        { token: pending.token },
        this.controller.signal,
      );
      if (generation !== this.generation) return this.status();
      if (
        !result.session ||
        typeof result.session.name !== "string" ||
        !result.session.name ||
        typeof result.session.key !== "string" ||
        !result.session.key
      ) {
        throw new Error("Invalid Last.fm session response.");
      }
      const username = result.session.name;
      const sameAccount =
        this.data.username?.toLowerCase() === username.toLowerCase();
      this.data = {
        ...this.data,
        credentials: pending.credentials,
        session: { username, key: result.session.key },
        username,
        enabled: true,
        queue: sameAccount ? this.data.queue : [],
        recent: sameAccount ? this.data.recent : [],
      };
      this.pendingAuth = undefined;
      this.error = undefined;
      this.blocked = false;
      try {
        this.persist();
      } catch {
        this.error = "storage_failed";
      }
    } catch (err) {
      if (generation === this.generation) {
        if (err instanceof LastfmError && [4, 15].includes(err.code)) {
          this.pendingAuth = undefined;
          this.error = "authorization_expired";
        } else
          this.error =
            err instanceof LastfmError && err.code === 14
              ? "authorization_pending"
              : "authorization_failed";
      }
    } finally {
      if (generation === this.generation) {
        this.authorizing = false;
        this.emit();
      }
    }
    void this.flush();
    return this.status();
  }

  cancel(): LastfmStatus {
    this.resetRequests();
    this.error = undefined;
    this.emit();
    void this.flush();
    return this.status();
  }

  disconnect(): LastfmStatus {
    this.resetRequests();
    this.storageUnreadable = false;
    this.data = { ...emptyLastfmData(), credentials: this.data.credentials };
    this.error = undefined;
    try {
      this.persist();
    } catch {
      this.error = "storage_failed";
    }
    this.emit();
    return this.status();
  }

  settings(patch: { enabled?: boolean; nowPlaying?: boolean }): LastfmStatus {
    if (
      !patch ||
      typeof patch !== "object" ||
      (patch.enabled !== undefined && typeof patch.enabled !== "boolean") ||
      (patch.nowPlaying !== undefined && typeof patch.nowPlaying !== "boolean")
    )
      throw new Error("Invalid Last.fm settings.");
    if (this.storageUnreadable)
      throw new Error("Stored Last.fm data is unreadable.");
    const previous = this.data;
    this.data = {
      ...this.data,
      enabled: patch.enabled ?? this.data.enabled,
      nowPlaying: patch.nowPlaying ?? this.data.nowPlaying,
    };
    try {
      this.persist();
    } catch {
      this.data = previous;
      this.error = "storage_failed";
    }
    if (!this.data.enabled && this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.emit();
    void this.flush();
    return this.status();
  }

  async enqueue(listen: LastfmListen): Promise<boolean> {
    if (
      !validLastfmListen(listen) ||
      !this.owner ||
      !this.data.session ||
      !this.data.enabled ||
      this.pendingAuth
    )
      return false;
    if (
      this.data.recent.includes(listen.id) ||
      this.data.queue.some((item) => item.id === listen.id)
    )
      return true;
    if (this.data.queue.length >= 10000 || this.storageUnreadable) {
      this.error =
        this.data.queue.length >= 10000 ? "queue_full" : "storage_unreadable";
      this.emit();
      return false;
    }
    this.data.queue.push({ ...listen });
    try {
      this.persist();
    } catch {
      this.data.queue.pop();
      this.error = "storage_failed";
      this.emit();
      return false;
    }
    this.emit();
    void this.flush();
    return true;
  }

  async updateNowPlaying(track: LastfmListen) {
    if (
      !validLastfmTrack(track) ||
      !this.owner ||
      !this.data.session ||
      !this.data.enabled ||
      !validCredentials(this.credentials()) ||
      !this.data.nowPlaying ||
      this.pendingAuth
    )
      return;
    const id = track.id;
    if (typeof id !== "string" || !id || id.length > 128) return;
    if (this.nowPlayingId === id) return;
    this.nowPlayingId = id;
    const generation = this.generation;
    try {
      await this.deps.api.nowPlaying(
        this.credentials()!,
        this.data.session.key,
        track,
        this.controller.signal,
      );
    } catch (err) {
      if (
        generation === this.generation &&
        err instanceof LastfmError &&
        err.code === 9
      )
        this.expired();
    }
    // Now Playing failures are deliberately not retried.
  }

  private expired() {
    this.data.session = undefined;
    this.error = "reauthorize";
    try {
      this.persist();
    } catch {
      this.error = "storage_failed";
    }
    this.emit();
  }

  async retry(): Promise<LastfmStatus> {
    if (this.storageUnreadable) return this.status();
    this.blocked = false;
    this.failures = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.flush();
    return this.status();
  }

  private scheduleRetry() {
    const delay = Math.min(
      60 * 60 * 1000,
      30000 * 2 ** Math.min(this.failures++, 7),
    );
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
    this.timer.unref?.();
  }

  async flush(): Promise<void> {
    if (
      this.flushing ||
      this.timer ||
      this.blocked ||
      this.storageUnreadable ||
      this.pendingAuth ||
      this.authorizing ||
      !this.owner ||
      !this.data.enabled ||
      !this.data.session ||
      !validCredentials(this.credentials()) ||
      !this.data.queue.length
    )
      return;
    this.flushing = true;
    const generation = this.generation;
    const batch = this.data.queue.slice(0, 50);
    try {
      const result = await this.deps.api.scrobble(
        this.credentials()!,
        this.data.session.key,
        batch,
        this.controller.signal,
      );
      if (generation !== this.generation) return;
      const raw = result.scrobbles?.scrobble;
      const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (
        items.length !== batch.length ||
        items.some(
          (item) =>
            !item?.ignoredMessage ||
            !/^\d+$/.test(String(item.ignoredMessage.code)),
        )
      ) {
        throw new LastfmError(16, "Invalid Last.fm scrobble response.");
      }
      const previous = {
        ...this.data,
        queue: [...this.data.queue],
        recent: [...this.data.recent],
      };
      this.data.queue.splice(0, batch.length);
      this.data.recent = [
        ...this.data.recent,
        ...batch.map((item) => item.id),
      ].slice(-1000);
      try {
        this.persist();
      } catch {
        this.data = previous;
        throw new LastfmError(16, "Storage failure");
      }
      this.failures = 0;
      this.error = items.some((item) => Number(item.ignoredMessage.code) !== 0)
        ? "scrobble_ignored"
        : undefined;
      this.emit();
    } catch (err) {
      if (generation !== this.generation) return;
      const code = err instanceof LastfmError ? err.code : 16;
      if (code === 9) this.expired();
      else if ([11, 16, 29].includes(code)) {
        this.error = "retrying";
        this.scheduleRetry();
        this.emit();
      } else {
        this.error = "submission_failed";
        this.blocked = true;
        this.emit();
      }
    } finally {
      if (generation === this.generation) {
        this.flushing = false;
        if (
          !this.timer &&
          !this.blocked &&
          this.data.session &&
          this.data.enabled &&
          this.data.queue.length
        )
          void this.flush();
      }
    }
  }

  destroy() {
    this.resetRequests();
  }
}
