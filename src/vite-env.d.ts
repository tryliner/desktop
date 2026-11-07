/// <reference types="vite/client" />
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_COVERS_PROXY_URL?: string;
  /** Dev-only HMAC signing secret for browser-mode authentication (web mode without Electron) */
  readonly VITE_DEV_SIGNING_SECRET?: string;
  readonly VITE_CLIENT_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

