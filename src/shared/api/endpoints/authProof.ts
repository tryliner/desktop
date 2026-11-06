import { ApiError } from "../apiError";
import { call } from "../call";
import {
  isHumanCheckMode,
  runHumanCheck,
  type HumanCheckAction,
} from "../humanCheck";
import {
  PowTimeoutError,
  SUPPORTED_POW_ALGORITHM,
  type PowChallenge,
  type PowSolution,
} from "../proofOfWork";
import { solvePow } from "../proofOfWorkRunner";

const RETRYABLE_POW_CODES = new Set(["POW_EXPIRED", "POW_REUSED"]);

export interface AuthProof {
  pow?: PowSolution;
  turnstile?: string;
  edge?: boolean;
}

/** The proof fields of a login, register or reset request body. */
export function proofBody(proof: AuthProof) {
  return { pow: proof.pow, turnstile: proof.turnstile };
}

/** The edge cookie cloudflare set during the check rides along. */
export function proofCredentials(
  proof: AuthProof,
): RequestCredentials | undefined {
  return proof.edge ? "include" : undefined;
}

function blockedBeforeOurServer(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && error.status === 0)
  );
}

async function humanCheck(
  challenge: PowChallenge,
  purpose: HumanCheckAction,
): Promise<string | undefined> {
  const requested = challenge.turnstile?.mode;
  const mode = isHumanCheckMode(requested) ? requested : "off";
  if (mode === "off" && !challenge.turnstile?.edge) return undefined;
  return runHumanCheck(purpose, mode === "off" ? "optional" : mode);
}

async function authProofFor(
  purpose: HumanCheckAction,
  email: string,
): Promise<AuthProof> {
  let challenge: PowChallenge;
  try {
    challenge = await call(
      "POST /v1/auth/challenge",
      { body: { purpose, email } },
      { allowRefresh: false },
    );
  } catch (error) {
    // an api without the challenge route takes the plain body
    if (error instanceof ApiError && error.status === 404) return {};
    throw error;
  }
  const work =
    challenge.mode === "off" || challenge.algorithm !== SUPPORTED_POW_ALGORITHM
      ? undefined
      : solvePow(challenge);
  void work?.catch(() => undefined);
  const turnstile = await humanCheck(challenge, purpose);
  return {
    pow: await work,
    turnstile,
    edge: challenge.turnstile?.edge === true,
  };
}

/** Runs a login, register or reset request with a fresh proof, once more if it went stale. */
export async function withAuthProof<T>(
  purpose: HumanCheckAction,
  email: string,
  send: (proof: AuthProof) => Promise<T>,
): Promise<T> {
  let proof: AuthProof | undefined;
  try {
    proof = await authProofFor(purpose, email);
    return await send(proof);
  } catch (error) {
    const retryable =
      error instanceof PowTimeoutError ||
      (error instanceof ApiError &&
        !!error.code &&
        RETRYABLE_POW_CODES.has(error.code)) ||
      (proof?.edge === true && blockedBeforeOurServer(error));
    if (!retryable) throw error;
    return send(await authProofFor(purpose, email));
  }
}
