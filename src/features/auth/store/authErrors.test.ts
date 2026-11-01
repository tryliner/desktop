import { describe, expect, it, vi } from "vitest";

// the player feature pulls lottie/canvas ui that jsdom cannot load; the error helpers never touch it
vi.mock("@/features/player", () => ({
  usePlayerStore: { getState: () => ({}) },
  playerRuntime: null,
}));

import { getAuthErrorCode } from "./authStore";
import { ApiError, HumanCheckCancelledError } from "@/shared/api";

describe("getAuthErrorCode", () => {
  it("tells a server outage apart from a wrong password", () => {
    expect(getAuthErrorCode(new ApiError(525, "error code: 525"))).toBe(
      "server_error",
    );
    expect(getAuthErrorCode(new ApiError(503, "Service Unavailable"))).toBe(
      "server_error",
    );
    expect(
      getAuthErrorCode(new ApiError(0, "Network error", "NETWORK_ERROR")),
    ).toBe("server_unavailable");
    expect(
      getAuthErrorCode(
        new ApiError(401, "Unauthorized", "INVALID_CREDENTIALS"),
      ),
    ).toBe("invalid_credentials");
    expect(getAuthErrorCode(new ApiError(401, ""))).toBe("unknown_error");
  });

  it("names a closed or rejected human check", () => {
    expect(getAuthErrorCode(new HumanCheckCancelledError())).toBe(
      "human_check_cancelled",
    );
    expect(
      getAuthErrorCode(new ApiError(403, "Forbidden", "TURNSTILE_INVALID")),
    ).toBe("human_check_failed");
  });
});
