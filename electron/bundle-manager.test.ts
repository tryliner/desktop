import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ userData: "", appVersion: "0.1.35" }));

vi.mock("electron", () => ({
  app: { getPath: () => env.userData, getVersion: () => env.appVersion },
  BrowserWindow: class {},
}));

import { BundleManager, type BundleManifest } from "./bundle-manager";

const UPDATER = "https://updates.test";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const publicKeyHex = publicKey
  .export({ format: "der", type: "spki" })
  .toString("hex");

let root: string;
let builtInDist: string;

function makeBundle(
  version: string,
  signWith = privateKey,
): { manifest: BundleManifest; bytes: Buffer } {
  const work = fs.mkdtempSync(path.join(root, "src-"));
  fs.mkdirSync(path.join(work, "dist"));
  fs.writeFileSync(
    path.join(work, "dist", "index.html"),
    `<html>${version}</html>`,
  );
  const archive = path.join(work, "bundle.tar.gz");
  tar.create({ gzip: true, file: archive, cwd: work, sync: true }, ["dist"]);
  const bytes = fs.readFileSync(archive);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const signature = crypto
    .sign(null, Buffer.from(sha256, "utf8"), signWith)
    .toString("hex");
  return {
    bytes,
    manifest: {
      bundleVersion: version,
      minAppVersion: "0.1.35",
      channel: "stable",
      downloadUrl: `${UPDATER}/updates/bundles/bundle-${version}.tar.gz`,
      sha256,
      size: bytes.length,
      signature,
      releasedAt: new Date().toISOString(),
    },
  };
}

function serve(
  release: { manifest: BundleManifest; bytes: Buffer },
  bundleDelayMs = 0,
) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith(`${UPDATER}/updates/manifest.json`))
        return new Response(JSON.stringify(release.manifest));
      if (url === release.manifest.downloadUrl) {
        if (bundleDelayMs) {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, bundleDelayMs);
            init?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(init.signal?.reason ?? new Error("aborted"));
            });
          });
        }
        return new Response(new Uint8Array(release.bytes));
      }
      return new Response("not found", { status: 404 });
    });
}

function manager() {
  return new BundleManager({
    defaultRendererDist: builtInDist,
    updaterUrl: UPDATER,
    publicKeyHex,
  });
}

function runningHtml(bundles: BundleManager): string {
  return fs.readFileSync(bundles.getEffectiveIndexPath(), "utf8");
}

beforeEach(() => {
  env.appVersion = "0.1.35";
  root = fs.mkdtempSync(path.join(os.tmpdir(), "liner-bundles-"));
  env.userData = path.join(root, "userData");
  builtInDist = path.join(root, "built-in");
  fs.mkdirSync(builtInDist, { recursive: true });
  fs.writeFileSync(
    path.join(builtInDist, "index.html"),
    "<html>built-in</html>",
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("BundleManager", () => {
  it("starts on a freshly published bundle at the very first launch", async () => {
    serve(makeBundle("0.1.40"));
    const bundles = manager();
    await bundles.updateBeforeLaunch();
    expect(runningHtml(bundles)).toBe("<html>0.1.40</html>");
    expect(bundles.getActiveState()?.bundleVersion).toBe("0.1.40");
  });

  it("does not download again when the published bundle is already installed", async () => {
    const release = makeBundle("0.1.40");
    serve(release);
    await manager().updateBeforeLaunch();
    vi.restoreAllMocks();

    const fetchSpy = serve(release);
    const next = manager();
    await next.updateBeforeLaunch();
    expect(
      fetchSpy.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes("/bundles/")),
    ).toEqual([]);
    expect(runningHtml(next)).toBe("<html>0.1.40</html>");
  });

  it("keeps running the loaded bundle after a background download and applies it on the next launch", async () => {
    const bundles = manager();
    const release = makeBundle("0.1.41");
    const fetchSpy = serve(release);

    await bundles.checkForUpdates();
    await vi.waitFor(() =>
      expect(fs.existsSync(path.join(env.userData, "active_bundle.json"))).toBe(
        true,
      ),
    );
    expect(runningHtml(bundles)).toBe("<html>built-in</html>");
    expect(bundles.getActiveState()).toBeNull();

    const again = await bundles.checkForUpdates();
    expect(again.reason).toBe("Installed, applies on next launch");
    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).includes("/bundles/")),
    ).toHaveLength(1);

    expect(runningHtml(manager())).toBe("<html>0.1.41</html>");
  });

  it(
    "loads the current bundle when the download is slower than the startup budget and finishes it in the background",
    { timeout: 10_000 },
    async () => {
      serve(makeBundle("0.1.42"), 1_500);
      const bundles = manager();
      await bundles.updateBeforeLaunch(1_100);
      expect(runningHtml(bundles)).toBe("<html>built-in</html>");
      await vi.waitFor(
        () => expect(runningHtml(manager())).toBe("<html>0.1.42</html>"),
        { timeout: 4_000 },
      );
    },
  );

  it("runs the built-in dist when the installed bundle is older than the app", async () => {
    serve(makeBundle("0.1.41"));
    await manager().updateBeforeLaunch();
    vi.restoreAllMocks();

    env.appVersion = "0.2.10";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const next = manager();
    await next.updateBeforeLaunch();
    expect(runningHtml(next)).toBe("<html>built-in</html>");
    expect(next.getActiveState()).toBeNull();
  });

  it("refuses a bundle signed with a different key", async () => {
    serve(
      makeBundle("0.1.43", crypto.generateKeyPairSync("ed25519").privateKey),
    );
    const bundles = manager();
    await bundles.updateBeforeLaunch();
    expect(runningHtml(bundles)).toBe("<html>built-in</html>");
    expect(fs.existsSync(path.join(env.userData, "active_bundle.json"))).toBe(
      false,
    );
  });

  it("removes old bundles and leftover temp folders but keeps the active one", async () => {
    serve(makeBundle("0.1.40"));
    await manager().updateBeforeLaunch();
    const bundlesDir = path.join(env.userData, "bundles");
    fs.mkdirSync(path.join(bundlesDir, "bundle-0.1.30-deadbeef"));
    fs.mkdirSync(path.join(bundlesDir, "temp-0.1.39-123"));

    const next = manager();
    await next.updateBeforeLaunch();
    const left = fs.readdirSync(bundlesDir);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatch(/^bundle-0\.1\.40-/);
    expect(runningHtml(next)).toBe("<html>0.1.40</html>");
  });

  it("never replaces a newer built-in bundle with an older published one", async () => {
    env.appVersion = "0.1.40";
    const fetchSpy = serve(makeBundle("0.1.38"));
    const bundles = manager();
    await bundles.updateBeforeLaunch();
    await bundles.checkForUpdates();
    expect(runningHtml(bundles)).toBe("<html>built-in</html>");
    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).includes("/bundles/")),
    ).toHaveLength(0);
    expect(await bundles.peekUpdate()).toEqual({ kind: "latest" });
  });

  it("takes a hotfix published under the same version as the installed bundle", async () => {
    serve(makeBundle("0.1.40"));
    await manager().updateBeforeLaunch();
    vi.restoreAllMocks();
    serve(makeBundle("0.1.40"));
    const next = manager();
    await next.updateBeforeLaunch();
    expect(runningHtml(next)).toBe("<html>0.1.40</html>");
    expect(
      fs.readdirSync(path.join(env.userData, "bundles")).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
