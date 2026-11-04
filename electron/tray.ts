import {
  Menu,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
} from "electron";
import {
  PLAYING_STATUSES,
  type ThumbarAction,
  type ThumbarPlayerState,
} from "./thumbar.js";

export interface TrayDeps {
  iconPath: string;
  /** bring the main window back, creating it if it was closed */
  showWindow: () => void;
  send: (action: ThumbarAction) => void;
  quit: () => void;
  platform?: NodeJS.Platform;
}

export function trayMenuTemplate(
  state: { hasTrack: boolean; playing: boolean },
  deps: Pick<TrayDeps, "showWindow" | "send" | "quit">,
): MenuItemConstructorOptions[] {
  return [
    { label: "Show Liner", click: () => deps.showWindow() },
    { type: "separator" },
    {
      label: "Previous",
      enabled: state.hasTrack,
      click: () => deps.send("prev"),
    },
    {
      label: state.playing ? "Pause" : "Play",
      enabled: state.hasTrack,
      click: () => deps.send("togglePlay"),
    },
    {
      label: "Next",
      enabled: state.hasTrack,
      click: () => deps.send("next"),
    },
    { type: "separator" },
    { label: "Quit Liner", click: () => deps.quit() },
  ];
}

export class TrayController {
  private tray: Tray | null = null;
  private hasTrack = false;
  private playing = false;
  private appliedKey: string | null = null;

  constructor(private readonly deps: TrayDeps) {}

  create() {
    if (this.tray) return;
    const platform = this.deps.platform ?? process.platform;
    try {
      // the macos menu bar fits a 16pt glyph; windows and linux scale down from 32
      const size = platform === "darwin" ? 16 : 32;
      const icon = nativeImage
        .createFromPath(this.deps.iconPath)
        .resize({ width: size, height: size });
      this.tray = new Tray(icon);
    } catch (err) {
      console.warn("[tray] could not create tray icon:", err);
      return;
    }
    this.tray.setToolTip("Liner");
    // on macos a click opens the context menu, elsewhere it brings the window back
    if (platform !== "darwin") {
      this.tray.on("click", () => this.deps.showWindow());
    }
    this.apply(true);
  }

  update(state: ThumbarPlayerState) {
    this.hasTrack = Boolean(state?.track);
    this.playing = PLAYING_STATUSES.has(state?.status ?? "");
    this.apply(false);
  }

  destroy() {
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy();
    this.tray = null;
    this.appliedKey = null;
  }

  private apply(force: boolean) {
    if (!this.tray || this.tray.isDestroyed()) return;
    const key = this.hasTrack ? (this.playing ? "playing" : "paused") : "none";
    if (!force && key === this.appliedKey) return;
    this.tray.setContextMenu(
      Menu.buildFromTemplate(
        trayMenuTemplate(
          { hasTrack: this.hasTrack, playing: this.playing },
          this.deps,
        ),
      ),
    );
    this.appliedKey = key;
  }
}
