import { useEffect } from "react";

export function CoverSwRegistrar() {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      window.location.protocol === "file:"
    ) {
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
