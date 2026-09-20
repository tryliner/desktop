import { useEffect } from "react";
import { presenceClient } from "./presenceClient";

// React hook to keep desktop presence active across app lifecycle
export function usePresenceSync(): void {
  useEffect(() => {
    presenceClient.start();
    return () => {
      presenceClient.stop();
    };
  }, []);
}
