import type { ApiBody, AuthUser } from "./api.generated";

export type {
  AuthTokens,
  AuthUser,
  RecoveryRequestAccepted,
} from "./api.generated";

/** The signed-in user (`GET /v1/me`, the `user` of the token answers). */
export type PublicUser = AuthUser;

export type RegisterInput = ApiBody<"POST /v1/auth/register">;
export type LoginInput = ApiBody<"POST /v1/auth/login">;

export interface UsernameAvailability {
  username: string;
  valid: boolean;
  available: boolean;
}
