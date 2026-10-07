import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import * as tar from "tar";

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

export class BundleManager {
  private defaultRendererDist: string;
  private bundlesRoot: string;
  private stateFilePath: string;
  private activeState: ActiveBundleState | null = null;
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
        if (
          fs.existsSync(indexHtml) &&
          this.isVersionCompatible(app.getVersion(), parsed.minAppVersion)
        ) {
          this.activeState = parsed;
          return;
        } else {
          console.warn(
            `\x1b[33m[BundleManager]\x1b[0m Cached bundle ${parsed.bundleVersion} is invalid or incompatible, reverting to built-in dist.`
          );
        }
      }
    } catch (err) {
      console.error("\x1b[31m[BundleManager]\x1b[0m Failed to read active bundle state:", err);
    }

    this.activeState = null;
  }

  /**
   * Returns path to current effective index.html (active OTA bundle OR built-in fallback)
   */
  public getEffectiveIndexPath(): string {
    if (this.activeState) {
      const activeHtml = path.join(this.activeState.bundleDir, "dist", "index.html");
      if (fs.existsSync(activeHtml)) {
        return activeHtml;
      }
    }
    return path.join(this.defaultRendererDist, "index.html");
  }

  public getActiveVersion(): string {
    return this.activeState ? this.activeState.bundleVersion : app.getVersion();
  }

  /**
   * Compares appVersion >= minAppVersion using semver comparison
   */
  public isVersionCompatible(appVersion: string, minAppVersion: string): boolean {
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

  /**
   * Queries /updates/manifest.json for a new bundle
   */
  public async checkForUpdates(): Promise<{
    available: boolean;
    manifest?: BundleManifest;
    reason?: string;
  }> {
    if (this.isChecking) return { available: false, reason: "Already checking" };
    this.isChecking = true;

    try {
      const manifestUrl = `${this.updaterUrl}/updates/manifest.json?t=${Date.now()}`;
      const res = await fetch(manifestUrl, { cache: "no-store" });
      if (!res.ok) {
        return { available: false, reason: `Server returned ${res.status}` };
      }

      const manifest = (await res.json()) as BundleManifest;

      // 1. Check compatibility
      if (!this.isVersionCompatible(app.getVersion(), manifest.minAppVersion)) {
        console.log(
          `\x1b[33m[BundleManager]\x1b[0m Bundle ${manifest.bundleVersion} requires app >= ${manifest.minAppVersion}, but running ${app.getVersion()}`
        );
        return { available: false, reason: "App version too old for bundle" };
      }

      // 2. Check if newer or different hash
      const isSameVersion = this.activeState?.bundleVersion === manifest.bundleVersion;
      const isSameHash = this.activeState?.sha256?.toLowerCase() === manifest.sha256.toLowerCase();

      if (isSameVersion && isSameHash) {
        return { available: false, reason: "Already up to date" };
      }

      console.log(`\x1b[32m[BundleManager]\x1b[0m New OTA bundle available: ${manifest.bundleVersion} (sha: ${manifest.sha256.slice(0, 8)})`);
      this.mainWindow?.webContents.send("bundle:available", manifest);

      // Auto download & install in background seamlessly
      this.downloadAndInstall(manifest).then((res) => {
        if (res.success) {
          console.log(`\x1b[32m[BundleManager]\x1b[0m Bundle ${manifest.bundleVersion} (${manifest.sha256.slice(0, 8)}) installed ready for next launch or hot reload.`);
        }
      });

      return { available: true, manifest };
    } catch (err: any) {
      console.warn(`\x1b[33m[BundleManager]\x1b[0m Check update failed: ${err.message}`);
      return { available: false, reason: err.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Downloads, validates Ed25519 signature & sha256, and extracts bundle
   */
  public async downloadAndInstall(manifest: BundleManifest): Promise<{ success: boolean; error?: string }> {
    if (this.isDownloading) return { success: false, error: "Already downloading" };
    this.isDownloading = true;

    const bundleDir = path.join(
      this.bundlesRoot,
      `bundle-${manifest.bundleVersion}-${manifest.sha256.slice(0, 8)}`
    );
    const tempDir = path.join(this.bundlesRoot, `temp-${manifest.bundleVersion}-${Date.now()}`);

    try {
      console.log(`\x1b[36m[BundleManager]\x1b[0m Downloading ${manifest.downloadUrl}...`);
      const res = await fetch(manifest.downloadUrl);
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`);

      const total = Number(res.headers.get("content-length")) || manifest.size || 0;
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

        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
        this.mainWindow?.webContents.send("bundle:download-progress", {
          percent,
          transferred,
          total,
        });
      }

      const archiveBuffer = Buffer.concat(chunks);

      // Verify SHA256
      const hash = crypto.createHash("sha256").update(archiveBuffer).digest("hex");
      if (hash.toLowerCase() !== manifest.sha256.toLowerCase()) {
        throw new Error(`SHA256 mismatch! Expected ${manifest.sha256}, got ${hash}`);
      }

      // Verify Ed25519 signature
      const isValid = this.verifySignature(Buffer.from(hash, "utf-8"), manifest.signature);
      if (!isValid) {
        throw new Error("Ed25519 signature verification failed! Possible tampered bundle.");
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
        throw new Error("Corrupted archive: dist/index.html missing after extraction");
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

      fs.writeFileSync(this.stateFilePath, JSON.stringify(newState, null, 2), "utf-8");
      this.activeState = newState;

      console.log(`\x1b[32m[BundleManager]\x1b[0m Successfully installed bundle ${manifest.bundleVersion}`);
      this.mainWindow?.webContents.send("bundle:ready", newState);

      return { success: true };
    } catch (err: any) {
      console.error("\x1b[31m[BundleManager]\x1b[0m Failed to install bundle:", err.message);
      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
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
    const indexPath = this.getEffectiveIndexPath();
    console.log(`\x1b[35m[BundleManager]\x1b[0m Performing Hot Swap to: ${indexPath}`);
    this.mainWindow.loadFile(indexPath);
    return true;
  }

  /**
   * Failsafe Rollback: Reverts to built-in dist and deletes broken bundle
   */
  public rollback(): boolean {
    console.warn("\x1b[31m[BundleManager]\x1b[0m Triggering emergency rollback to built-in dist...");
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
      return crypto.verify(null, data, publicKey, Buffer.from(signatureHex, "hex"));
    } catch {
      return false;
    }
  }
}
