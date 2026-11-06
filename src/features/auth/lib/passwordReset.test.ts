import { describe, expect, it, vi } from "vitest";
import { ApiError, HumanCheckCancelledError } from "@/shared/api";
import { requestResetLink } from "./passwordReset";

vi.mock("@/features/player", () => ({
  playerEngine: { stopAndClear: async () => undefined },
}));

function apiError(status: number, code?: string): ApiError {
  return new ApiError(status, "x", code);
}

describe("requestResetLink", () => {
  it("sends the trimmed, lowercased email and reports the link's lifetime", async () => {
    const send = vi.fn().mockResolvedValue({ expiresInMinutes: 30 });
    await expect(
      requestResetLink("  Alice@Example.COM ", send),
    ).resolves.toEqual({ kind: "sent", expiresInMinutes: 30 });
    expect(send).toHaveBeenCalledWith("alice@example.com");
  });

  it("does not call the api for an invalid email", async () => {
    const send = vi.fn();
    await expect(requestResetLink("nope", send)).resolves.toEqual({
      kind: "invalid_email",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("turns a 429 into the rate limit message", async () => {
    const send = vi.fn().mockRejectedValue(apiError(429, "RATE_LIMITED"));
    await expect(requestResetLink("a@b.co", send)).resolves.toMatchObject({
      kind: "error",
      code: "rate_limited",
    });
  });

  it("maps the human check and server failures like sign-in", async () => {
    const cases: [unknown, string][] = [
      [new HumanCheckCancelledError(), "human_check_cancelled"],
      [apiError(403, "TURNSTILE_INVALID"), "human_check_failed"],
      [apiError(503, "MAIL_UNAVAILABLE"), "server_error"],
      [apiError(0), "server_unavailable"],
    ];
    for (const [error, code] of cases) {
      const send = vi.fn().mockRejectedValue(error);
      await expect(requestResetLink("a@b.co", send)).resolves.toMatchObject({
        kind: "error",
        code,
      });
    }
  });
});
