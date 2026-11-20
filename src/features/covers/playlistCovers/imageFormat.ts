const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

function skipSubBlocks(bytes: Uint8Array, start: number): number {
  let i = start;
  while (i < bytes.length) {
    const size = bytes[i];
    i += 1;
    if (size === 0) return i;
    i += size;
  }
  return -1;
}

function colorTableSize(packed: number): number {
  return packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0;
}

export function countGifFrames(bytes: Uint8Array, stopAfter = 2): number {
  if (bytes.length < 13 || ascii(bytes, 0, 3) !== "GIF") return 0;
  let i = 13 + colorTableSize(bytes[10]);
  let frames = 0;
  while (i < bytes.length && frames < stopAfter) {
    const block = bytes[i];
    if (block === 0x3b) break;
    if (block === 0x21) {
      i = skipSubBlocks(bytes, i + 2);
    } else if (block === 0x2c) {
      if (i + 10 > bytes.length) break;
      frames += 1;
      i = skipSubBlocks(bytes, i + 10 + colorTableSize(bytes[i + 9]) + 1);
    } else {
      break;
    }
    if (i < 0) break;
  }
  return frames;
}

export function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 21) return false;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return false;
  }
  return ascii(bytes, 12, 4) === "VP8X" && (bytes[20] & 0x02) !== 0;
}

export function isAnimatedImage(bytes: Uint8Array): boolean {
  return countGifFrames(bytes) > 1 || isAnimatedWebp(bytes);
}
