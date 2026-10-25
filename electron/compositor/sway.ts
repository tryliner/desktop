import { execFile } from "node:child_process";
import type { KeyCombo, Modifier } from "./keys";
import {
  overlayOrigin,
  waitFor,
  type PlacementRequest,
  type WorkArea,
} from "./placement";

interface SwayNode {
  id: number;
  focused: boolean;
  nodes?: SwayNode[];
  floating_nodes?: SwayNode[];
}

interface SwayWorkspace {
  focused: boolean;
  rect: WorkArea;
}

interface SwayResult {
  success: boolean;
}

const SWAY_MODIFIERS: Record<Modifier, string> = {
  CTRL: "Ctrl",
  ALT: "Mod1",
  SHIFT: "Shift",
  SUPER: "Mod4",
};

const boundCombos = new Map<string, string>();

function swaymsg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("swaymsg", args, { timeout: 1500 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function swayCommand(command: string): Promise<boolean> {
  const output = await swaymsg(["-r", command]).catch(() => "[]");
  const results = JSON.parse(output) as SwayResult[];
  return results.length > 0 && results.every((result) => result.success);
}

function findFocused(node: SwayNode): number | null {
  if (node.focused) return node.id;
  for (const child of [...(node.nodes ?? []), ...(node.floating_nodes ?? [])]) {
    const found = findFocused(child);
    if (found !== null) return found;
  }
  return null;
}

export async function focusedSwayNode(): Promise<number | null> {
  const tree = await swaymsg(["-r", "-t", "get_tree"]).catch(() => null);
  return tree ? findFocused(JSON.parse(tree) as SwayNode) : null;
}

export async function placeSwayWindow(
  request: PlacementRequest,
  previousFocus: number | null,
): Promise<boolean> {
  const workspaces = JSON.parse(
    await swaymsg(["-r", "-t", "get_workspaces"]),
  ) as SwayWorkspace[];
  const area = workspaces.find((workspace) => workspace.focused)?.rect;
  if (!area) return false;
  const { x, y } = overlayOrigin(area, request);
  const criteria = `[pid=${process.pid} title="^${request.title}$"]`;
  const placed = await waitFor(async () =>
    (await swayCommand(
      `${criteria} floating enable, sticky ${request.pinned ? "enable" : "disable"}, border none, move absolute position ${x} ${y}`,
    ))
      ? true
      : null,
  );
  if (placed && previousFocus !== null) {
    await swayCommand(`[con_id=${previousFocus}] focus`);
  }
  return Boolean(placed);
}

function swayKeys(combo: KeyCombo): string {
  return [...combo.modifiers.map((mod) => SWAY_MODIFIERS[mod]), combo.key].join(
    "+",
  );
}

export async function bindSwayShortcut(
  id: string,
  combo: KeyCombo,
  command: string,
): Promise<boolean> {
  await unbindSwayShortcut(id);
  const keys = swayKeys(combo);
  const ok = await swayCommand(
    `bindsym --no-repeat --to-code ${keys} exec ${command}`,
  );
  if (ok) boundCombos.set(id, keys);
  return ok;
}

export async function unbindSwayShortcut(id: string): Promise<void> {
  const keys = boundCombos.get(id);
  if (!keys) return;
  boundCombos.delete(id);
  await swayCommand(`unbindsym --to-code ${keys}`);
}
