import { describe, expect, it, vi } from "vitest";
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

  it("calls electron saveDump when available", async () => {
    const dump = buildOfflineDump({
      checks: [],
      failures: [],
      main: null,
      endpoints: { api: "https://api.tryliner.fun", covers: "https://covers.tryliner.fun", link: "https://link.tryliner.fun" },
    });

    const mockSaveDump = vi.fn().mockResolvedValue({
      success: true,
      filePath: "/home/user/Desktop/test-dump.json",
    });

    (window as any).linerElectron = {
      saveDump: mockSaveDump,
    };

    const { downloadDump } = await import("./dump");
    const result = await downloadDump(dump);

    expect(mockSaveDump).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.filePath).toBe("/home/user/Desktop/test-dump.json");

    delete (window as any).linerElectron;
  });
});
