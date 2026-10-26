import type { RepeatMode } from "../store/playerStore";

// Radio ("Start radio" on a track) is an endless stream: the queue refills
// from the server before it runs out, so looping it back to the first track
// makes no sense. Repeat-one still works (stay on a track you like).

export const RADIO_CONTEXT_PREFIX = "radio:";

export function isRadioContext(context: string | null | undefined): boolean {
  return (
    typeof context === "string" && context.startsWith(RADIO_CONTEXT_PREFIX)
  );
}

/** what the repeat button switches to: off -> all -> one -> off, radio skips "all" */
export function nextRepeatMode(
  current: RepeatMode,
  radio: boolean,
): RepeatMode {
  if (radio) return current === "off" ? "one" : "off";
  if (current === "off") return "all";
  if (current === "all") return "one";
  return "off";
}

/** refill the radio queue once this few tracks (or fewer) are left after the current one */
export const RADIO_REFILL_THRESHOLD = 1;

export function shouldRefillRadio(
  queueLength: number,
  currentIndex: number,
): boolean {
  if (currentIndex < 0) return false;
  return queueLength - 1 - currentIndex <= RADIO_REFILL_THRESHOLD;
}
