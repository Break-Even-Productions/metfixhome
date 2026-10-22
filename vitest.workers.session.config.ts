import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * SessionDO concurrent refresh under real workerd (AU7.6 / CQ r2).
 * isolatedStorage must be false: concurrent stub.fetch leaves sqlite-shm open
 * and the pool cannot pop the DO storage stack frame.
 */
export default defineWorkersConfig({
  test: {
    // V12(b): same cache/optimizer isolation as vitest.workers.config.ts —
    // session suite otherwise writes node_modules/.vite/vitest/* under porcelain.
    cache: false,
    deps: {
      optimizer: {
        ssr: { enabled: false },
        web: { enabled: false },
      },
    },
    include: ["worker/do/session.refresh.workers.test.ts"],
    poolOptions: {
      workers: {
        isolatedStorage: false,
        // Force local Miniflare KV/DO even if wrangler.jsonc has remote:true.
        remoteBindings: false,
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            DAILY_FIX_API_KEY: "k_QA_SENT_KEY",
            BSI_OAUTH_CLIENT_ID: "cid_QA_SENT_CLIENT",
            METFIX_ORG_OAUTH_CLIENT_SECRET: "secret_QA_CANARY",
            SESSION_ENC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        },
      },
    },
  },
});
