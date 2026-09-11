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

export interface SaveDumpResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export async function downloadDump(dump: OfflineDump): Promise<SaveDumpResult> {
  const content = JSON.stringify(dump, null, 2);
  const filename = dumpFilename(dump);

  // use native save dialog in electron to track exact save destination
  if (typeof window !== "undefined" && window.linerElectron?.saveDump) {
    try {
      const res = await window.linerElectron.saveDump({ filename, content });
      return { success: res.success, filePath: res.filePath, canceled: res.canceled, error: res.error };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  // web fallback with synthetic anchor download
  try {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function copyDump(dump: OfflineDump): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
    return true;
  } catch {
    return false;
  }
}
