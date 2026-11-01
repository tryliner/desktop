import { PowTimeoutError, solvePowChallenge, type PowChallenge } from "./proofOfWork";

self.onmessage = async (event: MessageEvent<PowChallenge>) => {
  try {
    const solution = await solvePowChallenge(event.data);
    self.postMessage({ ok: true, solution });
  } catch (error) {
    self.postMessage({
      ok: false,
      timeout: error instanceof PowTimeoutError,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
