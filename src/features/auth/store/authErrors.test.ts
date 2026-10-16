import { describe, expect, it, vi } from "vitest";

// the player feature pulls lottie/canvas ui that jsdom cannot load; the error helpers never touch it
vi.mock("@/features/player", () => ({ usePlayerStore: { getState: () => ({}) }, playerRuntime: null }));

import { getAuthErrorCode } from "./authStore";
import { ApiError } from "@/shared/api";

describe("getAuthErrorCode", () => {
  it("tells a server outage apart from a wrong password", () => {
    expect(getAuthErrorCode(new ApiError(525, "error code: 525"))).toBe("server_error");
    expect(getAuthErrorCode(new ApiError(503, "Service Unavailable"))).toBe("server_error");
    expect(getAuthErrorCode(new ApiError(0, "Network error", "NETWORK_ERROR"))).toBe("server_unavailable");
    expect(getAuthErrorCode(new ApiError(401, "Unauthorized", "INVALID_CREDENTIALS"))).toBe("invalid_credentials");
    expect(getAuthErrorCode(new ApiError(401, ""))).toBe("unknown_error");
  });

  it("maps password reset failures", () => {
    expect(getAuthErrorCode(new ApiError(429, "Too Many Requests"))).toBe("rate_limited");
    expect(getAuthErrorCode(new ApiError(400, "Bad code", "INVALID_RESET_CODE"))).toBe("invalid_reset_code");
    expect(getAuthErrorCode(new ApiError(400, "Expired", "RESET_CODE_EXPIRED"))).toBe("invalid_reset_code");
  });
});
