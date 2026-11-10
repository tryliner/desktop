import { defineConfig } from "vitest/config";
import path from "path";
import icons from "unplugin-icons/vite";

export default defineConfig({
  plugins: [icons({ compiler: "jsx", jsx: "react" })],
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
