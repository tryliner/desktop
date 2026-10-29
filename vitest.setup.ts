const environment = globalThis as typeof globalThis & {
  jsdom: { window: Pick<Window, "localStorage" | "sessionStorage"> };
};

for (const name of ["localStorage", "sessionStorage"] as const) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: environment.jsdom.window[name],
  });
}
