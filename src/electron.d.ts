import type { LinerElectronApi } from "../electron/preload";

declare global {
  interface Window {
    linerElectron?: LinerElectronApi;
  }
}

export {};
