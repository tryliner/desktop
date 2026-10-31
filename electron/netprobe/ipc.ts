import { ipcMain, net } from "electron";
import type { NetProbeResult } from "./types";
import { youtubeFailureOf, type ProbeOutcome } from "./outcome.js";
import { activeNetSimulation } from "../netsim/install.js";

const PROBE_TIMEOUT_MS = 5000;
const COUNTRY_RE = /^loc=([A-Z]{2})$/m;

async function probe(url: string, readBody = false): Promise<ProbeOutcome> {
  try {
    const res = await net.fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: "manual",
      cache: "no-store",
    });
    const body = readBody ? (await res.text()).slice(0, 2048) : "";
    return { status: res.status, body };
  } catch (error) {
    return {
      error:
        (error as { name?: string } | null)?.name === "TimeoutError"
          ? "timeout"
          : "failed",
    };
  }
}

function okStatus(outcome: ProbeOutcome, status: number): boolean {
  return "status" in outcome && outcome.status === status;
}

export async function probeNetwork(): Promise<NetProbeResult> {
  const [google, cloudflare, youtube] = await Promise.all([
    probe("https://www.google.com/generate_204"),
    probe("https://cloudflare.com/cdn-cgi/trace", true),
    probe("https://www.youtube.com/generate_204"),
  ]);
  const cloudflareOk = okStatus(cloudflare, 200);
  const traceBody = "body" in cloudflare ? cloudflare.body : "";
  return {
    internet: okStatus(google, 204) || cloudflareOk,
    youtube: okStatus(youtube, 204),
    youtubeFailure: youtubeFailureOf(youtube),
    country:
      activeNetSimulation()?.country ??
      (cloudflareOk ? (COUNTRY_RE.exec(traceBody)?.[1] ?? null) : null),
  };
}

export function setupNetProbe(): void {
  ipcMain.handle("net:probe", () => probeNetwork());
}
