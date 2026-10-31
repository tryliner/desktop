import { describe, expect, it } from "vitest";
import { isUserPlaylistId } from "./playlists";

describe("isUserPlaylistId", () => {
  it("accepts user playlist uuids", () => {
    expect(isUserPlaylistId("3f2b8c1e-9a4d-4e6b-8c2a-1d5e7f9a0b3c")).toBe(true);
  });

  it("rejects catalog playlist ids and the old pl- ids", () => {
    expect(isUserPlaylistId("pl-abc123")).toBe(false);
    expect(isUserPlaylistId("VLPLrAXtmErZgOeiKm4sgNOknGvNjby9efdf")).toBe(
      false,
    );
    expect(isUserPlaylistId("PL-abcdefgh")).toBe(false);
    expect(
      isUserPlaylistId("RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs"),
    ).toBe(false);
    expect(isUserPlaylistId("daily-mix-1")).toBe(false);
  });
});
