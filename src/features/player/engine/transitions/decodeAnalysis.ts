import {
  analyzeLevels,
  frameLevels,
  type TrackAnalysis,
} from "./trackAnalysis";

function offlineContextClass(): typeof OfflineAudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.OfflineAudioContext) return window.OfflineAudioContext;
  const legacy: unknown = Reflect.get(window, "webkitOfflineAudioContext");
  return typeof legacy === "function"
    ? (legacy as typeof OfflineAudioContext)
    : undefined;
}

export function mixDown(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i++) out[i] += channel[i] / channels.length;
  }
  return out;
}

const DECODE_RATE = 11_025;
const MAX_ANALYSE_MS = 15 * 60_000;

export async function analyzeAudioBlob(
  blob: Blob,
): Promise<TrackAnalysis | null> {
  const OfflineCtx = offlineContextClass();
  if (!OfflineCtx) return null;
  try {
    const ctx = new OfflineCtx(1, DECODE_RATE, DECODE_RATE);
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration * 1000 > MAX_ANALYSE_MS) return null;
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
      decoded.getChannelData(i),
    );
    return analyzeLevels(frameLevels(mixDown(channels), decoded.sampleRate));
  } catch {
    return null;
  }
}
