import { describe, expect, it } from "vitest";
import { sniffMediaType } from "./sniff";
import {
  AVIF,
  GIF,
  HEIC,
  JPEG,
  MP4,
  PNG,
  WEBM,
  WEBP,
  ascii,
  pad,
} from "./fixtures";

describe("sniffMediaType", () => {
  it.each([
    ["png", PNG, "image/png"],
    ["jpeg", JPEG, "image/jpeg"],
    ["gif", GIF, "image/gif"],
    ["webp", WEBP, "image/webp"],
    ["avif", AVIF, "image/avif"],
    ["mp4", MP4, "video/mp4"],
    ["webm", WEBM, "video/webm"],
  ])("recognises %s by its bytes", (_name, bytes, mime) => {
    expect(sniffMediaType(bytes)).toBe(mime);
  });

  it("rejects heic, text and tiny files", () => {
    expect(sniffMediaType(HEIC)).toBeNull();
    expect(sniffMediaType(pad(ascii("<svg xmlns")))).toBeNull();
    expect(sniffMediaType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
