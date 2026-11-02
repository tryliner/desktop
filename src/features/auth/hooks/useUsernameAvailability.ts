import { useEffect, useState } from "react";
import { api } from "@/shared/api";

export type UsernameStatus = "idle" | "checking" | "available" | "taken";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const CHECK_DELAY_MS = 400;

export function useUsernameAvailability(
  username: string,
  enabled: boolean,
): UsernameStatus {
  const [result, setResult] = useState<{
    username: string;
    status: UsernameStatus;
  } | null>(null);
  const candidate = username.trim().toLowerCase();
  const active = enabled && USERNAME_RE.test(candidate);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResult({ username: candidate, status: "checking" });
      api
        .checkUsername(candidate, controller.signal)
        .then((answer) => {
          if (controller.signal.aborted) return;
          setResult({
            username: candidate,
            status: answer.valid && !answer.available ? "taken" : "available",
          });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setResult({ username: candidate, status: "idle" });
        });
    }, CHECK_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, candidate]);

  if (!active) return "idle";
  if (!result || result.username !== candidate) return "checking";
  return result.status;
}
