import { useEffect } from "react";
import { showToast } from "@/shared/ui";
import { useLocalLibraryStore } from "../store/localLibraryStore";

// "Open with Liner" / file association handoff from the main process.
export function useLocalFileOpen() {
  useEffect(() => {
    const bridge = window.linerElectron;
    if (!bridge?.onLocalTracksOpen) return;
    return bridge.onLocalTracksOpen((paths) => {
      if (paths.length === 0) return;
      void useLocalLibraryStore
        .getState()
        .importPaths(paths)
        .then((result) => {
          if (!result) return;
          if (result.added.length > 0) {
            showToast(
              `Imported ${result.added.length} local ${
                result.added.length === 1 ? "track" : "tracks"
              }`,
              "checkmark",
            );
          } else if (result.failed.length > 0) {
            showToast("Could not import the selected file", "error");
          }
        });
    });
  }, []);
}
