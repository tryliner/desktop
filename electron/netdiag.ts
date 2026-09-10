// shared types for main-process network diagnostics (no electron imports,
// so both main.ts and the renderer can use it).
export const MAIN_NET_HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
export const MAIN_NET_MAX_HOSTS = 5;
export const MAIN_NET_TRACE_MAX_HOPS = 12;

export interface MainDnsCheck {
  host: string;
  ok: boolean;
  addresses?: string[];
  resolvers?: string[];
  ms: number;
  error?: string;
}

export interface MainTcpCheck {
  host: string;
  port: number;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface MainTlsCheck {
  host: string;
  ok: boolean;
  protocol?: string;
  authorized?: boolean;
  subject?: string;
  issuer?: string;
  ms: number;
  error?: string;
}

export interface MainControlCheck {
  name: string;
  ok: boolean;
  status?: number;
  detail?: string;
  ms: number;
  error?: string;
}

export interface MainTraceResult {
  host: string;
  ok: boolean;
  hops: string[];
  ms: number;
  error?: string;
}

export interface MainNetResult {
  dns: MainDnsCheck[];
  tcp: MainTcpCheck[];
  tls: MainTlsCheck[];
  controls: MainControlCheck[];
  trace: MainTraceResult | null;
  platform: string;
}

// first line is a header ("traceroute to …", "Tracing route …"), rest are hops.
// keeps raw hop lines (capped) since hop formats differ per os and tool.
export function parseTraceOutput(stdout: string, maxHops = MAIN_NET_TRACE_MAX_HOPS): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim().slice(0, 160))
    .filter(Boolean)
    .filter((line) => !/^(traceroute to|tracepath|tracing route|over a maximum)/i.test(line))
    .slice(0, maxHops + 2);
}
