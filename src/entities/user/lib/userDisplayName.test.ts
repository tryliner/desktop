import { describe, expect, it } from "vitest";
import { userDisplayName } from "./userDisplayName";

describe("userDisplayName", () => {
  it("prefers the display name, then the username", () => {
    expect(userDisplayName({ displayName: "Vlad", username: "vlad" })).toBe(
      "Vlad",
    );
    expect(userDisplayName({ displayName: null, username: "vlad" })).toBe(
      "vlad",
    );
  });

  it("falls back to the email local part", () => {
    expect(userDisplayName({ email: "donezkzovsvo@gmail.com" })).toBe(
      "donezkzovsvo",
    );
  });

  it("returns nothing without a user", () => {
    expect(userDisplayName(null)).toBeUndefined();
  });
});
