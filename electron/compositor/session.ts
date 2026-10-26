import { app } from "electron";

export type CompositorKind = "hyprland" | "sway" | "other-wayland" | "none";

function isNativeWayland(): boolean {
  if (process.platform !== "linux") return false;
  if (
    !process.env.WAYLAND_DISPLAY &&
    process.env.XDG_SESSION_TYPE !== "wayland"
  ) {
    return false;
  }
  const ozone = app.commandLine.getSwitchValue("ozone-platform");
  const hint = app.commandLine.getSwitchValue("ozone-platform-hint");
  return ozone !== "x11" && hint !== "x11";
}

export function detectCompositor(): CompositorKind {
  if (!isNativeWayland()) return "none";
  if (process.env.HYPRLAND_INSTANCE_SIGNATURE && process.env.XDG_RUNTIME_DIR) {
    return "hyprland";
  }
  if (process.env.SWAYSOCK) return "sway";
  return "other-wayland";
}

export function isLinuxWaylandSession(): boolean {
  return (
    process.platform === "linux" &&
    (Boolean(process.env.WAYLAND_DISPLAY) ||
      process.env.XDG_SESSION_TYPE === "wayland")
  );
}
