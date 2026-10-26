# snap-preview (windows native add-on)

The drag-to-top "maximize" preview, rendered the way Windows' own snap preview is:
a Windows.UI.Composition visual tree in DWM. The blur is a `HostBackdropBrush`
(DWM's live blur of everything behind the window, Windows 11) and the growing /
collapsing rounded box is a clip driven by compositor animations, so the app does
no per-frame work.

Pure N-API: one build works with any Electron / Node version (no rebuild per
Electron upgrade).

## Build (Windows)

Needs Visual Studio 2022 (or Build Tools) with **Desktop development with C++**
and a Windows 10/11 SDK.

    pnpm native:build

Output: `native/snap-preview/build/Release/snap_preview.node`. If it is missing or
fails to load, the app falls back to a simpler preview (see `electron/snap-native.ts`).
