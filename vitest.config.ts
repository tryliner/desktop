import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  define: {
    __LINER_CHANNEL__: JSON.stringify("production"),
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "electron/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
