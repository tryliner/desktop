import { useAppearanceStore } from "./appearanceStore";
import { addWallpaper, canUseWallpapers } from "./wallpaperGallery";

const CHECKED_KEY = "liner_appearance_legacy_checked";
const LEGACY_DB = "liner_customization_db";
const LEGACY_STORE = "wallpapers";
const LEGACY_KEY = "active_wallpaper";

async function legacyDbExists(): Promise<boolean> {
  if (typeof indexedDB.databases !== "function") return false;
  const all = await indexedDB.databases().catch(() => []);
  return all.some((db) => db.name === LEGACY_DB);
}

function readLegacy(): Promise<unknown> {
  return new Promise((resolve) => {
    const open = indexedDB.open(LEGACY_DB);
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE)) {
        db.close();
        resolve(null);
        return;
      }
      const request = db
        .transaction(LEGACY_STORE, "readonly")
        .objectStore(LEGACY_STORE)
        .get(LEGACY_KEY);
      request.onsuccess = () => {
        db.close();
        resolve(request.result ?? null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

function markChecked() {
  try {
    localStorage.setItem(CHECKED_KEY, "1");
  } catch {}
}

export async function importLegacyWallpaper(): Promise<boolean> {
  try {
    if (localStorage.getItem(CHECKED_KEY)) return false;
  } catch {
    return false;
  }
  if (!canUseWallpapers() || typeof indexedDB === "undefined") return false;
  if (useAppearanceStore.getState().wallpaperKey || !(await legacyDbExists())) {
    markChecked();
    return false;
  }
  const value = await readLegacy();
  if (typeof value !== "string" || !value.startsWith("data:")) {
    markChecked();
    return false;
  }
  try {
    const blob = await (await fetch(value)).blob();
    const wallpaper = await addWallpaper(blob);
    useAppearanceStore
      .getState()
      .set({ wallpaperKey: wallpaper.key, wallpaperKind: wallpaper.kind });
    markChecked();
    return true;
  } catch {
    return false;
  }
}
