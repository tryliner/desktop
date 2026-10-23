import type {
  LinerElectronApi,
  SmtcMediaAction,
  SmtcMediaUpdatePayload,
} from "../electron/preload";

declare global {
  interface Window {
    linerElectron?: LinerElectronApi;
  }
}

export type {
  LinerElectronApi,
  SmtcMediaAction,
  SmtcMediaUpdatePayload,
};

export {};
