export type RootVars = Partial<Record<`--${string}`, string>>;

const DARK_ROOT = 'html:root[data-theme="dark"], html:root.dark';
const LIGHT_ROOT = 'html:root[data-theme="light"], html:root.light';

function block(selector: string, vars: RootVars): string {
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value} !important;`)
    .join("\n");
  return body ? `${selector} {\n${body}\n}` : "";
}

export function rootVarsCss(vars: { dark: RootVars; light: RootVars }): string {
  return [block(DARK_ROOT, vars.dark), block(LIGHT_ROOT, vars.light)]
    .filter(Boolean)
    .join("\n\n");
}

export function glassVars(
  opacity: number,
  blurPx: number,
  isDark: boolean,
): RootVars {
  const alpha = Math.min(0.9, Math.max(0, opacity)).toFixed(2);
  return {
    "--bg-glass": isDark
      ? `rgba(18, 18, 20, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`,
    "--glass-blur": `${Math.round(blurPx)}px`,
  };
}

export function readableDim(luminance: number, isDark: boolean): number {
  const l = Math.min(1, Math.max(0, luminance));
  const needed = isDark
    ? l <= 0.16
      ? 0
      : 1 - 0.16 / l
    : l >= 0.6
      ? 0
      : (0.6 - l) / (1 - l);
  return Math.min(0.85, Math.max(0, needed));
}
