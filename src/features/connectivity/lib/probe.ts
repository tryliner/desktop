import { DIAG_ENDPOINTS } from "./diagnostics";
import type { ConnectionProbe } from "./classify";

const API_PROBE_TIMEOUT_MS = 6000;

async function probeApi(): Promise<ConnectionProbe["api"]> {
  try {
    const res = await fetch(`${DIAG_ENDPOINTS.api}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(API_PROBE_TIMEOUT_MS),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

export async function probeConnection(): Promise<ConnectionProbe> {
  const deviceOnline =
    typeof navigator === "undefined" ? true : navigator.onLine;
  const bridge =
    typeof window !== "undefined" ? window.linerElectron?.probeNetwork : null;
  const [api, net] = await Promise.all([
    probeApi(),
    bridge ? bridge().catch(() => null) : Promise.resolve(null),
  ]);
  return {
    deviceOnline,
    api,
    internet: net ? net.internet : null,
    youtube: net ? net.youtube : null,
    youtubeFailure: net?.youtubeFailure ?? null,
    country: net?.country ?? null,
  };
}
