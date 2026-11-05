import { describe, expect, it, vi } from "vitest";
import { PINNED_PASSWORD_STORE, pinnedPasswordStore } from "./password-store";

describe("pinnedPasswordStore", () => {
  it("pins libsecret on linux when libsecret and a secret service are there", () => {
    expect(
      pinnedPasswordStore(
        "linux",
        () => false,
        () => true,
      ),
    ).toBe(PINNED_PASSWORD_STORE);
    expect(PINNED_PASSWORD_STORE).toBe("gnome-libsecret");
  });

  it("keeps chromium's default when libsecret or a secret service is missing", () => {
    expect(
      pinnedPasswordStore(
        "linux",
        () => false,
        () => false,
      ),
    ).toBeNull();
  });

  it("keeps a --password-store the user passed without probing the bus", () => {
    const probe = vi.fn(() => true);
    expect(
      pinnedPasswordStore("linux", (name) => name === "password-store", probe),
    ).toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it("leaves other platforms alone without probing the bus", () => {
    const probe = vi.fn(() => true);
    expect(pinnedPasswordStore("win32", () => false, probe)).toBeNull();
    expect(pinnedPasswordStore("darwin", () => false, probe)).toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });
});
