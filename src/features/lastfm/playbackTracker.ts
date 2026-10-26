import type { Track } from "@/shared/types";
import type { LastfmBridge, LastfmListen, LastfmStatus } from "./contracts";

export function lastfmMetadata(
  track: Track,
  durationMs: number,
  context: string | null,
): Omit<LastfmListen, "id" | "timestamp"> | null {
  const artist =
    track.artistList?.find((item) => item.name.trim())?.name.trim() ||
    track.artists.trim();
  const title = track.title.trim();
  if (
    !artist ||
    !title ||
    /^(unknown artist|unknown track)$/i.test(artist) ||
    /^(unknown track|unknown title)$/i.test(title)
  )
    return null;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  return {
    artist,
    track: title,
    album: track.album?.title.trim() || undefined,
    duration: durationMs / 1000,
    ...(context?.startsWith("radio:") ? { chosenByUser: 0 as const } : {}),
  };
}

export class LastfmPlaybackTracker {
  private bridge?: LastfmBridge;
  private status?: LastfmStatus;
  private unsubscribe?: () => void;
  private track: Track | null = null;
  private context: string | null = null;
  private id = "";
  private timestamp?: number;
  private durationMs = 0;
  private listenedMs = 0;
  private sample?: { positionMs: number; now: number; rate: number };
  private submitted = false;
  private submitting = false;
  private nowPlayingSent = false;
  private lastAttempt = -Infinity;

  constructor(
    private readonly clock = () => performance.now(),
    private readonly wallClock = () => Date.now(),
  ) {}

  bind(bridge: LastfmBridge) {
    this.unsubscribe?.();
    this.bridge = bridge;
    let revision = 0;
    this.unsubscribe = bridge.onChange((status) => {
      revision++;
      this.updateStatus(status);
    });
    void bridge
      .status()
      .then((status) => {
        if (revision === 0) this.updateStatus(status);
      })
      .catch(() => {});
  }

  updateStatus(status: LastfmStatus) {
    const previous = this.status;
    if (
      previous &&
      (previous.ownerId !== status.ownerId ||
        previous.username !== status.username) &&
      this.track
    ) {
      this.begin(this.track, this.context);
    }
    const enabled = status.connected && status.enabled && !status.authorizing;
    const wasEnabled =
      previous?.connected && previous.enabled && !previous.authorizing;
    if (
      enabled !== Boolean(wasEnabled) ||
      previous?.username !== status.username
    ) {
      this.sample = undefined;
      this.listenedMs = 0;
      this.timestamp = undefined;
      this.nowPlayingSent = false;
    }
    if (status.nowPlaying && !previous?.nowPlaying) this.nowPlayingSent = false;
    this.status = status;
  }

  begin(track: Track, context: string | null) {
    this.track = track;
    this.context = context;
    this.id = crypto.randomUUID();
    this.durationMs = track.durationMs;
    this.timestamp = undefined;
    this.listenedMs = 0;
    this.sample = undefined;
    this.submitted = false;
    this.submitting = false;
    this.nowPlayingSent = false;
    this.lastAttempt = -Infinity;
  }

  ensure(track: Track, context: string | null) {
    if (this.track?.id !== track.id) this.begin(track, context);
  }

  duration(durationMs: number) {
    if (this.durationMs <= 0 && Number.isFinite(durationMs) && durationMs > 0)
      this.durationMs = durationMs;
  }

  discontinuity() {
    this.sample = undefined;
  }

  stop() {
    this.track = null;
    this.sample = undefined;
  }

  progress(positionMs: number, playing: boolean, rate: number) {
    if (
      !this.track ||
      !this.bridge ||
      !this.status?.connected ||
      !this.status.enabled ||
      this.status.authorizing ||
      !Number.isFinite(positionMs) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      this.sample = undefined;
      return;
    }
    const now = this.clock();
    const previous = this.sample;
    this.sample = playing ? { positionMs, now, rate } : undefined;
    if (!playing) return;
    this.timestamp ??= Math.floor(this.wallClock() / 1000);
    const metadata = lastfmMetadata(this.track, this.durationMs, this.context);
    if (!metadata) return;
    const listen: LastfmListen = {
      ...metadata,
      id: this.id,
      timestamp: this.timestamp,
    };
    if (this.status.nowPlaying && !this.nowPlayingSent) {
      this.nowPlayingSent = true;
      this.bridge.updateNowPlaying(listen);
    }
    if (previous) {
      const elapsed = now - previous.now;
      const advanced = (positionMs - previous.positionMs) / previous.rate;
      // shortcut: gaps over five seconds are uncounted; use an audio clock if long renderer stalls become common.
      if (elapsed > 0 && elapsed <= 5000 && advanced > 0)
        this.listenedMs += Math.min(elapsed, advanced);
    }
    const threshold = Math.min(this.durationMs / 2, 240000);
    if (
      this.durationMs <= 30000 ||
      this.listenedMs < threshold ||
      this.submitted ||
      this.submitting ||
      now - this.lastAttempt < 5000
    )
      return;
    this.submitting = true;
    this.lastAttempt = now;
    const id = this.id;
    void this.bridge
      .scrobble(listen)
      .then((accepted) => {
        if (this.id === id) this.submitted = accepted;
      })
      .catch(() => {})
      .finally(() => {
        if (this.id === id) this.submitting = false;
      });
  }
}

export const lastfmTracker = new LastfmPlaybackTracker();
