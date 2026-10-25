import type { PublicUser } from "../model/types";

export function userDisplayName(
  user:
    Pick<PublicUser, "displayName" | "username" | "email"> | null | undefined,
): string | undefined {
  return (
    user?.displayName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    undefined
  );
}
