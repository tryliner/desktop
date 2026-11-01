import { argon2id } from "hash-wasm";

export interface PowChallenge {
  mode: "off" | "optional" | "required";
  algorithm: string;
  token: string;
  salt: string;
  difficulty: number;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
  expiresAt: string;
}

export interface PowSolution {
  token: string;
  nonce: string;
}

export const SUPPORTED_POW_ALGORITHM = "argon2id-v1";
const MAX_EXTRA_BITS = 6;

export function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function solvePowChallenge(
  challenge: PowChallenge,
  signal?: AbortSignal,
): Promise<PowSolution> {
  const salt = fromBase64Url(challenge.salt);
  const deadline = Date.parse(challenge.expiresAt);
  const maxTries = 2 ** Math.min(challenge.difficulty + MAX_EXTRA_BITS, 30);
  for (let nonce = 0; nonce < maxTries; nonce += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (Number.isFinite(deadline) && Date.now() >= deadline) break;
    const hash = await argon2id({
      password: `${challenge.token}:${nonce}`,
      salt,
      parallelism: challenge.parallelism,
      iterations: challenge.iterations,
      memorySize: challenge.memoryKiB,
      hashLength: challenge.hashLength,
      outputType: "binary",
    });
    if (leadingZeroBits(hash) >= challenge.difficulty) {
      return { token: challenge.token, nonce: String(nonce) };
    }
  }
  throw new Error("The sign-in check took too long, try again.");
}
