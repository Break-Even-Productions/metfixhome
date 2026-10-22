import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Pool-workers tests (real HTMLRewriter + ASSETS from built dist).
 * Run after `npm run build:cf`: `npm run test:workers`.
 * SessionDO concurrent refresh lives in vitest.workers.session.config.ts
 * (isolatedStorage:false — concurrent stub.fetch leaves sqlite-shm open).
 */
export default defineWorkersConfig({
  test: {
    // V12(b): do not write node_modules/.vite/vitest/*/results.json during test:workers.
    cache: false,
    // V12(b): pool defaults ssr optimizer on; that still writes node_modules/.vite/vitest/deps*
    // even when cache is false (Vitest resolves cacheDir to that path for the optimizer).
    deps: {
      optimizer: {
        ssr: { enabled: false },
        web: { enabled: false },
      },
    },
    include: ["worker/**/*.workers.test.ts"],
    exclude: ["worker/do/session.refresh.workers.test.ts"],
    poolOptions: {
      workers: {
        // CI / npm run test:workers must stay fully local. wrangler.jsonc may
        // set AUTH_SESSIONS.remote:true for wrangler dev; that must not pull
        // a Cloudflare remote-proxy login into the vitest pool.
        remoteBindings: false,
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            BSI_POSTS_API_KEY: "test-posts-key",
            DAILY_FIX_API_KEY: "k_QA_SENT_KEY",
            BSI_OAUTH_CLIENT_ID: "cid_QA_SENT_CLIENT",
            METFIX_ORG_OAUTH_CLIENT_SECRET: "secret_QA_CANARY",
            // 32-byte key, base64url (SessionDO AES-GCM).
            SESSION_ENC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        },
      },
    },
  },
});
