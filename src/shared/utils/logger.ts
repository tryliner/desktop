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

const COLOR_MAP: Record<LogColor, { bg: string; text: string; ansi: string }> = {
  red: { bg: "#ef4444", text: "#ffffff", ansi: "\x1b[41;37m" },
  green: { bg: "#22c55e", text: "#000000", ansi: "\x1b[42;30m" },
  yellow: { bg: "#eab308", text: "#000000", ansi: "\x1b[43;30m" },
  blue: { bg: "#3b82f6", text: "#ffffff", ansi: "\x1b[44;37m" },
  magenta: { bg: "#ec4899", text: "#ffffff", ansi: "\x1b[45;37m" },
  cyan: { bg: "#06b6d4", text: "#000000", ansi: "\x1b[46;30m" },
  gray: { bg: "#6b7280", text: "#ffffff", ansi: "\x1b[100;37m" },
  white: { bg: "#f3f4f6", text: "#000000", ansi: "\x1b[47;30m" },
  black: { bg: "#18181b", text: "#ffffff", ansi: "\x1b[40;37m" },
};

export function log(
  color: LogColor,
  tag: string,
  message: string,
  ...args: unknown[]
): void {
  if (typeof console === "undefined") return;
  const config = COLOR_MAP[color] ?? COLOR_MAP.blue;
  if (typeof window !== "undefined") {
    // browser devtools: solid filled badge with rounded corners
    console.log(
      `%c ${tag} %c ${message}`,
      `background:${config.bg};color:${config.text};font-weight:700;font-size:10px;padding:2px 6px;border-radius:4px;`,
      "color:inherit;font-weight:normal;",
      ...args,
    );
  } else {
    // terminal / node fallback: filled ansi background badge
    console.log(`${config.ansi} ${tag} \x1b[0m ${message}`, ...args);
  }
}
