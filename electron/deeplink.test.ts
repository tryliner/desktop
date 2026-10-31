import { describe, expect, it } from "vitest";
import { findDeeplinkArg, parseDeeplink } from "./deeplink";

describe("parseDeeplink", () => {
  it("accepts password reset links with a well-formed token only", () => {
    const token = `lrst_${"a".repeat(43)}`;
    expect(parseDeeplink(`liner://reset-password?id=${token}`)).toEqual({
      type: "reset-password",
      id: token,
    });
    expect(parseDeeplink(`liner://reset-password?id=${token}x`)).toBeNull();
    expect(parseDeeplink("liner://reset-password?id=lrst_short")).toBeNull();
    expect(
      parseDeeplink(`liner://reset-password?id=lmod_${"a".repeat(43)}`),
    ).toBeNull();
  });

  it("accepts real share targets", () => {
    expect(parseDeeplink("liner://artist?id=UCGtGpOIGHfRu1KYL9pi-mNQ")).toEqual(
      {
        type: "artist",
        id: "UCGtGpOIGHfRu1KYL9pi-mNQ",
      },
    );
    expect(parseDeeplink("liner://album?id=MPREb_xCxkOKReFZv")).toEqual({
      type: "album",
      id: "MPREb_xCxkOKReFZv",
    });
    expect(
      parseDeeplink("liner://playlist?id=VLPLD8jNKEyHYB2DHh5vXSI4USLFo29vzUYl"),
    ).toEqual({ type: "playlist", id: "VLPLD8jNKEyHYB2DHh5vXSI4USLFo29vzUYl" });
    expect(parseDeeplink("liner://track?id=RGdkabupfPI")).toEqual({
      type: "track",
      id: "RGdkabupfPI",
    });
  });

  it("accepts artist names used when a track has no channel id", () => {
    expect(parseDeeplink("liner://artist?id=LATIN%20MAFIA")).toEqual({
      type: "artist",
      id: "LATIN MAFIA",
    });
  });

  it("rejects smuggled urls", () => {
    expect(parseDeeplink("https://evil.com")).toBeNull();
    expect(parseDeeplink("javascript:alert(1)")).toBeNull();
    expect(parseDeeplink("liner://artist?id=LATIN%20MAFIA%0A")).toBeNull();
    expect(
      parseDeeplink("liner://artist?id=UCaaaaaaaaaaaaaaaaaaaaaa&x=1&y=2"),
    ).toEqual({
      type: "artist",
      id: "UCaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(
      parseDeeplink(
        "liner://artist?id=UCaaaaaaaaaaaaaaaaaaaaaa&id=UCbbbbbbbbbbbbbbbbbbbbbb",
      ),
    ).toBeNull();
    expect(parseDeeplink("liner://artist")).toBeNull();
    expect(parseDeeplink("liner://evil?id=RGdkabupfPI")).toBeNull();
    expect(parseDeeplink("liner://track?id=RGdkabupfPIextra")).toBeNull();
    expect(
      parseDeeplink("liner://artist?id=ABaaaaaaaaaaaaaaaaaaaaaa"),
    ).toBeNull();
    expect(parseDeeplink("liner://artist?id=UCaaa/../../../../etc")).toBeNull();
    expect(parseDeeplink("not a url")).toBeNull();
  });

  it("finds the deeplink arg anywhere in argv", () => {
    expect(
      findDeeplinkArg(["/usr/bin/liner", "liner://track?id=RGdkabupfPI"]),
    ).toBe("liner://track?id=RGdkabupfPI");
    expect(findDeeplinkArg(["/usr/bin/liner", "--no-sandbox"])).toBeUndefined();
  });
});
