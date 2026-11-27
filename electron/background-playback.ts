import { Menu, Tray, nativeImage } from "electron";

// Music keeps playing after the main window is closed, as long as it was
// playing at the moment of closing. The window is hidden instead of destroyed
// (the renderer, and with it the audio element, stays alive) and a tray icon
// offers "Show" and "Quit".

export type PlaybackStatus = string | undefined;

export function shouldKeepPlayingInBackground(
  status: PlaybackStatus,
  quitting: boolean,
): boolean {
  if (quitting) return false;
  return status === "playing" || status === "buffering";
}

export interface BackgroundTrayOptions {
  iconPath: string;
  onShow: () => void;
  onQuit: () => void;
}

export class BackgroundTray {
  private tray: Tray | null = null;

  constructor(private readonly options: BackgroundTrayOptions) {}

  get isShown(): boolean {
    return this.tray !== null;
  }

  show(): void {
    if (this.tray) return;
    const icon = nativeImage
      .createFromPath(this.options.iconPath)
      .resize({ width: 16, height: 16 });
    const tray = new Tray(icon);
    tray.setToolTip("Liner");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show Liner", click: () => this.options.onShow() },
        { type: "separator" },
        { label: "Quit Liner", click: () => this.options.onQuit() },
      ]),
    );
    tray.on("click", () => this.options.onShow());
    this.tray = tray;
  }

  hide(): void {
    if (!this.tray) return;
    this.tray.destroy();
    this.tray = null;
  }
}
