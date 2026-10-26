import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshTvTokens } from "./tvTokens";

const client = { clientId: "id", clientSecret: "secret" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tv token refresh", () => {
  it("keeps the old refresh token when google does not rotate it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ access_token: "next", expires_in: 3600 }),
      ),
    );
    await expect(refreshTvTokens(client, "rt")).resolves.toMatchObject({
      accessToken: "next",
      refreshToken: "rt",
    });
  });

  it("surfaces revoked refresh tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "invalid_grant" }, 400)),
    );
    await expect(refreshTvTokens(client, "rt")).rejects.toMatchObject({
      code: "invalid_grant",
    });
  });
});
