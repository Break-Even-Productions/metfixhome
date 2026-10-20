import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { asteriskGlass } from "./vite/asterisk-glass";

const plugins = [
  asteriskGlass(),
  react(),
  tailwindcss(),
  jsxLocPlugin(),
];

export default defineConfig(({ mode }) => {
  // R4b: refuse a client Sanity read token on serve and build. Always on.
  const envDir = path.resolve(import.meta.dirname);
  const env = { ...loadEnv(mode, envDir, ""), ...process.env };
  const sanityReadToken = String(env.VITE_SANITY_API_READ_TOKEN ?? "").trim();
  if (sanityReadToken) {
    throw new Error(
      "VITE_SANITY_API_READ_TOKEN must not be set; the browser client reads Sanity over the public CDN without a token.",
    );
  }

  return {
    base: "/",
    plugins,
    optimizeDeps: {
      exclude: ["@ybouane/liquidglass"],
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir,
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    test: {
      // V12(b): do not write node_modules/.vite/vitest/results.json during npm test.
      cache: false,
      environment: "node",
      include: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "../shared/**/*.test.ts",
        "../worker/**/*.test.ts",
        "../tools/pr2/gates/**/*.test.ts",
      ],
      exclude: ["../worker/**/*.workers.test.ts", "**/node_modules/**"],
    },
    server: {
      port: 3000,
      strictPort: false, // Will find next available port if 3000 is busy
      host: true,
      allowedHosts: ["localhost", "127.0.0.1"],
      proxy: {
        "/api": {
          target: process.env.DAILY_FIX_API_PROXY || "http://localhost:8787",
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
