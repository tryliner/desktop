import type { Lyric } from "@braccato/parsers";
import { drawScene } from "./drawScene";
import { EdgeFog } from "./edgeFog";
import { LineBitmaps } from "./lineBitmaps";
import { LiveLayer } from "./liveLayer";
import { FrameLoop, type FrameDemand } from "./frameLoop";
import { LyricsScene } from "./lyricsScene";
import { ScrollFollower } from "./scrollFollow";
import { ScrollMotion } from "./scrollMotion";

export interface LyricsClock {
  timeMs: () => number;
  playing: () => boolean;
}

export type EdgesListener = (atTop: boolean, atBottom: boolean) => void;

export class LyricsCanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scene: LyricsScene;
  private readonly motion = new ScrollMotion();
  private readonly follower = new ScrollFollower();
  private readonly fog = new EdgeFog();
  private readonly bitmaps = new LineBitmaps();
  private readonly loop: FrameLoop;
  private readonly live: LiveLayer;
  private dpr = 1;
  private following = true;
  private pinnedTop = false;
  private signature = "";

  constructor(
    private readonly canvas: HTMLCanvasElement,
    liveCanvas: HTMLCanvasElement,
    private readonly clock: LyricsClock,
    private readonly onEdges: EdgesListener,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas is not available");
    this.ctx = ctx;
    this.live = new LiveLayer(liveCanvas);
    this.loop = new FrameLoop(this.tick);
    this.scene = new LyricsScene(ctx, canvas, () => this.snap());
  }

  setLyrics(lyrics: Lyric[]) {
    this.scene.setLyrics(lyrics);
    this.snap();
  }

  resize(width: number, height: number, dpr: number) {
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.scene.setSize(width, height);
    this.snap();
  }

  setFogEnabled(enabled: boolean) {
    this.fog.enabled = enabled;
    this.signature = "";
    this.loop.poke();
  }

  setPinnedTop(pinned: boolean) {
    this.pinnedTop = pinned;
    this.follower.reset();
    this.loop.poke();
  }

  follow() {
    this.following = true;
    this.follower.reset();
    this.loop.poke();
  }

  wheel(deltaY: number) {
    this.following = false;
    this.motion.wheel(deltaY);
    this.loop.poke();
  }

  lineStartAt(y: number): number | null {
    const index = this.scene.lineAt(y, this.motion.position);
    return index === null ? null : this.scene.lines[index].startMs;
  }

  invalidate() {
    this.loop.poke();
  }

  dispose() {
    this.loop.dispose();
    this.scene.dispose();
    this.bitmaps.clear();
  }

  private lyricTimeMs(): number {
    return this.clock.timeMs() + this.scene.shiftMs;
  }

  private followScroll(now: number | null) {
    const { layouts, height } = this.scene;
    this.follower.apply(
      this.motion,
      layouts,
      this.lyricTimeMs(),
      height,
      this.pinnedTop,
      now,
    );
  }

  private snap() {
    this.signature = "";
    this.motion.setMax(this.scene.maxScroll());
    this.follower.reset();
    if (this.following) this.followScroll(null);
    this.loop.poke();
  }

  private readonly tick = (now: number, elapsedMs: number): FrameDemand => {
    if (this.following) this.followScroll(now);
    this.motion.step(now, elapsedMs);
    const atTop = this.motion.atTop();
    const atBottom = this.motion.atBottom();
    if (this.fog.track(atTop, atBottom, now)) this.onEdges(atTop, atBottom);
    const { animating, fading, signature } = drawScene(
      {
        ctx: this.ctx,
        scene: this.scene,
        motion: this.motion,
        fog: this.fog,
        bitmaps: this.bitmaps,
        dpr: this.dpr,
        now,
        timeMs: this.lyricTimeMs(),
      },
      this.signature,
      this.live,
    );
    this.signature = signature;
    if (this.motion.isMoving() || this.fog.isMoving(now) || fading)
      return "animate";
    if (!this.clock.playing()) return "idle";
    return animating ? "animate" : "poll";
  };
}
