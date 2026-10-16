export const LOCAL_ID_PREFIX = "local:";

export function isLocalTrackId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(LOCAL_ID_PREFIX);
}
