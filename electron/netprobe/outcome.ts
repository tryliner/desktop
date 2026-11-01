import type { YoutubeFailure } from "./types";

export type ProbeOutcome =
  { status: number; body: string } | { error: "timeout" | "failed" };

export function youtubeFailureOf(outcome: ProbeOutcome): YoutubeFailure | null {
  if ("error" in outcome)
    return outcome.error === "timeout" ? "timeout" : "blocked";
  return outcome.status === 204 ? null : "blocked";
}
