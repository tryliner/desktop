import { spawnSync } from "node:child_process";

export const SECRET_SERVICE_NAME = "org.freedesktop.secrets";
const BUS_METHODS = ["ListNames", "ListActivatableNames"];
const DBUS_TIMEOUT_MS = 1_000;

export type BusQuery = (method: string) => string | null;

export function listsSecretService(output: string): boolean {
  return output.includes(`"${SECRET_SERVICE_NAME}"`);
}

export function querySessionBus(method: string): string | null {
  const result = spawnSync(
    "dbus-send",
    [
      "--session",
      "--print-reply",
      `--reply-timeout=${DBUS_TIMEOUT_MS}`,
      "--dest=org.freedesktop.DBus",
      "/org/freedesktop/DBus",
      `org.freedesktop.DBus.${method}`,
    ],
    { encoding: "utf8", timeout: DBUS_TIMEOUT_MS * 2 },
  );
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

export function hasSecretService(query: BusQuery = querySessionBus): boolean {
  return BUS_METHODS.some((method) => {
    const output = query(method);
    return output !== null && listsSecretService(output);
  });
}
