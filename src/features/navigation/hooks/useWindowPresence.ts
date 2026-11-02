import { useEffect } from "react";

const PRESENCE_THROTTLE_MS = 2_000;

export function useWindowPresence(): void {
  useEffect(() => {
    const notePresence = window.linerElectron?.notePresence;
    if (!notePresence) return;
    let lastSentAt = 0;
    const onPointerMove = () => {
      const now = Date.now();
      if (now - lastSentAt < PRESENCE_THROTTLE_MS) return;
      lastSentAt = now;
      notePresence();
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, []);
}
