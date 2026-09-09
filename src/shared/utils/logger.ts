export type LogColor =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "gray"
  | "white"
  | "black";

const ANSI: Record<LogColor, string> = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
  black: "\x1b[30m",
};

export function log(
  color: LogColor,
  tag: string,
  message: string,
  ...args: unknown[]
): void {
  if (typeof console === "undefined") return;
  const prefix = `[${tag}]`;
  if (typeof window !== "undefined") {
    // Browser: color the "[tag]" prefix via CSS.
    console.log(
      `%c${prefix}%c ${message}`,
      `color:${color};font-weight:700`,
      "color:inherit",
      ...args,
    );
  } else {
    // Node / SSR fallback: ANSI escapes.
    console.log(`${ANSI[color]}${prefix}\x1b[0m ${message}`, ...args);
  }
}
