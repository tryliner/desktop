import { describe, expect, it } from "vitest";
import { createTranslatorSync } from "@/languages";
import {
  ApiError,
  planLimitMessage,
  planLimitOf,
  resolveApiErrorMessage,
} from "./apiError";

const t = createTranslatorSync("en");

const limitError = (details: unknown) =>
  new ApiError(403, "Limit reached.", "PLAN_LIMIT_REACHED", "r1", details);

describe("plan limits", () => {
  it("reads the limit, the count and the plus value of a 403", () => {
    const err = limitError({
      resource: "playlists",
      limit: 50,
      count: 50,
      plusLimit: 100,
    });
    expect(planLimitOf(err)).toEqual({
      resource: "playlists",
      limit: 50,
      count: 50,
      plusLimit: 100,
    });
  });

  it("shows them in one message", () => {
    const err = limitError({
      resource: "likedTracks",
      limit: 1000,
      count: 1200,
      plusLimit: 5000,
    });
    expect(planLimitMessage(err, t)).toBe(
      "Limit reached: 1200 of 1000. Liner Plus allows 5000.",
    );
    expect(resolveApiErrorMessage(err, t, "common.failed_add_playlist")).toBe(
      "Limit reached: 1200 of 1000. Liner Plus allows 5000.",
    );
  });

  it("ignores other errors and malformed details", () => {
    expect(planLimitOf(limitError(undefined))).toBeNull();
    expect(
      planLimitOf(
        limitError({ resource: "x", limit: 1, count: 1, plusLimit: 2 }),
      ),
    ).toBeNull();
    expect(
      planLimitOf(limitError({ resource: "playlists", limit: "50" })),
    ).toBeNull();
    expect(planLimitOf(new Error("PLAN_LIMIT_REACHED"))).toBeNull();
    const forbidden = new ApiError(403, "Forbidden", "FORBIDDEN");
    expect(planLimitMessage(forbidden, t)).toBeNull();
    expect(resolveApiErrorMessage(forbidden, t, "common.failed")).toBe(
      t("common.error_session_expired"),
    );
  });
});
