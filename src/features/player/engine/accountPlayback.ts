const BROKEN_SABR_CORS_APP_VERSIONS = new Set(["0.2.11"]);

let accountPlaybackWorks: Promise<boolean> | null = null;

export function appAllowsAccountPlayback(): Promise<boolean> {
  accountPlaybackWorks ??= (
    window.linerElectron?.getAppVersion() ?? Promise.resolve("")
  )
    .then((version) => !BROKEN_SABR_CORS_APP_VERSIONS.has(version))
    .catch(() => true);
  return accountPlaybackWorks;
}
