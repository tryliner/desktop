import {
  hyprDispatch,
  hyprJson,
  hyprRequest,
  isLuaMode,
  luaString,
} from "./hyprlandIpc";
import { overlayOrigin, waitFor, type PlacementRequest } from "./placement";

interface HyprClient {
  address: string;
  title: string;
  pid: number;
  mapped: boolean;
  pinned: boolean;
}

interface HyprMonitor {
  focused: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  transform: number;
  reserved: [number, number, number, number];
}

async function findClient(title: string): Promise<HyprClient | null> {
  return waitFor(async () => {
    const clients = await hyprJson<HyprClient[]>("clients");
    return (
      clients.find(
        (client) =>
          client.mapped && client.title === title && client.pid === process.pid,
      ) ?? null
    );
  });
}

async function focusedWorkArea() {
  const monitors = await hyprJson<HyprMonitor[]>("monitors");
  const monitor = monitors.find((entry) => entry.focused) ?? monitors[0];
  if (!monitor) return null;
  const rotated = monitor.transform % 2 === 1;
  const width = (rotated ? monitor.height : monitor.width) / monitor.scale;
  const height = (rotated ? monitor.width : monitor.height) / monitor.scale;
  const [left, top, right, bottom] = monitor.reserved;
  return {
    x: monitor.x + left,
    y: monitor.y + top,
    width: width - left - right,
    height: height - top - bottom,
  };
}

export async function activeHyprWindow(): Promise<string | null> {
  const active = await hyprJson<{ address?: string }>("activewindow").catch(
    () => null,
  );
  return active?.address ?? null;
}

export async function placeHyprlandWindow(
  request: PlacementRequest,
  previousFocus: string | null,
): Promise<boolean> {
  const [client, area] = await Promise.all([
    findClient(request.title),
    focusedWorkArea(),
  ]);
  if (!client || !area) return false;
  const { x, y } = overlayOrigin(area, request);
  const target = `address:${client.address}`;
  const refocus = previousFocus && previousFocus !== client.address;

  if (await isLuaMode()) {
    const sel = `window = ${luaString(target)}`;
    const steps = [
      `hl.dsp.window.float({ action = "enable", ${sel} })`,
      `hl.dsp.window.move({ x = ${x}, y = ${y}, "exact", ${sel} })`,
      `hl.dsp.window.pin({ action = "${request.pinned ? "enable" : "disable"}", ${sel} })`,
      ...[
        ["border_size", 0],
        ["rounding", 0],
        ["no_shadow", 1],
        ["no_blur", 1],
      ].map(
        ([prop, value]) =>
          `hl.dsp.window.set_prop({ prop = "${prop}", value = ${value}, ${sel} })`,
      ),
      ...(refocus
        ? [
            `hl.dsp.focus({ window = ${luaString(`address:${previousFocus}`)} })`,
          ]
        : []),
    ];
    const body = steps.map((step) => `hl.dispatch(${step})`).join("; ");
    return hyprDispatch(`function() ${body} end`);
  }

  const commands = [
    `dispatch setfloating ${target}`,
    `dispatch movewindowpixel exact ${x} ${y},${target}`,
    ...(client.pinned !== request.pinned ? [`dispatch pin ${target}`] : []),
    `dispatch setprop ${target} noborder 1`,
    `dispatch setprop ${target} noshadow 1`,
    `dispatch setprop ${target} rounding 0`,
    `dispatch setprop ${target} noblur 1`,
    ...(refocus ? [`dispatch focuswindow address:${previousFocus}`] : []),
  ];
  await hyprRequest(`[[BATCH]]${commands.join(";")}`);
  return true;
}
