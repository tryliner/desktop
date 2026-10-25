import { Client, StatusDisplayType, type SetActivity } from "@xhayper/discord-rpc";
import { ipcMain } from "electron";

const ARRPC_USERNAME = "arrpc";

export type DiscordStatusDisplayType =
  | "artist"
  | "title"
  | "artist_title"
  | "title_artist"
  | "app";

export interface DiscordRpcSettings {
  enabled: boolean;
  statusDisplayType: DiscordStatusDisplayType;
  showArtwork: boolean;
  showArtistSmallImage: boolean;
  showTime: boolean;
  showPaused: boolean;
  showButton: boolean;
  showDownloadButton: boolean;
}

export interface DiscordRpcTrackInfo {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  coverUrl?: string;
  durationMs: number;
}

export interface DiscordRpcStatePayload {
  status: "playing" | "paused" | "loading" | "buffering" | "idle" | "error";
  track: DiscordRpcTrackInfo | null;
  positionMs: number;
  durationMs: number;
  artistImageUrl?: string;
}

export const LINER_DISCORD_APPLICATION_ID = "1561339119617974362";

function builtInApplicationId(): string {
  return process.env.LINER_DISCORD_CLIENT_ID?.trim() || LINER_DISCORD_APPLICATION_ID;
}

const DEFAULT_SETTINGS: DiscordRpcSettings = {
  enabled: true,
  statusDisplayType: "artist",
  showArtwork: true,
  showArtistSmallImage: true,
  showTime: true,
  showPaused: true,
  showButton: true,
  showDownloadButton: true,
};

const RECONNECT_INTERVAL_MS = 15_000;
const SYNC_DEBOUNCE_MS = 1_000;
const MIN_SYNC_INTERVAL_MS = 4_000;
const MAX_IMAGE_URL_LENGTH = 256;

export function toDiscordImageUrl(url: string | undefined): string | undefined {
  if (!url || url.length > MAX_IMAGE_URL_LENGTH) return undefined;
  try {
    return new URL(url).protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeText(text: string | undefined | null, maxLen = 128): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.length === 1) return trimmed + " ";
  return trimmed.slice(0, maxLen);
}

export class DiscordRpcManager {
  private client: Client | null = null;
  private settings: DiscordRpcSettings = { ...DEFAULT_SETTINGS };
  private latestPayload: DiscordRpcStatePayload | null = null;
  private latestPayloadReceivedAt = 0;
  private isConnecting = false;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastSyncAt = 0;
  private isDestroyed = false;

  constructor() {
    this.registerIpcHandlers();
    this.connect();
  }

  private registerIpcHandlers(): void {
    ipcMain.on("discord:update-state", (_event, payload: DiscordRpcStatePayload) => {
      this.updateState(payload);
    });

    ipcMain.on("discord:update-settings", (_event, patch: Partial<DiscordRpcSettings>) => {
      this.updateSettings(patch);
    });

    ipcMain.handle("discord:get-status", () => {
      const user = this.client?.user;
      if (user?.username === ARRPC_USERNAME) {
        return { connected: this.isConnected, viaArrpc: true };
      }
      return {
        connected: this.isConnected,
        username: user?.username,
        avatarUrl: user?.avatar ? user.avatarUrl : undefined,
      };
    });
  }

