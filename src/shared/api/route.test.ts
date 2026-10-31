import { describe, expect, expectTypeOf, it } from "vitest";
import { buildRoute, type RouteAnswer } from "./route";
import type { AuthUser, LikedTracksPage } from "@/shared/contracts";

describe("buildRoute", () => {
  it("fills and encodes the params of the route key", () => {
    expect(
      buildRoute("DELETE /v1/playlists/:playlistId/items/:itemId", {
        params: { playlistId: "a/b", itemId: "sc:1 2" },
      }),
    ).toEqual({
      method: "DELETE",
      path: "/v1/playlists/a%2Fb/items/sc%3A1%202",
    });
  });

  it("appends the defined query values in order", () => {
    expect(
      buildRoute("GET /v1/me/likes", {
        query: { limit: 100, cursor: undefined },
      }).path,
    ).toBe("/v1/me/likes?limit=100");
    expect(
      buildRoute("GET /v1/catalog/search", { query: { q: "a b", type: "all" } })
        .path,
    ).toBe("/v1/catalog/search?q=a+b&type=all");
    expect(buildRoute("GET /v1/me").path).toBe("/v1/me");
  });

  it("serializes the body, leaves a null body out", () => {
    expect(
      buildRoute("POST /v1/auth/login", {
        body: { email: "a@b.c", password: "secret12" },
      }).body,
    ).toBe('{"email":"a@b.c","password":"secret12"}');
    expect(
      buildRoute("PUT /v1/me/likes/:trackId", {
        params: { trackId: "dQw4w9WgXcQ" },
        body: null,
      }),
    ).toEqual({ method: "PUT", path: "/v1/me/likes/dQw4w9WgXcQ" });
  });

  it("refuses a route key or input the contract does not have", () => {
    const wrong = (build: () => unknown) => expect(build).toThrow();
    // @ts-expect-error
    buildRoute("GET /v1/me/like");
    wrong(() =>
      // @ts-expect-error
      buildRoute("PUT /v1/me/likes/:trackId", { params: { id: "x" } }),
    );
    wrong(() =>
      // @ts-expect-error
      buildRoute("DELETE /v1/me/likes/:trackId"),
    );
    // @ts-expect-error
    buildRoute("POST /v1/auth/login", { body: { email: "a@b.c" } });
    // @ts-expect-error
    buildRoute("GET /v1/me", { body: { a: 1 } });
  });

  it("types the answer by the route's success status", () => {
    expectTypeOf<RouteAnswer<"GET /v1/me">>().toEqualTypeOf<AuthUser>();
    expectTypeOf<
      RouteAnswer<"GET /v1/me/likes">
    >().toEqualTypeOf<LikedTracksPage>();
    expectTypeOf<
      RouteAnswer<"DELETE /v1/me/likes/:trackId">
    >().toEqualTypeOf<undefined>();
    expectTypeOf<
      RouteAnswer<"GET /v1/me/lyrics/search">
    >().toEqualTypeOf<unknown>();
  });
});
