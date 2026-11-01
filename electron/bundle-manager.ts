import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import * as tar from "tar";
import type { BundleUpdateState } from "./bundle-stamp";

export interface BundleManifest {
  bundleVersion: string;
  minAppVersion: string;
  channel: string;
  downloadUrl: string;
  sha256: string;
  size: number;
  signature: string;
  releasedAt: string;
  releaseNotes?: string;
}

export interface ActiveBundleState {
  bundleVersion: string;
  bundleDir: string;
  installedAt: string;
  sha256: string;
  minAppVersion: string;
  isFallback?: boolean;
}

export interface BundleUpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

const STARTUP_UPDATE_BUDGET_MS = 8_000;
const STARTUP_MANIFEST_TIMEOUT_MS = 1_500;
const BACKGROUND_MANIFEST_TIMEOUT_MS = 15_000;

export class BundleManager {
  private defaultRendererDist: string;
  private bundlesRoot: string;
  private stateFilePath: string;
  private activeState: ActiveBundleState | null = null;
  private installedState: ActiveBundleState | null = null;
  private updaterUrl: string;
  private publicKeyHex: string;
  private mainWindow: BrowserWindow | null = null;
  private isChecking = false;
  private isDownloading = false;

  constructor(options: {
    defaultRendererDist: string;
    updaterUrl?: string;
    publicKeyHex?: string;
  }) {
    this.defaultRendererDist = options.defaultRendererDist;
    this.updaterUrl =
      options.updaterUrl ||
      process.env.LINER_UPDATER_URL ||
      "https://updates.tryliner.fun";

    this.publicKeyHex =
      options.publicKeyHex ||
      process.env.LINER_UPDATER_PUBLIC_KEY ||
      "302a300506032b6570032100508b7c5d10171f046c1bfd28e01d651b99c6b29cd78f8dcda00c47893c51b8de";

    // userData/bundles
    const userData = app.getPath("userData");
    this.bundlesRoot = path.join(userData, "bundles");
    this.stateFilePath = path.join(userData, "active_bundle.json");

    if (!fs.existsSync(this.bundlesRoot)) {
      fs.mkdirSync(this.bundlesRoot, { recursive: true });
    }

    this.loadActiveState();
  }

