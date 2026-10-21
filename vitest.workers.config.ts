import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Pool-workers tests (real HTMLRewriter + ASSETS from built dist).
 * Run after `npm run build:cf`: `npm run test:workers`.
 * SessionDO concurrent refresh lives in vitest.workers.session.config.ts
 * (isolatedStorage:false — concurrent stub.fetch leaves sqlite-shm open).
 */
export default defineWorkersConfig({
  test: {
    include: ["worker/**/*.workers.test.ts"],
    exclude: ["worker/do/session.refresh.workers.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            DAILY_FIX_API_KEY: "k_QA_SENT_KEY",
            BSI_OAUTH_CLIENT_ID: "cid_QA_SENT_CLIENT",
            // 32-byte key, base64url (SessionDO AES-GCM).
            SESSION_ENC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        },
      },
    },
  },
});