  private scheduleSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    const wait = Math.max(SYNC_DEBOUNCE_MS, MIN_SYNC_INTERVAL_MS - (Date.now() - this.lastSyncAt));
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.lastSyncAt = Date.now();
      void this.syncActivity();
    }, wait);
  }

  private clearSyncTimer(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || !this.settings.enabled || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected && !this.isConnecting && this.settings.enabled) {
        this.connect();
      }
    }, RECONNECT_INTERVAL_MS);
  }

  private connect(): void {
    if (this.isDestroyed || !this.settings.enabled || this.isConnecting || this.isConnected) {
      return;
    }

    const clientId = builtInApplicationId();
    if (!clientId) return;
    this.isConnecting = true;

    try {
      if (this.client) {
        try {
          this.client.destroy();
        } catch {}
        this.client = null;
      }

      const client = new Client({ clientId });
      this.client = client;

      client.on("ready", () => {
        if (this.client !== client || this.isDestroyed) return;
        this.isConnecting = false;
        this.isConnected = true;
        this.clearReconnectTimer();

        // Push latest state if available
        if (this.latestPayload) {
          this.scheduleSync();
        }
      });

      client.on("disconnected", () => {
        if (this.client !== client) return;
        this.isConnecting = false;
        this.isConnected = false;
        this.scheduleReconnect();
      });

      client.login().catch((_err) => {
        if (this.client !== client) return;
        this.isConnecting = false;
        this.isConnected = false;
        this.scheduleReconnect();
      });
    } catch {
      this.isConnecting = false;
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  public updateSettings(patch: Partial<DiscordRpcSettings>): void {
    if (!patch || typeof patch !== "object") return;

    const validatedPatch: Partial<DiscordRpcSettings> = {};

    const booleanFields: (keyof DiscordRpcSettings)[] = [
      "enabled",
      "showArtwork",
      "showArtistSmallImage",
      "showTime",
      "showPaused",
      "showButton",
      "showDownloadButton",
    ];
    for (const key of booleanFields) {
      if (typeof patch[key] === "boolean") {
        (validatedPatch as any)[key] = patch[key];
      }
    }

    const validStatusTypes: DiscordStatusDisplayType[] = [
      "artist",
      "title",
      "artist_title",
      "title_artist",
      "app",
    ];
    if (patch.statusDisplayType && validStatusTypes.includes(patch.statusDisplayType)) {
      validatedPatch.statusDisplayType = patch.statusDisplayType;
    }

    const oldEnabled = this.settings.enabled;

    this.settings = { ...this.settings, ...validatedPatch };

    // If enabled state toggled
    if (this.settings.enabled !== oldEnabled) {
      if (this.settings.enabled) {
        this.connect();
      } else {
        this.clearReconnectTimer();
        this.clearSyncTimer();
        this.clearActivity();
        try {
          this.client?.destroy();
        } catch {}
        this.client = null;
        this.isConnected = false;
        this.isConnecting = false;
      }
      return;
    }

    // If flags like showTime, showArtwork changed, refresh current activity
    if (this.isConnected && this.latestPayload) {
      this.scheduleSync();
    }
  }

  public updateState(payload: DiscordRpcStatePayload): void {
    this.latestPayload = payload;
    this.latestPayloadReceivedAt = Date.now();

    if (!this.settings.enabled) {
      return;
    }

    if (!this.isConnected && !this.isConnecting) {
      this.connect();
      return;
    }

    if (this.isConnected) {
      this.scheduleSync();
    }
  }

  private async syncActivity(): Promise<void> {
    if (!this.isConnected || !this.client?.user || !this.settings.enabled) {
      return;
    }

    const payload = this.latestPayload;
    if (!payload || !payload.track || payload.status === "idle" || payload.status === "error") {
      this.clearActivity();
      return;
    }

    const isPlaying = payload.status === "playing";
    const isPaused = payload.status === "paused";

    if (isPaused && !this.settings.showPaused) {
      this.clearActivity();
      return;
    }

    try {
      const track = payload.track;
      const title = sanitizeText(track.title) || "Unknown Title";
      const artist = sanitizeText(track.artist) || "Unknown Artist";

      const dur = Math.max(0, payload.durationMs || track.durationMs || 0);

      let activityName = "Liner";
      let detailsText = title;
      let stateText = isPaused ? `${artist} (Paused)` : artist;
      let rpcStatusDisplayType = StatusDisplayType.STATE; // 1 -> "Listening to [Artist]"

      switch (this.settings.statusDisplayType) {
        case "title":
          activityName = title;
          rpcStatusDisplayType = StatusDisplayType.DETAILS; // 2 -> "Listening to [Title]"
          detailsText = isPaused ? `${title} (Paused)` : title;
          stateText = artist;
          break;
        case "app":
          activityName = "Liner";
          rpcStatusDisplayType = StatusDisplayType.NAME; // 0 -> "Listening to Liner"
          detailsText = title;
          stateText = isPaused ? `${artist} (Paused)` : artist;
          break;
        case "artist_title":
          activityName = `${artist} - ${title}`;
          rpcStatusDisplayType = StatusDisplayType.STATE; // 1 -> "Listening to [Artist - Title]"
          detailsText = title;
          stateText = isPaused ? `${artist} - ${title} (Paused)` : `${artist} - ${title}`;
          break;
        case "title_artist":
          activityName = `${title} - ${artist}`;
          rpcStatusDisplayType = StatusDisplayType.DETAILS; // 2 -> "Listening to [Title - Artist]"
          detailsText = isPaused ? `${title} - ${artist} (Paused)` : `${title} - ${artist}`;
          stateText = artist;
          break;
        case "artist":
        default:
          activityName = artist;
          rpcStatusDisplayType = StatusDisplayType.STATE; // 1 -> "Listening to [Artist]"
          detailsText = title;
          stateText = isPaused ? `${artist} (Paused)` : artist;
          break;
      }

      const activity: SetActivity & { status_display_type?: number } = {
        name: sanitizeText(activityName) || "Liner",
        type: 2, // 2 = ActivityType.Listening -> renders "Listening to" + live progress bar
        details: sanitizeText(detailsText),
        state: sanitizeText(stateText),
        statusDisplayType: rpcStatusDisplayType,
        status_display_type: rpcStatusDisplayType,
      };

      // Timestamps (media timeline / live progress bar like Spotify)
      if (isPlaying && this.settings.showTime && dur > 0) {
        const now = Date.now();
        const elapsedSincePayload = Math.max(0, now - (this.latestPayloadReceivedAt || now));
        const currentPos = Math.min(dur, Math.max(0, (payload.positionMs || 0) + elapsedSincePayload));
        activity.startTimestamp = new Date(now - currentPos);
        activity.endTimestamp = new Date(now - currentPos + dur);
      }

      // Large artwork (Album/Track cover)
      const coverImage = toDiscordImageUrl(track.coverUrl);
      if (this.settings.showArtwork && coverImage) {
        activity.largeImageKey = coverImage;
        activity.largeImageText = sanitizeText(track.album || track.title) || "Liner";
      }

      // Small artwork (Artist photo badge)
      const artistImage = toDiscordImageUrl(payload.artistImageUrl);
      if (this.settings.showArtistSmallImage && artistImage) {
        activity.smallImageKey = artistImage;
        activity.smallImageText = sanitizeText(track.artist) || "Artist";
      }

      // Action buttons linking to song or tryliner.fun (Discord allows up to 2 buttons)
      const buttons: Array<{ label: string; url: string }> = [];

      if (this.settings.showButton && track.id) {
        buttons.push({
          label: "Listen on Liner",
          url: `https://link.tryliner.fun/track?id=${encodeURIComponent(track.id)}`,
        });
      }

      if (this.settings.showDownloadButton) {
        buttons.push({
          label: "Download Liner",
          url: "https://tryliner.fun",
        });
      }

      if (buttons.length > 0) {
        activity.buttons = buttons;
      }

      await this.client.user.setActivity(activity);
    } catch {
      // Activity update dropped or rate-limited; gracefully ignored
    }
  }

  private clearActivity(): void {
    if (this.isConnected && this.client?.user) {
      try {
        void this.client.user.clearActivity();
      } catch {}
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.clearReconnectTimer();
    this.clearSyncTimer();
    this.clearActivity();
    try {
      this.client?.destroy();
    } catch {}
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
  }
}
