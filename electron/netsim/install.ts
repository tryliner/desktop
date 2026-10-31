import { app, type Session } from "electron";
import {
  describeNetSimulation,
  parseNetSimulation,
  simulatedFailureFor,
  simulatedStatusLine,
  type NetSimulation,
} from "./simulation.js";

const HANG_MS = 120_000;

let active: NetSimulation | null = null;

export function activeNetSimulation(): NetSimulation | null {
  return active;
}

export function simulatedResponseStatus(
  url: string,
  method: string,
): string | null {
  return active ? simulatedStatusLine(url, method, active) : null;
}

export function installNetSimulation(session: Session): void {
  if (app.isPackaged) return;
  active = parseNetSimulation(process.env);
  if (!active) return;
  const sim = active;
  console.log(
    `\x1b[45;37m netsim \x1b[0m simulating ${describeNetSimulation(sim)} (unpackaged build only)`,
  );
  session.webRequest.onBeforeRequest(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      const failure = simulatedFailureFor(details.url, sim);
      if (failure === "blocked") {
        callback({ cancel: true });
        return;
      }
      if (failure === "timeout") {
        setTimeout(() => callback({ cancel: true }), HANG_MS);
        return;
      }
      callback({});
    },
  );
}
