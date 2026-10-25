import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ACTION_PATTERN = /^[a-z-]{1,32}$/;

export interface CommandPipe {
  commandFor: (action: string) => string;
  dispose: () => void;
}

function pipePath(): string {
  const base = process.env.XDG_RUNTIME_DIR || os.tmpdir();
  return path.join(base, `liner-${process.pid}.cmd`);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function openCommandPipe(
  onAction: (action: string) => void,
): CommandPipe | null {
  const target = pipePath();
  try {
    fs.rmSync(target, { force: true });
    execFileSync("mkfifo", ["-m", "600", target]);
  } catch (error) {
    console.warn("[compositor] could not create command pipe:", error);
    return null;
  }

  let socket: net.Socket | null = null;
  try {
    const fd = fs.openSync(
      target,
      fs.constants.O_RDWR | fs.constants.O_NONBLOCK,
    );
    socket = new net.Socket({ fd, readable: true, writable: false });
  } catch (error) {
    console.warn("[compositor] could not open command pipe:", error);
    fs.rmSync(target, { force: true });
    return null;
  }

  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const action = line.trim();
      if (ACTION_PATTERN.test(action)) onAction(action);
    }
  });
  socket.on("error", (error) => {
    console.warn("[compositor] command pipe error:", error);
  });

  return {
    commandFor: (action) => {
      const quoted = shellQuote(target);
      return `test -p ${quoted} && printf '%s\\n' ${action} 1<>${quoted}`;
    },
    dispose: () => {
      socket?.destroy();
      socket = null;
      fs.rmSync(target, { force: true });
    },
  };
}
