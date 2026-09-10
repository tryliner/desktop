import type { MainNetResult } from "../../../../electron/netdiag";
import { SHARE_BASE_URL } from "@/shared/utils/share";

// endpoint bases duplicated here on purpose: importing @/shared/api would
// close an import cycle (api hooks record failures into this feature).
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://api.tryliner.fun";
const COVERS_BASE =
  (import.meta.env.VITE_COVERS_PROXY_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://covers.tryliner.fun";

const CHECK_TIMEOUT_MS = 8000;

// real origins probed, reused for the dump file metadata
export const DIAG_ENDPOINTS = {
  api: API_BASE,
  covers: COVERS_BASE,
  link: SHARE_BASE_URL,
};

export type CheckStatus = "ok" | "fail" | "skip";

export interface DiagCheck {
  id: "device" | "api" | "covers" | "link" | "dns" | "tcp" | "tls" | "control" | "trace" | "platform" | "main";
  host?: string;
  status: CheckStatus;
  detail?: string;
  latencyMs?: number;
}

export interface DiagnosticsResult {
  checks: DiagCheck[];
  main: MainNetResult | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^TypeError:\s*/i, "").slice(0, 120) || "failed";
}

async function timedFetch(url: string, init?: RequestInit): Promise<DiagCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const ms = Math.round(performance.now() - start);
    if (!res.ok) return { id: "api", status: "fail", detail: `HTTP ${res.status}`, latencyMs: ms };
    return { id: "api", status: "ok", detail: `HTTP ${res.status}`, latencyMs: ms };
  } catch (err) {
    return { id: "api", status: "fail", detail: shortError(err) };
  } finally {
    clearTimeout(timer);
  }
}

// runs every connectivity probe: browser state, http reachability per backend,
// then real dns + tcp from the user machine via the electron bridge.
// never throws, every probe degrades to fail/skip with a reason.
export async function runAllChecks(): Promise<DiagnosticsResult> {
  const checks: DiagCheck[] = [];

  checks.push(
    typeof navigator !== "undefined" && navigator.onLine
      ? { id: "device", status: "ok", detail: "online" }
      : { id: "device", status: "fail", detail: "os reports offline" },
  );

  checks.push(await timedFetch(`${API_BASE}/health`));

  const ping = async (id: DiagCheck["id"], url: string): Promise<DiagCheck> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const start = performance.now();
    try {
      // opaque ping, no cors needed, resolving at all means reachable
      await fetch(url, { mode: "no-cors", signal: controller.signal });
      return { id, status: "ok", latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return { id, status: "fail", detail: shortError(err) };
    } finally {
      clearTimeout(timer);
    }
  };
  checks.push(await ping("covers", COVERS_BASE));
  checks.push(await ping("link", `${SHARE_BASE_URL}/health`));

  const hosts = [API_BASE, COVERS_BASE, SHARE_BASE_URL].map(hostOf);
  let main: MainNetResult | null = null;
  try {
    const bridge = typeof window !== "undefined" ? window.linerElectron?.diagnoseNetwork : undefined;
    if (bridge) {
      main = await bridge(hosts);
      for (const d of main.dns) {
        checks.push({
          id: "dns",
          host: d.host,
          status: d.ok ? "ok" : "fail",
          detail:
            d.addresses?.[0] ??
            (!d.ok && d.error ? d.error : undefined) ??
            (d.resolvers?.[0] ? `via ${d.resolvers[0]}` : undefined),
          latencyMs: d.ms,
        });
      }
      for (const t of main.tcp) {
        checks.push({
          id: "tcp",
          host: t.host,
          status: t.ok ? "ok" : "fail",
          ...(!t.ok && t.error ? { detail: t.error } : {}),
          latencyMs: t.ms,
        });
      }
      for (const h of main.tls) {
        const certBits = [h.subject, h.authorized === false ? "untrusted" : null].filter(Boolean);
        checks.push({
          id: "tls",
          host: h.host,
          status: h.ok ? "ok" : "fail",
          detail:
            (h.protocol ? `${h.protocol}${certBits.length > 0 ? ` · ${certBits.join(" · ")}` : ""}` : undefined) ??
            (!h.ok && h.error ? h.error : undefined),
          latencyMs: h.ms,
        });
      }
      for (const c of main.controls) {
        checks.push({
          id: "control",
          host: c.name,
          status: c.ok ? "ok" : "fail",
          detail: c.detail ?? (c.status ? `HTTP ${c.status}` : undefined) ?? c.error,
          latencyMs: c.ms,
        });
      }
      if (main.trace) {
        checks.push({
          id: "trace",
          host: main.trace.host,
          status: main.trace.ok ? "ok" : main.trace.error === "traceroute not installed" ? "skip" : "fail",
          detail: main.trace.hops.length > 0
            ? `${main.trace.hops.length} hops`
            : (main.trace.error ?? "no hops"),
          latencyMs: main.trace.ms,
        });
      }
      checks.push({ id: "platform", status: "skip", detail: main.platform });
    } else {
      checks.push({ id: "main", status: "skip", detail: "desktop bridge unavailable" });
    }
  } catch (err) {
    checks.push({ id: "main", status: "fail", detail: shortError(err) });
  }

  return { checks, main };
}
