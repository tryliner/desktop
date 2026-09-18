import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUpdaterStore } from "./updaterStore";

describe("updaterStore", () => {
  beforeEach(() => {
    useUpdaterStore.getState().reset();
    vi.restoreAllMocks();
  });

  it("handles check for updates when update is available", async () => {
    window.linerElectron = {
      checkForUpdates: vi.fn().mockResolvedValue({
        available: true,
        version: "0.1.28",
        releaseNotes: "New features and bug fixes",
      }),
    } as any;

    await useUpdaterStore.getState().checkForUpdates();

    const state = useUpdaterStore.getState();
    expect(state.status).toBe("available");
    expect(state.isDialogOpen).toBe(true);
    expect(state.updateInfo?.version).toBe("0.1.28");
    expect(state.updateInfo?.releaseNotes).toBe("New features and bug fixes");
  });

  it("handles skipping an update", async () => {
    window.linerElectron = {
      checkForUpdates: vi.fn().mockResolvedValue({
        available: true,
        version: "0.1.28",
      }),
    } as any;

    await useUpdaterStore.getState().checkForUpdates();
    expect(useUpdaterStore.getState().isDialogOpen).toBe(true);

    useUpdaterStore.getState().skipUpdate();
    expect(useUpdaterStore.getState().isDialogOpen).toBe(false);
    expect(useUpdaterStore.getState().dismissedVersion).toBe("0.1.28");

    // checking again shouldn't pop open the dialog if already dismissed
    await useUpdaterStore.getState().checkForUpdates();
    expect(useUpdaterStore.getState().isDialogOpen).toBe(false);
  });

  it("initiates download and tracks status transitions", async () => {
    const downloadMock = vi.fn().mockResolvedValue({ success: true });
    window.linerElectron = {
      downloadUpdate: downloadMock,
    } as any;

    useUpdaterStore.setState({
      status: "available",
      isDialogOpen: true,
      updateInfo: { version: "0.1.28" },
    });

    await useUpdaterStore.getState().startDownload();

    expect(downloadMock).toHaveBeenCalledTimes(1);
    const state = useUpdaterStore.getState();
    expect(state.status).toBe("downloading");
    expect(state.isDialogOpen).toBe(false);
  });

  it("triggers quit and install action", async () => {
    const installMock = vi.fn().mockResolvedValue(true);
    window.linerElectron = {
      quitAndInstall: installMock,
    } as any;

    useUpdaterStore.setState({
      status: "downloaded",
      updateInfo: { version: "0.1.28" },
    });

    await useUpdaterStore.getState().installUpdate();
    expect(installMock).toHaveBeenCalledTimes(1);
  });

  it("triggers simulated test update", () => {
    useUpdaterStore.getState().triggerTestUpdate();

    const state = useUpdaterStore.getState();
    expect(state.isTestMode).toBe(true);
    expect(state.status).toBe("available");
    expect(state.isDialogOpen).toBe(true);
    expect(state.updateInfo?.version).toBe("9.9.9-test");
  });
});
