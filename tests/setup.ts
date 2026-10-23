class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const memoryStorage = new MemoryStorage();

try {
  if (typeof window !== "undefined") {
    if (!window.localStorage || typeof window.localStorage.setItem !== "function") {
      Object.defineProperty(window, "localStorage", {
        value: memoryStorage,
        writable: true,
        configurable: true,
      });
    }
  }

  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage || typeof globalThis.localStorage.setItem !== "function") {
    Object.defineProperty(globalThis, "localStorage", {
      value: (typeof window !== "undefined" && window.localStorage) || memoryStorage,
      writable: true,
      configurable: true,
    });
  }
} catch {
  // ignore
}
