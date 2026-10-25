import { ipcRenderer } from "electron";
import { mintWebPoToken } from "./web-minter";
import { getTvSession } from "./tv-session";
import { solveN } from "./n-solver";

interface WorkerRequest {
  id: number;
  method: string;
  payload: Record<string, unknown>;
}

function runMethod(
  method: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  if (method === "mint") return mintWebPoToken(String(payload.identifier));
  if (method === "tv-session") return getTvSession();
  if (method === "solve-n")
    return solveN(
      String(payload.playerId),
      Array.isArray(payload.values) ? payload.values.map(String) : [],
    );
  return Promise.reject(new Error(`unknown worker method ${method}`));
}

export function startPoTokenWorker(): void {
  ipcRenderer.on("potoken:request", async (_event, request: WorkerRequest) => {
    try {
      const value = await runMethod(request.method, request.payload ?? {});
      ipcRenderer.send("potoken:result", { id: request.id, value });
    } catch (error) {
      ipcRenderer.send("potoken:result", {
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  window.addEventListener("DOMContentLoaded", () =>
    ipcRenderer.send("potoken:ready"),
  );
}
