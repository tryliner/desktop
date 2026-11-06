import { setAuthSession } from "../auth-session";
import { call } from "../call";
import { proofBody, proofCredentials, withAuthProof } from "./authProof";
import type {
  AuthTokens,
  AuthUser,
  RecoveryRequestAccepted,
} from "@/shared/contracts";

export const authApi = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const result = await withAuthProof("login", email, (proof) =>
      call(
        "POST /v1/auth/login",
        { body: { email, password, ...proofBody(proof) } },
        { allowRefresh: false, credentials: proofCredentials(proof) },
      ),
    );
    setAuthSession(result);
    return result;
  },

  async register(
    email: string,
    password: string,
    username: string,
    displayName: string,
  ): Promise<AuthTokens> {
    const result = await withAuthProof("register", email, (proof) =>
      call(
        "POST /v1/auth/register",
        {
          body: {
            email,
            password,
            username: username.trim().toLowerCase(),
            displayName: displayName.trim(),
            ...proofBody(proof),
          },
        },
        { allowRefresh: false, credentials: proofCredentials(proof) },
      ),
    );
    setAuthSession(result);
    return result;
  },

  /**
   * Asks for a password reset link to the email. The api answers the same whether or not the
   * email has an account, so this never tells which.
   */
  requestPasswordReset(email: string): Promise<RecoveryRequestAccepted> {
    return withAuthProof("reset", email, (proof) =>
      call(
        "POST /v1/auth/recovery-link",
        { body: { email, ...proofBody(proof) } },
        { allowRefresh: false, credentials: proofCredentials(proof) },
      ),
    );
  },

  getMe(): Promise<AuthUser> {
    return call("GET /v1/me");
  },
};
