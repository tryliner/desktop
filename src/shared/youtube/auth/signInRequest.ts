const SIGN_IN_REQUIRED_EVENT = "youtube-auth:required";
const AUTH_CHANGED_EVENT = "youtube-auth:changed";
const BOT_CHECK_PATTERN =
  /confirm you.re not a bot|LOGIN_REQUIRED|sign-in is required/i;

export function isBotCheckError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return BOT_CHECK_PATTERN.test(message);
}

let declinedThisSession = false;

export function declineYoutubeSignIn(): void {
  declinedThisSession = true;
}

export function isYoutubeSignInDeclined(): boolean {
  return declinedThisSession;
}

export function requestYoutubeSignIn(): void {
  globalThis.dispatchEvent?.(new Event(SIGN_IN_REQUIRED_EVENT));
}

function subscribe(event: string, listener: () => void): () => void {
  globalThis.addEventListener?.(event, listener);
  return () => globalThis.removeEventListener?.(event, listener);
}

export function onYoutubeSignInRequested(listener: () => void): () => void {
  return subscribe(SIGN_IN_REQUIRED_EVENT, listener);
}

export function onYoutubeAuthChanged(listener: () => void): () => void {
  return subscribe(AUTH_CHANGED_EVENT, listener);
}
