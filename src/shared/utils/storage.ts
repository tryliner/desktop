// Buffer writes and flush every 3s so rapid setPosition calls don't reset the timer.
let pendingWrite: { name: string; value: string } | null = null;

if (typeof window !== "undefined") {
  setInterval(() => {
    if (pendingWrite) {
      localStorage.setItem(pendingWrite.name, pendingWrite.value);
      pendingWrite = null;
    }
  }, 3000);

  // Flush on page close so the last position isn't lost.
  window.addEventListener("beforeunload", () => {
    if (pendingWrite) {
      localStorage.setItem(pendingWrite.name, pendingWrite.value);
      pendingWrite = null;
    }
  });
}

export const debouncedStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    pendingWrite = { name, value };
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};
