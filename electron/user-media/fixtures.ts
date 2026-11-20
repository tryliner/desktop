export const pad = (head: number[], size = 32) =>
  new Uint8Array([
    ...head,
    ...Array.from({ length: Math.max(0, size - head.length) }, () => 0),
  ]);
export const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

export const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
export const GIF = pad(ascii("GIF89a"));
export const WEBP = pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]);
export const AVIF = pad([0, 0, 0, 0x1c, ...ascii("ftypavif")]);
export const MP4 = pad([0, 0, 0, 0x18, ...ascii("ftypisom")]);
export const HEIC = pad([0, 0, 0, 0x18, ...ascii("ftypheic")]);
export const WEBM = pad([0x1a, 0x45, 0xdf, 0xa3]);
