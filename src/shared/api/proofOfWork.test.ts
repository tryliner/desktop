import { describe, expect, it } from "vitest";
import { argon2id } from "hash-wasm";
import { leadingZeroBits, solvePowChallenge, type PowChallenge } from "./proofOfWork";

const SERVER_REFERENCE = "9590934b4f561101282723d04ea3988e94720ff5fdbe6a6dfeb94f34d6b1dbc9";

function challenge(overrides: Partial<PowChallenge> = {}): PowChallenge {
  return {
    mode: "required",
    algorithm: "argon2id-v1",
    token: "test-token",
    salt: "MDEyMzQ1Njc4OWFiY2RlZg",
    difficulty: 3,
    memoryKiB: 1024,
    iterations: 1,
    parallelism: 1,
    hashLength: 32,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe("proof of work solver", () => {
  it("hashes exactly like the api's native argon2", async () => {
    const hex = await argon2id({
      password: "token:42",
      salt: new TextEncoder().encode("0123456789abcdef"),
      parallelism: 1,
      iterations: 1,
      memorySize: 1024,
      hashLength: 32,
      outputType: "hex",
    });
    expect(hex).toBe(SERVER_REFERENCE);
  });

  it("finds a nonce whose hash has enough leading zero bits", async () => {
    const task = challenge();
    const solution = await solvePowChallenge(task);
    const hash = await argon2id({
      password: `${task.token}:${solution.nonce}`,
      salt: new TextEncoder().encode("0123456789abcdef"),
      parallelism: 1,
      iterations: 1,
      memorySize: 1024,
      hashLength: 32,
      outputType: "binary",
    });
    expect(solution.token).toBe(task.token);
    expect(leadingZeroBits(hash)).toBeGreaterThanOrEqual(3);
  });

  it("gives up once the challenge expires", async () => {
    await expect(
      solvePowChallenge(challenge({ difficulty: 30, expiresAt: new Date(Date.now() - 1).toISOString() })),
    ).rejects.toThrow();
  });
});
