import path from "node:path";
import type { App } from "electron";

declare const __LINER_CHANNEL__: string;

export const IS_STAGING = __LINER_CHANNEL__ === "staging";

export function useChannelData(app: App): void {
  if (IS_STAGING) {
    app.setPath("userData", path.join(app.getPath("appData"), "Liner Staging"));
  }
}
