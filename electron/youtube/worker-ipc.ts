import { ipcMain } from "electron";
import type { PoTokenService } from "./potoken.js";

const IDENTIFIER = /^[\w=-]{1,128}$/;
const PLAYER_ID = /^[\w-]{4,32}$/;
const N_VALUE = /^[\w-]{1,64}$/;
const MAX_N_VALUES = 32;
const TV_SESSION_TIMEOUT_MS = 30_000;
const SOLVE_TIMEOUT_MS = 45_000;

function readSolveRequest(payload: unknown): {
  playerId: string;
  values: string[];
} {
  if (!payload || typeof payload !== "object")
    throw new Error("invalid request");
  const { playerId, values } = payload as Record<string, unknown>;
  if (typeof playerId !== "string" || !PLAYER_ID.test(playerId))
    throw new Error("invalid player id");
  if (
    !Array.isArray(values) ||
    values.length > MAX_N_VALUES ||
    !values.every((value) => typeof value === "string" && N_VALUE.test(value))
  )
    throw new Error("invalid n values");
  return { playerId, values: values as string[] };
}

export function registerYoutubeWorkerIpc(service: PoTokenService): void {
  ipcMain.handle("potoken:mint", (_event, identifier: unknown) => {
    if (typeof identifier !== "string" || !IDENTIFIER.test(identifier))
      throw new Error("invalid identifier");
    return service.mint(identifier);
  });
  ipcMain.handle("youtube:tv-session", () =>
    service.request("tv-session", {}, TV_SESSION_TIMEOUT_MS),
  );
  ipcMain.handle("youtube:solve-n", (_event, payload: unknown) =>
    service.request("solve-n", readSolveRequest(payload), SOLVE_TIMEOUT_MS),
  );
}
