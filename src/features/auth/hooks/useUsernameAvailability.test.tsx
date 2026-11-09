import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  useUsernameAvailability,
  type UsernameStatus,
} from "./useUsernameAvailability";

const checkUsername = vi.fn();

vi.mock("@/shared/api", () => ({
  api: { checkUsername: (...args: unknown[]) => checkUsername(...args) },
}));

let container: HTMLDivElement;
let root: Root;
let seen: UsernameStatus = "idle";

function Probe({ username, enabled }: { username: string; enabled: boolean }) {
  seen = useUsernameAvailability(username, enabled);
  return null;
}

async function render(username: string, enabled = true) {
  await act(async () => {
    root.render(<Probe username={username} enabled={enabled} />);
  });
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  checkUsername.mockReset();
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});

describe("useUsernameAvailability", () => {
  it("stays idle for usernames the server would reject or when disabled", async () => {
    await render("ab");
    expect(seen).toBe("idle");
    await render("carol_sound", false);
    await settle();
    expect(seen).toBe("idle");
    expect(checkUsername).not.toHaveBeenCalled();
  });

  it("reports a taken username after the pause", async () => {
    checkUsername.mockResolvedValue({
      username: "carol",
      valid: true,
      available: false,
    });
    await render("carol");
    expect(seen).toBe("checking");
    await settle();
    expect(checkUsername).toHaveBeenCalledTimes(1);
    expect(seen).toBe("taken");
  });

  it("reports a free username", async () => {
    checkUsername.mockResolvedValue({
      username: "carol",
      valid: true,
      available: true,
    });
    await render("carol");
    await settle();
    expect(seen).toBe("available");
  });

  it("only checks the last value typed", async () => {
    checkUsername.mockResolvedValue({
      username: "carol_s",
      valid: true,
      available: true,
    });
    await render("car");
    await render("caro");
    await render("carol_s");
    await settle();
    expect(checkUsername).toHaveBeenCalledTimes(1);
    expect(checkUsername.mock.calls[0][0]).toBe("carol_s");
  });

  it("falls back to idle when the check fails so the server still decides", async () => {
    checkUsername.mockRejectedValue(new Error("404"));
    await render("carol");
    await settle();
    expect(seen).toBe("idle");
  });
});
