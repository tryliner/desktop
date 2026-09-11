import {
  usePlayerStore,
  type PlayerCommand,
  type PlayerStatus,
  type RepeatMode,
  type PlayerState,
} from "../store/playerStore";
import { playerRuntime } from "./playerRuntime";
import {
  api,
  type ApiRadioTrack,
  type LyricsCandidate,
  type LyricsSyncLevel,
  type PlaybackContext,
  type RecordPlaybackEventRequest,
} from "@/shared/api";
import { toClientTrack } from "@/shared/api/track";
import { log } from "@/shared/utils/logger";
import { parseRawLyrics, useLyricsStore } from "@/features/lyrics";
import type { Track } from "@/shared/types";

export { usePlayerStore, type PlayerStatus, type RepeatMode, type PlayerState };

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function restoreOriginalRelativeOrder<T>(currentUpcoming: T[], originalUpcoming: T[]): T[] {
  if (originalUpcoming.length === 0) return currentUpcoming;
  const originalPosMap = new Map<T, number>();
  originalUpcoming.forEach((item, idx) => {
    if (!originalPosMap.has(item)) {
      originalPosMap.set(item, idx);
    }
  });

  return [...currentUpcoming].sort((a, b) => {
    const posA = originalPosMap.has(a) ? originalPosMap.get(a)! : Number.MAX_SAFE_INTEGER;
    const posB = originalPosMap.has(b) ? originalPosMap.get(b)! : Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });
}

const SYNC_RANK: Record<LyricsSyncLevel, number> = {
  plain: 0,
  line_level: 1,
  syllable_level: 2,
  word_level: 3,
};

function compareLyricsCandidates(a: LyricsCandidate, b: LyricsCandidate): number {
  if (a.topPriority !== b.topPriority) return a.topPriority ? -1 : 1;
  const rankA = SYNC_RANK[a.syncLevel] ?? 0;
  const rankB = SYNC_RANK[b.syncLevel] ?? 0;
  if (rankA !== rankB) return rankB - rankA;
  if (b.quality.total !== a.quality.total) return b.quality.total - a.quality.total;

  const isWordA = a.syncLevel === "word_level" || a.syncLevel === "syllable_level";
  const isWordB = b.syncLevel === "word_level" || b.syncLevel === "syllable_level";
  if (isWordA && isWordB) {
    if (a.provider === "Polaris Mono" || a.provider === "binimum") return -1;
    if (b.provider === "Polaris Mono" || b.provider === "binimum") return 1;
  }
  return 0;
}

function isBetterLyricsCandidate(next: LyricsCandidate, current: LyricsCandidate): boolean {
  return compareLyricsCandidates(next, current) < 0;
}

function parsePlaybackContext(context: string | null): PlaybackContext | undefined {
  if (!context) return undefined;
  if (context.includes(":")) {
    const [type, ...rest] = context.split(":");
    return { type, id: rest.join(":") };
  }
  return { type: context };
}

// fresh station instance id so the backend can tell paginated waves apart
// even when seed + history windows coincide
function newRadioWaveId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wave-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}

class PlaybackTelemetryTracker {
  private activeTrackId: string | null = null;
  private trackDurationMs = 0;
  private playedDurationMs = 0;
  private lastTickTime: number | null = null;
  private scrobbleReported = false;
  private completedReported = false;
  private context?: PlaybackContext;

  public startTrack(track: Track, contextStr: string | null) {
    this.flushCurrentTrack();

    this.activeTrackId = track.id;
    this.trackDurationMs = track.durationMs ?? 0;
    this.playedDurationMs = 0;
    this.lastTickTime = null;
    this.scrobbleReported = false;
    this.completedReported = false;
    this.context = parsePlaybackContext(contextStr);
  }

  public onPlaying() {
    this.lastTickTime = Date.now();
  }

  public onPausedOrStopped() {
    if (this.lastTickTime !== null) {
      const delta = Date.now() - this.lastTickTime;
      if (delta > 0 && delta < 10000) {
        this.playedDurationMs += delta;
      }
      this.lastTickTime = null;
    }
    this.checkScrobbleThreshold();
  }

  public onTick(isPlaying: boolean) {
    if (!this.activeTrackId) return;

    if (isPlaying) {
      const now = Date.now();
      if (this.lastTickTime !== null) {
        const delta = now - this.lastTickTime;
        if (delta > 0 && delta < 5000) {
          this.playedDurationMs += delta;
        }
      }
      this.lastTickTime = now;
      this.checkScrobbleThreshold();
    } else {
      this.lastTickTime = null;
    }
  }

