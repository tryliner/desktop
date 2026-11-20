import type { Track } from "@/shared/types";
import { log } from "@/shared/utils/logger";
import type { PlayerState } from "../../store/playerStore";
import {
  normalizeGain,
  planTransition,
  type TransitionPlan,
  type TransitionSettings,
} from "./planTransition";
import { ensureAnalysis, knownAnalysis } from "./analysisCache";

const REANALYSE_AFTER_MS = 30_000;
const ANALYSE_NEXT_AFTER_MS = 8_000;

interface DirectorDeps {
  getState: () => PlayerState;
  nextIndex: () => number | null;
  setTrackGain: (gain: number) => void;
  isTransitioning: () => boolean;
}

export function transitionSettings(state: PlayerState): TransitionSettings {
  return {
    crossfadeMs: (state.crossfadeSeconds ?? 0) * 1000,
    gapless: Boolean(state.gapless),
    automix: Boolean(state.automix),
    normalize: Boolean(state.normalizeVolume),
  };
}

export class TransitionDirector {
  private transitionedFrom: string | null = null;
  private planned: { key: string; plan: TransitionPlan | null } | null = null;

  constructor(private readonly deps: DirectorDeps) {}

  forgetPlan(): void {
    this.planned = null;
  }

  trackChanged(state: PlayerState): void {
    this.transitionedFrom = null;
    this.planned = null;
    this.prepareFor(state);
  }

  prepareFor(state: PlayerState): void {
    const current = state.currentTrack;
    if (!current) return;
    this.deps.setTrackGain(
      state.normalizeVolume ? normalizeGain(knownAnalysis(current.id)) : 1,
    );
    if (!state.automix && !state.normalizeVolume) return;
    const stillOn = () => this.deps.getState().currentTrack?.id === current.id;
    const analyse = (track: Track) =>
      ensureAnalysis(track).then((analysis) => {
        this.planned = null;
        if (stillOn() && this.deps.getState().normalizeVolume) {
          this.deps.setTrackGain(normalizeGain(analysis));
        }
      });
    void analyse(current);
    setTimeout(() => {
      if (stillOn()) void analyse(current);
    }, REANALYSE_AFTER_MS);
    const index = this.deps.nextIndex();
    const next = index !== null ? state.queue[index] : null;
    if (next && next.id !== current.id) {
      setTimeout(() => {
        if (stillOn()) void analyse(next);
      }, ANALYSE_NEXT_AFTER_MS);
    }
  }

  due(positionMs: number): TransitionPlan | null {
    const state = this.deps.getState();
    const current = state.currentTrack;
    if (!current || state.status !== "playing") return null;
    if (this.deps.isTransitioning() || this.transitionedFrom === current.id) {
      return null;
    }
    const settings = transitionSettings(state);
    if (settings.crossfadeMs <= 0 && !settings.gapless) return null;
    if (state.repeat === "one") return null;
    const index = this.deps.nextIndex();
    const next = index !== null ? state.queue[index] : null;
    if (!next || next.id === current.id) return null;

    const durationMs = state.durationMs || current.durationMs;
    const key = [
      current.id,
      next.id,
      durationMs,
      settings.crossfadeMs,
      settings.gapless,
      settings.automix,
    ].join("|");
    if (this.planned?.key !== key) {
      this.planned = {
        key,
        plan: planTransition(
          settings,
          {
            durationMs,
            analysis: knownAnalysis(current.id),
            albumId: current.album?.id,
          },
          {
            durationMs: next.durationMs,
            analysis: knownAnalysis(next.id),
            albumId: next.album?.id,
          },
        ),
      };
    }
    const plan = this.planned.plan;
    if (!plan || positionMs < plan.startAtMs) return null;
    this.transitionedFrom = current.id;
    log(
      "cyan",
      "transition",
      `${plan.kind} into "${next.title}" (out ${plan.fadeOutMs} ms, in ${plan.fadeInMs} ms, skip ${plan.incomingOffsetMs} ms)`,
    );
    return plan;
  }
}
