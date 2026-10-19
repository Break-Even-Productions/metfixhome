import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Pool-workers tests (real HTMLRewriter + ASSETS from built dist).
 * Run after `npm run build:cf`: `npm run test:workers`.
 */
export default defineWorkersConfig({
  test: {
    include: ["worker/**/*.workers.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            DAILY_FIX_API_KEY: "test-secret-key",
          },
        },
      },
    },
  },
});