  public onTrackCompleted() {
    if (!this.activeTrackId || this.completedReported) return;
    this.onPausedOrStopped();
    this.completedReported = true;
    this.sendEvent({
      trackId: this.activeTrackId,
      playedDurationMs: Math.round(this.playedDurationMs),
      trackDurationMs: this.trackDurationMs > 0 ? this.trackDurationMs : undefined,
      completed: true,
      skipped: false,
      context: this.context,
    });
  }

  public flushCurrentTrack() {
    if (!this.activeTrackId) return;
    this.onPausedOrStopped();

    const wasCompleted = this.completedReported;
    const isSkipped = !wasCompleted && this.playedDurationMs < 30000;

    if (!wasCompleted && this.playedDurationMs > 1000) {
      this.sendEvent({
        trackId: this.activeTrackId,
        playedDurationMs: Math.round(this.playedDurationMs),
        trackDurationMs: this.trackDurationMs > 0 ? this.trackDurationMs : undefined,
        completed: false,
        skipped: isSkipped,
        context: this.context,
      });
    }

    this.activeTrackId = null;
    this.lastTickTime = null;
    this.playedDurationMs = 0;
    this.scrobbleReported = false;
    this.completedReported = false;
  }

  private checkScrobbleThreshold() {
    if (!this.activeTrackId || this.scrobbleReported || this.completedReported) return;
    const thresholdMs =
      this.trackDurationMs > 0
        ? Math.min(30000, this.trackDurationMs * 0.5)
        : 30000;

    if (this.playedDurationMs >= thresholdMs) {
      this.scrobbleReported = true;
      this.sendEvent({
        trackId: this.activeTrackId,
        playedDurationMs: Math.round(this.playedDurationMs),
        trackDurationMs: this.trackDurationMs > 0 ? this.trackDurationMs : undefined,
        completed: false,
        skipped: false,
        context: this.context,
      });
    }
  }

