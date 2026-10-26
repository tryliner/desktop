export function spotifySecretBytes(secret: string): Uint8Array<ArrayBuffer> {
  const transformed = secret
    .split("")
    .map((char, index) => char.charCodeAt(0) ^ ((index % 33) + 9));
  const encoded = new TextEncoder().encode(transformed.join(""));
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length));
  bytes.set(encoded);
  return bytes;
}

function counterBytes(timeMs: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigInt64(0, BigInt(Math.floor(timeMs / 1000 / 30)));
  return buffer;
}

export async function generateTotp(
  secret: Uint8Array<ArrayBuffer>,
  timeMs: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const hmac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counterBytes(timeMs)),
  );
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, "0");
}