  public setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  /**
   * Reads active_bundle.json and validates files exist and are compatible
   */
  private loadActiveState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, "utf-8");
        const parsed = JSON.parse(raw) as ActiveBundleState;
        const indexHtml = path.join(parsed.bundleDir, "dist", "index.html");

        // Validate bundle exists on disk and is compatible with current appVersion
        // a bundle older than the app itself is stale: the built-in dist is newer
        if (
          fs.existsSync(indexHtml) &&
          this.isVersionCompatible(app.getVersion(), parsed.minAppVersion) &&
          this.compareVersions(parsed.bundleVersion, app.getVersion()) >= 0
        ) {
          this.activeState = parsed;
          this.installedState = parsed;
          return;
        } else {
          console.warn(
            `\x1b[33m[BundleManager]\x1b[0m Cached bundle ${parsed.bundleVersion} is invalid or incompatible, reverting to built-in dist.`,
          );
        }
      }
    } catch (err) {
      console.error(
        "\x1b[31m[BundleManager]\x1b[0m Failed to read active bundle state:",
        err,
      );
    }

    this.activeState = null;
    this.installedState = null;
  }

  /**
   * Returns path to current effective index.html (active OTA bundle OR built-in fallback)
   */
  public getEffectiveIndexPath(): string {
    if (this.activeState) {
      const activeHtml = path.join(
        this.activeState.bundleDir,
        "dist",
        "index.html",
      );
      if (fs.existsSync(activeHtml)) {
        return activeHtml;
      }
    }
    return path.join(this.defaultRendererDist, "index.html");
  }

  public getActiveVersion(): string {
    return this.activeState ? this.activeState.bundleVersion : app.getVersion();
  }

  public getActiveState(): ActiveBundleState | null {
    return this.activeState;
  }

  /**
   * Compares appVersion >= minAppVersion using semver comparison
   */
  public isVersionCompatible(
    appVersion: string,
    minAppVersion: string,
  ): boolean {
    if (!minAppVersion) return true;
    const cleanApp = appVersion.split("-")[0].split(".").map(Number);
    const cleanMin = minAppVersion.split("-")[0].split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      const a = cleanApp[i] || 0;
      const m = cleanMin[i] || 0;
      if (a > m) return true;
      if (a < m) return false;
    }
    return true;
  }

  private matches(
    state: ActiveBundleState | null,
    manifest: BundleManifest,
  ): boolean {
    return (
      state?.bundleVersion === manifest.bundleVersion &&
      state?.sha256?.toLowerCase() === manifest.sha256.toLowerCase()
    );
  }

  private compareVersions(left: string, right: string): number {
    const a = left.split("-")[0].split(".").map(Number);
    const b = right.split("-")[0].split(".").map(Number);
    for (let i = 0; i < 3; i += 1) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  private isUpgradeOver(
    state: ActiveBundleState | null,
    manifest: BundleManifest,
  ): boolean {
    const order = this.compareVersions(
      manifest.bundleVersion,
      state?.bundleVersion ?? app.getVersion(),
    );
    if (order !== 0) return order > 0;
    return !this.matches(state, manifest);
  }

  private async fetchManifest(timeoutMs: number): Promise<BundleManifest> {
    const res = await fetch(
      `${this.updaterUrl}/updates/manifest.json?t=${Date.now()}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return (await res.json()) as BundleManifest;
  }

  private pruneBundles(): void {
    const keep = new Set(
      [this.activeState?.bundleDir, this.installedState?.bundleDir]
        .filter((dir): dir is string => Boolean(dir))
        .map((dir) => path.resolve(dir)),
    );
    try {
      for (const entry of fs.readdirSync(this.bundlesRoot, {
        withFileTypes: true,
      })) {
        const full = path.resolve(this.bundlesRoot, entry.name);
        if (!entry.isDirectory() || keep.has(full)) continue;
        fs.rmSync(full, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(
        "\x1b[33m[BundleManager]\x1b[0m Failed to prune old bundles:",
        err,
      );
    }
  }

  public async updateBeforeLaunch(
    budgetMs = STARTUP_UPDATE_BUDGET_MS,
  ): Promise<void> {
    this.pruneBundles();
    const deadline = Date.now() + budgetMs;
    let manifest: BundleManifest;
    try {
      manifest = await this.fetchManifest(
        Math.min(STARTUP_MANIFEST_TIMEOUT_MS, budgetMs),
      );
    } catch {
      return;
    }
    if (!this.isVersionCompatible(app.getVersion(), manifest.minAppVersion))
      return;
    if (!this.isUpgradeOver(this.installedState, manifest)) return;

    const remaining = deadline - Date.now();
    if (remaining < 1_000) {
      void this.downloadAndInstall(manifest);
      return;
    }
    const result = await this.downloadAndInstall(
      manifest,
      AbortSignal.timeout(remaining),
    );
    if (result.success) {
      this.activeState = this.installedState;
      console.log(
        `\x1b[32m[BundleManager]\x1b[0m Starting on the freshly installed bundle ${manifest.bundleVersion}`,
      );
      return;
    }
    if (result.error && /abort|timeout/i.test(result.error))
      void this.downloadAndInstall(manifest);
  }

  public async peekUpdate(): Promise<BundleUpdateState> {
    try {
      const manifest = await this.fetchManifest(5_000);
      if (!this.isVersionCompatible(app.getVersion(), manifest.minAppVersion)) {
        return { kind: "needs-app-update" };
      }
      return this.isUpgradeOver(this.activeState, manifest)
        ? { kind: "available", version: manifest.bundleVersion }
        : { kind: "latest" };
    } catch {
      return { kind: "unknown" };
    }
  }

  public async checkForUpdates(): Promise<{
    available: boolean;
    manifest?: BundleManifest;
    reason?: string;
  }> {
    if (this.isChecking)
      return { available: false, reason: "Already checking" };
    this.isChecking = true;

    try {
      const manifest = await this.fetchManifest(BACKGROUND_MANIFEST_TIMEOUT_MS);

      if (!this.isVersionCompatible(app.getVersion(), manifest.minAppVersion)) {
        console.log(
          `\x1b[33m[BundleManager]\x1b[0m Bundle ${manifest.bundleVersion} requires app >= ${manifest.minAppVersion}, but running ${app.getVersion()}`,
        );
        return { available: false, reason: "App version too old for bundle" };
      }

      if (!this.isUpgradeOver(this.installedState, manifest)) {
        return {
          available: false,
          reason: this.isUpgradeOver(this.activeState, manifest)
            ? "Installed, applies on next launch"
            : "Already up to date",
        };
      }

      console.log(
        `\x1b[32m[BundleManager]\x1b[0m New OTA bundle found: ${manifest.bundleVersion} (sha: ${manifest.sha256.slice(0, 8)}). Downloading silently in background...`,
      );

      this.downloadAndInstall(manifest).then((res) => {
        if (res.success) {
          console.log(
            `\x1b[32m[BundleManager]\x1b[0m Bundle ${manifest.bundleVersion} installed silently. Will activate on next launch.`,
          );
        }
      });

      return { available: true, manifest };
    } catch (err: any) {
      console.warn(
        `\x1b[33m[BundleManager]\x1b[0m Check update failed: ${err.message}`,
      );
      return { available: false, reason: err.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Downloads, validates Ed25519 signature & sha256, and extracts bundle
   */
  public async downloadAndInstall(
    manifest: BundleManifest,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isDownloading)
      return { success: false, error: "Already downloading" };
    this.isDownloading = true;

    const bundleDir = path.join(
      this.bundlesRoot,
      `bundle-${manifest.bundleVersion}-${manifest.sha256.slice(0, 8)}`,
    );
    const tempDir = path.join(
      this.bundlesRoot,
      `temp-${manifest.bundleVersion}-${Date.now()}`,
    );

    try {
      console.log(
        `\x1b[36m[BundleManager]\x1b[0m Downloading ${manifest.downloadUrl}...`,
      );
      const res = await fetch(manifest.downloadUrl, { signal });
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`);

      const chunks: Buffer[] = [];
      let transferred = 0;

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Unable to read download response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkBuf = Buffer.from(value);
        chunks.push(chunkBuf);
        transferred += chunkBuf.length;
      }

      const archiveBuffer = Buffer.concat(chunks);

      // Verify SHA256
      const hash = crypto
        .createHash("sha256")
        .update(archiveBuffer)
        .digest("hex");
      if (hash.toLowerCase() !== manifest.sha256.toLowerCase()) {
        throw new Error(
          `SHA256 mismatch! Expected ${manifest.sha256}, got ${hash}`,
        );
      }

      // Verify Ed25519 signature
      const isValid = this.verifySignature(
        Buffer.from(hash, "utf-8"),
        manifest.signature,
      );
      if (!isValid) {
        throw new Error(
          "Ed25519 signature verification failed! Possible tampered bundle.",
        );
      }

      // Extract to tempDir first
      fs.mkdirSync(tempDir, { recursive: true });
      const tempArchive = path.join(tempDir, "archive.tar.gz");
      fs.writeFileSync(tempArchive, archiveBuffer);

      tar.extract({
        sync: true,
        file: tempArchive,
        cwd: tempDir,
      });

      // Verify that extracted files contain dist/index.html
      const extractedDist = path.join(tempDir, "dist");
      if (!fs.existsSync(path.join(extractedDist, "index.html"))) {
        throw new Error(
          "Corrupted archive: dist/index.html missing after extraction",
        );
      }

      // Atomic replace bundleDir
      if (fs.existsSync(bundleDir)) {
        fs.rmSync(bundleDir, { recursive: true, force: true });
      }
      fs.renameSync(tempDir, bundleDir);

      // Save state
      const newState: ActiveBundleState = {
        bundleVersion: manifest.bundleVersion,
        bundleDir,
        installedAt: new Date().toISOString(),
        sha256: hash,
        minAppVersion: manifest.minAppVersion,
      };

      fs.writeFileSync(
        this.stateFilePath,
        JSON.stringify(newState, null, 2),
        "utf-8",
      );
      this.installedState = newState;

      console.log(
        `\x1b[32m[BundleManager]\x1b[0m Successfully installed bundle ${manifest.bundleVersion}`,
      );
      this.mainWindow?.webContents.send("bundle:ready", newState);

      return { success: true };
    } catch (err: any) {
      console.error(
        "\x1b[31m[BundleManager]\x1b[0m Failed to install bundle:",
        err.message,
      );
      try {
        if (fs.existsSync(tempDir))
          fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      return { success: false, error: err.message };
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Applies the downloaded bundle immediately (Hot Swap)
   */
  public hotSwap(): boolean {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return false;
    if (this.installedState) this.activeState = this.installedState;
    const indexPath = this.getEffectiveIndexPath();
    console.log(
      `\x1b[35m[BundleManager]\x1b[0m Performing Hot Swap to: ${indexPath}`,
    );
    this.mainWindow.loadFile(indexPath);
    return true;
  }

  /**
   * Failsafe Rollback: Reverts to built-in dist and deletes broken bundle
   */
  public rollback(): boolean {
    console.warn(
      "\x1b[31m[BundleManager]\x1b[0m Triggering emergency rollback to built-in dist...",
    );
    try {
      if (this.activeState) {
        const brokenDir = this.activeState.bundleDir;
        if (fs.existsSync(brokenDir)) {
          fs.rmSync(brokenDir, { recursive: true, force: true });
        }
      }
      if (fs.existsSync(this.stateFilePath)) {
        fs.unlinkSync(this.stateFilePath);
      }
      this.activeState = null;
      this.installedState = null;

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const fallbackPath = path.join(this.defaultRendererDist, "index.html");
        this.mainWindow.loadFile(fallbackPath);
      }
      return true;
    } catch (err) {
      console.error("\x1b[31m[BundleManager]\x1b[0m Rollback error:", err);
      return false;
    }
  }

  private verifySignature(data: Buffer, signatureHex: string): boolean {
    try {
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(this.publicKeyHex, "hex"),
        format: "der",
        type: "spki",
      });
      return crypto.verify(
        null,
        data,
        publicKey,
        Buffer.from(signatureHex, "hex"),
      );
    } catch {
      return false;
    }
  }
}
