import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";
import path from "path";
import pkg from "./package.json" with { type: "json" };
import { contentSecurityPolicyPlugin } from "./vite.csp.ts";

export default defineConfig(({ command, mode }) => {
  if (command === "serve") {
    const devEnv = loadEnv(mode, process.cwd(), ["LINER_", "VITE_API_URL"]);
    for (const name of [
      "LINER_DEV_SIGNING_SECRET",
      "LINER_SIMULATE",
      "LINER_SIMULATE_COUNTRY",
      "VITE_API_URL",
    ]) {
      if (devEnv[name] && !process.env[name]) process.env[name] = devEnv[name];
    }
  }

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      tailwindcss(),
      contentSecurityPolicyPlugin(),
      electron({
        main: {
          entry: "electron/main.ts",
        },
        preload: {
          input: "electron/preload.ts",
          vite: {
            build: {
              rollupOptions: {
                output: {
                  format: "cjs",
                  entryFileNames: "preload.cjs",
                },
              },
            },
          },
        },
      }),
    ],
    clearScreen: false,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "next/navigation": path.resolve(
          import.meta.dirname,
          "./src/lib/navigation.tsx",
        ),
        "next/link": path.resolve(
          import.meta.dirname,
          "./src/lib/navigation.tsx",
        ),
        "next/image": path.resolve(
          import.meta.dirname,
          "./src/components/ui/AppImage.tsx",
        ),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 2048,
    },
  };
});
