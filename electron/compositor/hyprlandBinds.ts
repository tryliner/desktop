import { hyprRequest, isLuaMode } from "./hyprlandIpc";
import type { KeyCombo } from "./keys";

const boundCombos = new Map<string, KeyCombo>();

function hyprKey(combo: KeyCombo): string {
  if (combo.code !== null) return `code:${combo.code}`;
  return combo.key.length === 1 ? combo.key.toUpperCase() : combo.key;
}

export async function bindHyprlandShortcut(
  id: string,
  combo: KeyCombo,
  command: string,
): Promise<boolean> {
  if (await isLuaMode()) return false;
  await unbindHyprlandShortcut(id);
  const key = hyprKey(combo);
  const mods = combo.modifiers.join(" ");
  await hyprRequest(`keyword unbind ${mods},${key}`).catch(() => "");
  const response = await hyprRequest(
    `keyword bind ${mods},${key},exec,${command}`,
  );
  const ok = response.trim() === "ok";
  if (ok) boundCombos.set(id, combo);
  return ok;
}

export async function unbindHyprlandShortcut(id: string): Promise<void> {
  const combo = boundCombos.get(id);
  if (!combo) return;
  boundCombos.delete(id);
  await hyprRequest(
    `keyword unbind ${combo.modifiers.join(" ")},${hyprKey(combo)}`,
  ).catch(() => "");
}
