import { setAuthSession } from "../auth-session";
import { call } from "../call";
import type { AuthTokens, AuthUser, RecoveryLink } from "@/shared/contracts";

export const authApi = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const result = await call(
      "POST /v1/auth/login",
      { body: { email, password } },
      { allowRefresh: false },
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
    const result = await call(
      "POST /v1/auth/register",
      {
        body: {
          email,
          password,
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
        },
      },
      { allowRefresh: false },
    );
    setAuthSession(result);
    return result;
  },

  getPasswordReset(token: string): Promise<RecoveryLink> {
    return call(
      "GET /v1/auth/recovery-links/:token",
      { params: { token } },
      { allowRefresh: false },
    );
  },

  async completePasswordReset(token: string, password: string): Promise<void> {
    await call(
      "POST /v1/auth/recovery-links/:token",
      { params: { token }, body: { password } },
      { allowRefresh: false },
    );
  },

  getMe(): Promise<AuthUser> {
    return call("GET /v1/me");
  },
};
