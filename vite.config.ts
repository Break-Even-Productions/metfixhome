import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { asteriskGlass } from "./vite/asterisk-glass";

const plugins = [
  asteriskGlass(),
  react(),
  tailwindcss(),
  jsxLocPlugin(),
];

export default defineConfig({
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
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "../shared/**/*.test.ts",
      "../worker/**/*.test.ts",
      "../worker/**/*.test.tsx",
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
});
