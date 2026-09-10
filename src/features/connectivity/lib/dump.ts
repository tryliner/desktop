import type { MainNetResult } from "../../../../electron/netdiag";
import type { DiagCheck } from "./diagnostics";
import type { FailureEntry } from "../store/connectivityStore";

export interface OfflineDump {
  generatedAt: string;
  app: {
    version: string;
    platform: string;
    userAgent: string;
    language: string;
    onLine: boolean;
  };
  endpoints: { api: string; covers: string; link: string };
  summary: { ok: number; fail: number; total: number };
  checks: DiagCheck[];
  failures: FailureEntry[];
  machine: MainNetResult | null;
}

// everything support needs and nothing they don't: routes and timings,
// never tokens, headers, bodies or proxy credentials.
export function buildOfflineDump(input: {
  checks: DiagCheck[];
  failures: FailureEntry[];
  main: MainNetResult | null;
  endpoints: { api: string; covers: string; link: string };
}): OfflineDump {
  const ok = input.checks.filter((c) => c.status === "ok").length;
  const fail = input.checks.filter((c) => c.status === "fail").length;
  return {
    generatedAt: new Date().toISOString(),
    app: {
      version:
        (import.meta.env.VITE_CLIENT_VERSION as string | undefined) || "dev",
      platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      language: typeof navigator !== "undefined" ? navigator.language : "unknown",
      onLine: typeof navigator !== "undefined" ? navigator.onLine : true,
    },
    endpoints: input.endpoints,
    summary: { ok, fail, total: input.checks.length },
    checks: input.checks,
    failures: input.failures,
    machine: input.main,
  };
}

export function dumpFilename(dump: OfflineDump): string {
  return `liner-offline-dump-${dump.generatedAt.replace(/[:.]/g, "-")}.json`;
}

export function downloadDump(dump: OfflineDump): void {
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = dumpFilename(dump);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyDump(dump: OfflineDump): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
    return true;
  } catch {
    return false;
  }
}
