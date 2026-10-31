import type { ApiBody, AuthTokens, AuthUser } from "./api.generated";

export type { AuthTokens, AuthUser };

/** The signed-in user (`GET /v1/me`, the `user` of the token answers). */
export type PublicUser = AuthUser;

export type RegisterInput = ApiBody<"POST /v1/auth/register">;
export type LoginInput = ApiBody<"POST /v1/auth/login">;
