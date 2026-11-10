export const ACTIVE_AUDIO_ID = "liner-audio";
export const STANDBY_AUDIO_ID = "liner-audio-standby";

type LinerWindow = Window & {
  __liner_audio?: HTMLAudioElement;
  __liner_audio_standby?: HTMLAudioElement;
};

const VOLUME_TICK_MS = 16;

function linerWindow(): LinerWindow | null {
  return typeof window !== "undefined" ? (window as LinerWindow) : null;
}

function findAudioElement(id: string): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(id) as HTMLAudioElement | null;
}

function createAudioElement(id: string): HTMLAudioElement {
  const audio = new Audio();
  audio.id = id;
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  if (typeof document !== "undefined") document.body.appendChild(audio);
  return audio;
}

export function markActiveAudio(
  active: HTMLAudioElement,
  standby: HTMLAudioElement,
): void {
  standby.id = STANDBY_AUDIO_ID;
  active.id = ACTIVE_AUDIO_ID;
  const win = linerWindow();
  if (!win) return;
  win.__liner_audio = active;
  win.__liner_audio_standby = standby;
}

export function findOrCreateAudioElements(): {
  active: HTMLAudioElement;
  standby: HTMLAudioElement;
} {
  const win = linerWindow();
  const active =
    win?.__liner_audio ??
    findAudioElement(ACTIVE_AUDIO_ID) ??
    createAudioElement(ACTIVE_AUDIO_ID);
  const standby =
    win?.__liner_audio_standby ??
    findAudioElement(STANDBY_AUDIO_ID) ??
    createAudioElement(STANDBY_AUDIO_ID);
  markActiveAudio(active, standby);
  return { active, standby };
}

export function rampVolume(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number,
  onComplete?: () => void,
): () => void {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const startVolume = audio.volume;
  const diff = targetVolume - startVolume;
  if (Math.abs(diff) < 0.001 || durationMs <= 0) {
    audio.volume = clamp(targetVolume);
    onComplete?.();
    return () => {};
  }
  const startTime = performance.now();
  const tick = () => {
    const progress = Math.min((performance.now() - startTime) / durationMs, 1);
    const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    audio.volume = clamp(startVolume + diff * eased);
    if (progress < 1) timer = setTimeout(tick, VOLUME_TICK_MS);
    else onComplete?.();
  };
  let timer = setTimeout(tick, VOLUME_TICK_MS);
  return () => clearTimeout(timer);
}
