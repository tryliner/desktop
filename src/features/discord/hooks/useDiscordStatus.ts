import { useEffect, useState } from "react";
import type { DiscordConnectionStatus } from "../contracts";

const POLL_INTERVAL_MS = 4000;

export function useDiscordStatus() {
  const [status, setStatus] = useState<DiscordConnectionStatus>({
    connected: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkStatus = () => {
      const getStatus = window.linerElectron?.getDiscordStatus;
      if (!getStatus) {
        setLoading(false);
        return;
      }
      void getStatus()
        .then((next) => {
          if (!cancelled && next) setStatus(next);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    checkStatus();
    const interval = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { status, loading };
}
