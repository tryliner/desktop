import { api, ApiError } from "@/shared/api";
import { getAuthErrorCode } from "../store/authStore";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How long a link stays open when the api does not say (AUTH_RESET_SELF_TTL_MINUTES). */
const DEFAULT_EXPIRES_IN_MINUTES = 30;

export type ResetRequestOutcome =
  | { kind: "sent"; expiresInMinutes: number }
  | { kind: "invalid_email" }
  | { kind: "error"; code: string; error: unknown };

/**
 * Asks for a reset link from the sign-in screen. "sent" says only that the api took the request:
 * it answers the same whether or not the email has an account.
 */
export async function requestResetLink(
  rawEmail: string,
  send: (email: string) => Promise<{ expiresInMinutes: number }> = (email) =>
    api.requestPasswordReset(email),
): Promise<ResetRequestOutcome> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { kind: "invalid_email" };
  try {
    const accepted = await send(email);
    return {
      kind: "sent",
      expiresInMinutes:
        accepted?.expiresInMinutes ?? DEFAULT_EXPIRES_IN_MINUTES,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 429)
      return { kind: "error", code: "rate_limited", error };
    return { kind: "error", code: getAuthErrorCode(error), error };
  }
}
