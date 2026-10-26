import net from "node:net";
import path from "node:path";

const REQUEST_TIMEOUT_MS = 1500;

function socketPath(): string | null {
  const runtime = process.env.XDG_RUNTIME_DIR;
  const signature = process.env.HYPRLAND_INSTANCE_SIGNATURE;
  if (!runtime || !signature) return null;
  return path.join(runtime, "hypr", signature, ".socket.sock");
}

export function hyprRequest(command: string): Promise<string> {
  const target = socketPath();
  if (!target) return Promise.reject(new Error("hyprland socket unavailable"));
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(target);
    let response = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`hyprland request timed out: ${command.slice(0, 40)}`));
    }, REQUEST_TIMEOUT_MS);
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.end(command));
    socket.on("data", (chunk: string) => {
      response += chunk;
    });
    socket.on("close", () => {
      clearTimeout(timer);
      resolve(response);
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function hyprJson<T>(query: string): Promise<T> {
  return JSON.parse(await hyprRequest(`j/${query}`)) as T;
}

let luaMode: Promise<boolean> | null = null;

export function isLuaMode(): Promise<boolean> {
  luaMode ??= hyprRequest("dispatch hl.dsp.no_op()")
    .then((response) => response.trim() === "ok")
    .catch(() => false);
  return luaMode;
}

export async function hyprDispatch(command: string): Promise<boolean> {
  const response = await hyprRequest(`dispatch ${command}`);
  return response.trim() === "ok";
}

export function luaString(value: string): string {
  return JSON.stringify(value);
}
