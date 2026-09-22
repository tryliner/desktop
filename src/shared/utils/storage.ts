const pendingWrites = new Map<string, string>();

function flushPendingWrites() {
  if (typeof localStorage === "undefined" || pendingWrites.size === 0) return;
  for (const [name, value] of pendingWrites.entries()) {
    try {
      localStorage.setItem(name, value);
    } catch {}
  }
  pendingWrites.clear();
}

if (typeof window !== "undefined") {
  setInterval(flushPendingWrites, 1000);

  window.addEventListener("beforeunload", flushPendingWrites);
}

export const debouncedStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    if (pendingWrites.has(name)) {
      return pendingWrites.get(name)!;
    }
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    pendingWrites.set(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    pendingWrites.delete(name);
    localStorage.removeItem(name);
  },
  flush: flushPendingWrites,
};
