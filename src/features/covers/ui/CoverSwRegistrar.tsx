import { useEffect } from "react";

export function CoverSwRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isElectron =
      window.location.protocol === "file:" ||
      typeof (window as any).linerElectron !== "undefined";

    if (isElectron) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          void reg.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker
      .register("/cover-sw.js", { scope: "/" })
      .catch(() => {
        // SW registration failure is non-fatal — images still load, just uncached.
      });
  }, []);

  return null;
}
