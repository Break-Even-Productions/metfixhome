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

export default defineConfig(() => {
  const envDir = path.resolve(import.meta.dirname);

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
      // ER-1 / T-F-65: classify own vs vendor chunks for hook-scan scope.
      manifest: true,
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
        "../tests/visual/**/*.test.ts",
        "../tests/ci/**/*.test.ts",
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
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const host = req.headers.host;
              if (typeof host === "string" && host.length > 0) {
                proxyReq.setHeader("X-Forwarded-Host", host);
              }
              const encrypted = Boolean(
                req.socket && "encrypted" in req.socket && req.socket.encrypted,
              );
              proxyReq.setHeader("X-Forwarded-Proto", encrypted ? "https" : "http");
            });
          },
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
