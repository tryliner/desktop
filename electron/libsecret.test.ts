import { describe, expect, it } from "vitest";
import { hasLibsecret, libsecretCandidates } from "./libsecret";

describe("libsecretCandidates", () => {
  it("checks LD_LIBRARY_PATH first, then multiarch and plain library dirs", () => {
    const candidates = libsecretCandidates("/opt/liner/lib::/extra", "x64");
    expect(candidates.slice(0, 4)).toEqual([
      "/opt/liner/lib/libsecret-1.so.0",
      "/extra/libsecret-1.so.0",
      "/usr/lib64/x86_64-linux-gnu/libsecret-1.so.0",
      "/usr/lib64/libsecret-1.so.0",
    ]);
    expect(candidates).toContain("/usr/lib/x86_64-linux-gnu/libsecret-1.so.0");
    expect(candidates).toContain("/usr/lib/libsecret-1.so.0");
  });

  it("uses the arm64 multiarch dir on arm64", () => {
    expect(libsecretCandidates(undefined, "arm64")).toContain(
      "/usr/lib/aarch64-linux-gnu/libsecret-1.so.0",
    );
  });

  it("falls back to plain dirs on an arch without a known triplet", () => {
    const candidates = libsecretCandidates(undefined, "riscv64");
    expect(candidates).toContain("/usr/lib/libsecret-1.so.0");
    expect(candidates.every((file) => !file.includes("linux-gnu"))).toBe(true);
  });
});

describe("hasLibsecret", () => {
  it("finds libsecret in a debian multiarch dir", () => {
    expect(
      hasLibsecret({
        exists: (file) => file === "/usr/lib/x86_64-linux-gnu/libsecret-1.so.0",
        arch: "x64",
      }),
    ).toBe(true);
  });

  it("finds libsecret in a fedora lib64 dir", () => {
    expect(
      hasLibsecret({
        exists: (file) => file === "/usr/lib64/libsecret-1.so.0",
        arch: "x64",
      }),
    ).toBe(true);
  });

  it("reports a system without libsecret", () => {
    expect(hasLibsecret({ exists: () => false, arch: "x64" })).toBe(false);
  });
});