  private sendEvent(payload: RecordPlaybackEventRequest) {
    void api.recordPlaybackEvent(payload).catch((err) => {
      log(
        "yellow",
        "telemetry",
        `playback event report failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
}

class PlayerEngine {
  private sessionId = 0;
  private lyricsLoadToken = 0;
  private lyricsAbort: AbortController | null = null;
  private currentLyricsTrackId: string | null = null;
  private originalUpcomingQueue: Track[] = [];
  private telemetry = new PlaybackTelemetryTracker();
  private radioAppendTimeout: ReturnType<typeof setTimeout> | null = null;
  private radioWaveId: string | null = null;

  constructor() {
    usePlayerStore.setState({
      dispatch: this.dispatch.bind(this),
    });

    if (playerRuntime) {
      playerRuntime.onEnded = () => {
        this.telemetry.onTrackCompleted();
      };
    }

    if (typeof window !== "undefined") {
      const g = window as any;
      if (g.__playerEngineUnsub) {
        g.__playerEngineUnsub();
      }

      window.addEventListener("beforeunload", () => {
        this.telemetry.flushCurrentTrack();
      });

      let prevTrackId: string | null =
        usePlayerStore.getState().currentTrack?.id || null;
      let prevStatus: string = "idle";
      let newTrack = false;
      const unsub = usePlayerStore.subscribe((state) => {
        const trackId = state.currentTrack?.id || null;
        if (trackId !== prevTrackId) {
          prevTrackId = trackId;
          newTrack = true;
          if (state.currentTrack) {
            this.telemetry.startTrack(state.currentTrack, state.playbackContext);
          } else {
            this.telemetry.flushCurrentTrack();
          }
          void this.fetchLyricsForTrack(state.currentTrack);
        }

        if (state.status === "playing") {
          this.telemetry.onTick(true);
        } else {
          this.telemetry.onTick(false);
        }

        if (state.status !== prevStatus || newTrack) {
          if (state.status === "playing") {
            this.telemetry.onPlaying();
          } else if (state.status === "paused" || state.status === "idle") {
            this.telemetry.onPausedOrStopped();
          }
          prevStatus = state.status;
          void this.syncDiscordPresence(state, newTrack);
          newTrack = false;
        }
      });

      g.__playerEngineUnsub = unsub;

      // Persist hydration restore
      const restoreLyricsForHydratedTrack = () => {
        const restoredTrack = usePlayerStore.getState().currentTrack;
        if (restoredTrack) {
          prevTrackId = restoredTrack.id;
          void this.fetchLyricsForTrack(restoredTrack);
        }
      };

      if (usePlayerStore.persist.hasHydrated()) {
        restoreLyricsForHydratedTrack();
      } else {
        usePlayerStore.persist.onFinishHydration(restoreLyricsForHydratedTrack);
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    return usePlayerStore.subscribe(listener);
  }

  public getSnapshot(): PlayerState {
    return usePlayerStore.getState();
  }

  public primeUserGesture(): void {
    // Intentionally a no-op placeholder for gesture priming
  }

  public dispatch(command: PlayerCommand): void {
    switch (command.type) {
      case "PLAY_REQUESTED":
        void this.playTrack(
          command.track,
          command.queue,
          command.context,
          command.contextCover,
        );
        break;
      case "PAUSE_REQUESTED":
        this.pause();
        break;
      case "RESUME_REQUESTED":
        this.resume();
        break;
      case "SEEK_COMMITTED":
        this.seek(command.positionMs);
        break;
      case "SKIP_NEXT":
        void this.skipNext();
        break;
      case "SKIP_PREVIOUS":
        void this.skipPrevious();
        break;
      case "SET_VOLUME":
        this.setVolume(command.volume);
        break;
      case "TOGGLE_PLAY_PAUSE":
        this.togglePlayPause();
        break;
    }
  }

  public async playTrack(
    track: Track,
    queue?: Track[],
    context?: string | null,
    contextCover?: string | null,
    queueIndex?: number,
  ): Promise<void> {
    const store = usePlayerStore.getState();
    const nextQueue = this.normalizeQueue(queue ?? [track], track);
    const nextIndex =
      queueIndex !== undefined
        ? queueIndex
        : Math.max(
            0,
            nextQueue.findIndex((item) => item.id === track.id),
          );

    this.sessionId += 1;
    const mySession = this.sessionId;
    // explicit play starts a fresh queue, so the wave instance resets too
    this.radioWaveId = newRadioWaveId();

    if (context !== undefined) {
      store.setPlaybackContext(context);
    }
    if (contextCover !== undefined) {
      store.setPlaybackContextCover(contextCover);
    }
    let finalQueue = nextQueue;
    let finalIndex = nextIndex;

    if (store.shuffle && nextQueue.length > 1) {
      const played = nextQueue.slice(0, nextIndex);
      const selectedTrackItem = nextQueue[nextIndex] ?? track;
      const upcoming = nextQueue.slice(nextIndex + 1);

      this.originalUpcomingQueue = [...upcoming];
      const shuffledUpcoming = shuffleArray(upcoming);

      finalQueue = [...played, selectedTrackItem, ...shuffledUpcoming];
      finalIndex = nextIndex;
    } else {
      this.originalUpcomingQueue = [];
    }

    store.setQueue(finalQueue);

    const selectedTrack = finalQueue[finalIndex] ?? track;
    store.setCurrentTrack(selectedTrack, finalIndex);
    store.setPosition(0);
    store.setDuration(selectedTrack.durationMs ?? 0);
    store.setStatus("loading", null);

    if (playerRuntime) {
      void playerRuntime.loadAndPlay(selectedTrack);
    }

    if (finalIndex === finalQueue.length - 1) {
      this.scheduleAppendSimilarTracks(mySession, selectedTrack.id);
    }
  }

  public async startRadioStation(track: Track): Promise<void> {
    const store = usePlayerStore.getState();
    this.sessionId += 1;
    const mySession = this.sessionId;
    // new station, new wave instance
    this.radioWaveId = newRadioWaveId();
    const waveId = this.radioWaveId;

    store.setPlaybackContext(`radio:${track.id}`);
    store.setPlaybackContextCover(track.coverUrl ?? null);
    store.setQueue([track]);
    this.originalUpcomingQueue = [];

    store.setCurrentTrack(track, 0);
    store.setPosition(0);
    store.setDuration(track.durationMs ?? 0);
    store.setStatus("loading", null);

    if (playerRuntime) {
      void playerRuntime.loadAndPlay(track);
    }

    try {
      const response = await api.getRadio(track.id, { k: 20, wave_id: waveId });
      if (mySession !== this.sessionId) return;
      const additions = response.items
        .map(toClientTrack)
        .filter((item) => item.id !== track.id);

      if (additions.length > 0) {
        const latestStore = usePlayerStore.getState();
        const updatedQueue = [track, ...additions];
        latestStore.setQueue(updatedQueue);
        if (latestStore.shuffle) {
          const upcoming = additions;
          this.originalUpcomingQueue = [...upcoming];
          const shuffledUpcoming = shuffleArray(upcoming);
          latestStore.setQueue([track, ...shuffledUpcoming]);
        }
        const sample = additions.slice(0, 3).map((t) => `"${t.title}" by ${t.artists || 'Unknown'}`).join(', ');
        log(
          "green",
          "radio",
          `started station for "${track.title}" with ${additions.length} tracks from Radio Wave engine: [${sample}]`,
        );
      }
    } catch (error) {
      log(
        "yellow",
        "radio",
        `radio fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public pause(): void {
    const store = usePlayerStore.getState();
    const wasLoading = store.status === "loading";
    if (wasLoading) {
      playerRuntime?.cancelPendingLoad();
    }
    store.setStatus("paused");
    if (playerRuntime && !wasLoading) {
      playerRuntime.pause();
    }
  }

  public resume(): void {
    const store = usePlayerStore.getState();
    if (playerRuntime) {
      if (
        store.currentTrack &&
        !playerRuntime.hasLoadedSourceFor(store.currentTrack.id)
      ) {
        void playerRuntime.loadAndPlay(store.currentTrack, store.positionMs);
      } else {
        store.setStatus("playing");
        playerRuntime.resume();
      }
    }
  }

  public togglePlayPause(): void {
    const store = usePlayerStore.getState();
    if (store.status === "playing" || store.status === "loading") {
      this.pause();
    } else {
      this.resume();
    }
  }

  public async skipNext(): Promise<void> {
    const store = usePlayerStore.getState();
    const nextIndex = this.computeNextIndex();

    if (nextIndex === null) {
      this.stopPlayback();
      store.setStatus("idle");
      store.setPosition(0);
      store.setDuration(0);
      store.setCurrentTrack(null, -1);
      return;
    }

    this.sessionId += 1;
    const mySession = this.sessionId;
    const nextTrack = store.queue[nextIndex];
    if (nextTrack) {
      // Optimistic synchronous UI update
      store.setCurrentTrack(nextTrack, nextIndex);
      store.setPosition(0);
      store.setDuration(nextTrack.durationMs ?? 0);
      store.setStatus("loading", null);

      if (playerRuntime) {
        void playerRuntime.loadAndPlay(nextTrack);
      }
      if (nextIndex === store.queue.length - 1) {
        this.scheduleAppendSimilarTracks(mySession, nextTrack.id);
      }
    }
  }

  public async skipPrevious(): Promise<void> {
    const store = usePlayerStore.getState();
    if (store.queue.length === 0) return;

    // If playback is > 3 seconds, standard player behavior restarts the track
    if (store.positionMs > 3000) {
      this.seek(0);
      return;
    }

    const prevIndex =
      store.currentIndex > 0
        ? store.currentIndex - 1
        : store.repeat === "all"
          ? store.queue.length - 1
          : 0;

    this.sessionId += 1;
    const mySession = this.sessionId;
    const prevTrack = store.queue[prevIndex];
    if (prevTrack) {
      // Optimistic synchronous UI update
      store.setCurrentTrack(prevTrack, prevIndex);
      store.setPosition(0);
      store.setDuration(prevTrack.durationMs ?? 0);
      store.setStatus("loading", null);

      if (playerRuntime) {
        void playerRuntime.loadAndPlay(prevTrack);
      }
      if (prevIndex === store.queue.length - 1) {
        this.scheduleAppendSimilarTracks(mySession, prevTrack.id);
      }
    }
  }

  public setVolume(volume: number): void {
    usePlayerStore.getState().setVolume(Math.min(1, Math.max(0, volume)));
  }

  public setVolumeSmooth(volume: number): void {
    this.setVolume(volume);
  }

  public setRepeat(mode: RepeatMode): void {
    usePlayerStore.getState().setRepeat(mode);
  }

  public setShuffle(enabled: boolean): void {
    const store = usePlayerStore.getState();
    if (store.shuffle === enabled) return;
    store.setShuffle(enabled);

    const { queue, currentIndex } = store;
    if (queue.length > 0 && currentIndex >= 0) {
      const played = queue.slice(0, currentIndex);
      const current = queue[currentIndex];
      const upcoming = queue.slice(currentIndex + 1);

      if (enabled) {
        this.originalUpcomingQueue = [...upcoming];
        const shuffledUpcoming = shuffleArray(upcoming);
        store.setQueue([...played, current, ...shuffledUpcoming]);
      } else {
        const unshuffledUpcoming = restoreOriginalRelativeOrder(
          upcoming,
          this.originalUpcomingQueue,
        );
        store.setQueue([...played, current, ...unshuffledUpcoming]);
        this.originalUpcomingQueue = [];
      }
    }
  }

  public seek(positionMs: number, autoPlay: boolean = false): void {
    const store = usePlayerStore.getState();
    const durationMs = store.durationMs || store.currentTrack?.durationMs || 0;
    const nextMs = Math.round(
      Math.max(0, Math.min(durationMs || positionMs, positionMs)),
    );

    store.setPosition(nextMs);
    if (playerRuntime) {
      if (
        store.currentTrack &&
        !playerRuntime.hasLoadedSourceFor(store.currentTrack.id)
      ) {
        if (autoPlay || store.status === "playing") {
          void playerRuntime.loadAndPlay(store.currentTrack, nextMs);
        }
        return;
      }
      playerRuntime.seek(nextMs);
      if (autoPlay && store.status !== "playing") {
        this.resume();
      }
    }
  }

  public seekAndPlay(positionMs: number): void {
    this.seek(positionMs, true);
  }

  public addToQueue(track: Track): void {
    const store = usePlayerStore.getState();
    const newQueue = [...store.queue, track];
    store.setQueue(newQueue);
    if (store.shuffle) {
      this.originalUpcomingQueue.push(track);
    }
  }

  public playNext(track: Track): void {
    const store = usePlayerStore.getState();
    const currentQueue = store.queue;
    const currentIndex = store.currentIndex;

    if (currentQueue.length === 0) {
      void this.playTrack(track, [track]);
      return;
    }

    const nextQueue = [
      ...currentQueue.slice(0, currentIndex + 1),
      track,
      ...currentQueue.slice(currentIndex + 1),
    ];
    store.setQueue(nextQueue);
    if (store.shuffle) {
      this.originalUpcomingQueue.unshift(track);
    }
  }

  public clearQueue(): void {
    usePlayerStore.getState().clearQueue();
    this.originalUpcomingQueue = [];
  }

  public snapshotQueue(): Track[] {
    return [...usePlayerStore.getState().queue];
  }

  private stopPlayback(): void {
    if (playerRuntime) {
      playerRuntime.pause();
    }
  }

  private normalizeQueue(queue: Track[], selected: Track): Track[] {
    if (queue.length === 0) return [selected];
    return queue.map((item) => ({
      ...item,
      coverUrl: item.coverUrl || selected.coverUrl,
      durationMs: item.durationMs ?? 0,
    }));
  }

  private computeNextIndex(): number | null {
    const store = usePlayerStore.getState();
    const queueSize = store.queue.length;
    if (queueSize === 0 || store.currentIndex < 0) return null;
    if (store.repeat === "one") return store.currentIndex;

    if (store.currentIndex + 1 < queueSize) return store.currentIndex + 1;
    if (store.repeat === "all") return 0;
    return null;
  }

  private scheduleAppendSimilarTracks(
    session: number,
    seedTrackId: string,
  ): void {
    if (this.radioAppendTimeout) {
      clearTimeout(this.radioAppendTimeout);
      this.radioAppendTimeout = null;
    }

    this.radioAppendTimeout = setTimeout(() => {
      void this.appendSimilarTracksForSeed(session, seedTrackId);
    }, 400);
  }

  private async appendSimilarTracksForSeed(
    session: number,
    seedTrackId: string,
  ): Promise<void> {
    const currentState = usePlayerStore.getState();
    if (!currentState.autoplaySimilar) return;

    const historyIds = currentState.queue.map((track) => track.id);
    // keep paginating the same wave instance across queue generations
    if (!this.radioWaveId) this.radioWaveId = newRadioWaveId();
    const waveId = this.radioWaveId;

    let items: ApiRadioTrack[];
    try {
      const response = await api.getRadio(seedTrackId, {
        history: historyIds.slice(-20),
        k: 20,
        wave_id: waveId,
      });
      items = response.items;
    } catch (error) {
      log(
        "yellow",
        "radio",
        `similar tracks fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    const state = usePlayerStore.getState();
    if (session !== this.sessionId) return;
    if (!state.autoplaySimilar) return;

    const queuedIds = new Set(state.queue.map((track) => track.id));
    const additions = items
      .map(toClientTrack)
      .filter((track) => !queuedIds.has(track.id));
    if (additions.length === 0) return;

    const sample = additions.slice(0, 3).map((t) => `"${t.title}" by ${t.artists || 'Unknown'}`).join(', ');
    log(
      "green",
      "radio",
      `appending ${additions.length} tracks from Radio Wave engine (wave=${waveId.slice(0, 8)} history=${historyIds.length}): [${sample}]`,
    );
    state.setQueue([...state.queue, ...additions]);
  }

  private async syncDiscordPresence(
    _state: PlayerState,
    _trackChanged: boolean = false,
  ): Promise<void> {
    // No presence backend — intentionally a no-op in the shell.
  }

  private async fetchLyricsForTrack(track: Track | null): Promise<void> {
    const lyricsStore = useLyricsStore.getState();

    if (!track) {
      this.currentLyricsTrackId = null;
      lyricsStore.reset();
      return;
    }

    const trackId = track.id;
    if (
      this.currentLyricsTrackId === trackId &&
      lyricsStore.currentLyricsTrackId === trackId
    ) {
      return;
    }

    this.currentLyricsTrackId = trackId;
    const token = ++this.lyricsLoadToken;
    this.lyricsAbort?.abort();
    const controller = new AbortController();
    this.lyricsAbort = controller;
    let bestCandidate: LyricsCandidate | null = null;

    lyricsStore.setLyricsState({
      lyricsLoading: true,
      lyricsError: null,
      rawLyrics: null,
      rawFormat: null,
      braccatoLyrics: [],
      syncedLines: [],
      plainLyrics: null,
      lyricsQuality: 0,
      currentLyricsTrackId: trackId,
      activeProvider: null,
      availableProviders: [],
    });

    log("cyan", "lyrics", `fetching for "${track.title}"`);

    try {
      for await (const event of api.streamLyrics(trackId, controller.signal)) {
        if (token !== this.lyricsLoadToken || controller.signal.aborted) break;

        if (event.type === "provider" && event.status === "found") {
          const candidate = event.candidate;
          const currentStore = useLyricsStore.getState();
          const option = {
            provider: candidate.provider,
            syncLevel: candidate.syncLevel,
            quality: candidate.quality.total,
            candidate,
          };
          const updatedProviders = [
            ...currentStore.availableProviders.filter(
              (p) => p.provider !== candidate.provider,
            ),
            option,
          ].sort((a, b) => compareLyricsCandidates(a.candidate, b.candidate));

          if (
            !bestCandidate ||
            isBetterLyricsCandidate(candidate, bestCandidate)
          ) {
            bestCandidate = candidate;

            const parsed = parseRawLyrics(
              candidate.lyrics.content,
              candidate.lyrics.format,
            );
            if (token !== this.lyricsLoadToken || controller.signal.aborted) break;

            useLyricsStore.getState().setLyricsState({
              activeProvider: candidate.provider,
              availableProviders: updatedProviders,
              rawLyrics: candidate.lyrics.content,
              rawFormat: candidate.lyrics.format,
              braccatoLyrics: parsed.braccatoLyrics,
              syncedLines: parsed.syncedLines,
              plainLyrics: parsed.plainLyrics,
              lyricsQuality: candidate.quality.total,
            });
            log(
              "green",
              "lyrics",
              `candidate ${candidate.provider} q=${candidate.quality.total} sync=${candidate.syncLevel}`,
            );
          } else {
            useLyricsStore.getState().setLyricsState({
              availableProviders: updatedProviders,
            });
            log(
              "yellow",
              "lyrics",
              `skip worse candidate ${candidate.provider} q=${candidate.quality.total}`,
            );
          }
        } else if (event.type === "provider" && event.status === "error") {
          log(
            "yellow",
            "lyrics",
            `provider ${event.provider} error: ${event.message}`,
          );
        } else if (event.type === "done") {
          log(
            "cyan",
            "lyrics",
            event.best
              ? `done, best=${event.best.provider} q=${event.best.quality}`
              : "done, no lyrics found",
          );
          break;
        }
      }
    } catch (error) {
      if (token !== this.lyricsLoadToken || controller.signal.aborted) return;
      log(
        "red",
        "lyrics",
        `stream failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      useLyricsStore.getState().setLyricsState({
        lyricsError: "Failed to load lyrics.",
      });
    } finally {
      if (token === this.lyricsLoadToken) {
        useLyricsStore.getState().setLyricsState({ lyricsLoading: false });
      }
    }
  }
}

export const playerEngine = new PlayerEngine();
