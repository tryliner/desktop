import { describe, expect, it } from "vitest";
import { buildOfflineDump, dumpFilename } from "./dump";

describe("buildOfflineDump", () => {
  it("packs checks, failures and machine results without secrets", () => {
    const dump = buildOfflineDump({
      checks: [
        { id: "device", status: "ok", detail: "online" },
        { id: "dns", host: "api.tryliner.fun", status: "ok", detail: "1.2.3.4", latencyMs: 12 },
      ],
      failures: [{ at: 123, method: "GET", path: "/v1/me", status: 0, latencyMs: 5 }],
      main: {
        dns: [],
        tcp: [],
        tls: [],
        controls: [],
        trace: { host: "api.tryliner.fun", ok: true, hops: ["1  1.2.3.4  1ms"], ms: 900 },
        platform: "linux x64",
      },
      endpoints: { api: "https://api.tryliner.fun", covers: "https://covers.tryliner.fun", link: "https://link.tryliner.fun" },
    });
    expect(dump.summary).toEqual({ ok: 2, fail: 0, total: 2 });
    expect(dump.failures).toHaveLength(1);
    expect(dump.machine?.trace?.hops).toHaveLength(1);
    expect(JSON.stringify(dump)).not.toMatch(/bearer|token|authorization|proxy/i);
    expect(dumpFilename(dump)).toMatch(/^liner-offline-dump-.*\.json$/);
  });
});
