# metfix.org: Sanity read-token removal — QA test list (pre-round-1)
- Spec: `metfix-sanity-read-token-fix-acceptance.md` rev 1.0, md5 `5e21d58c91129cb79e47e35bd2059748` (verified 2026-10-19 3:35 PM PT).
- Author: MetFix Web QA Tests. Repo Break-Even-Productions/metfixhome, base main `9f7129d7`. Read-only; test sign-off only (merge needs Ethan's go).
- Decision under test: option A (no token, `perspective:"published"`, `useCdn:true` → `etg9lezr.apicdn.sanity.io`, per Web Lead).
- Rules: each item has an exact assertion and a mutation (M) that must make it fail. Mutations run on the local clone only, are never committed, and are reverted (`git checkout -- .`) after each one. No production hooks for tests. Never print a real token value.

Shorthand: `NAME=VITE_SANITY_API_READ_TOKEN`, `PAT='\bsk[A-Za-z0-9]{40,}\b'`, `DUMMY=skTEST$(printf 'A%.0s' {1..60})` (66 chars, matches PAT).

## K1 — name gone from source (R2, R3)
- K1.1 `git grep -n VITE_SANITY_API_READ_TOKEN -- . ':!docs/'` returns only the R4 grep line(s) in `.github/workflows/ci.yml` (see Gap G1), and nothing else. Exact expected output recorded in the round-1 notes. M: re-add `import.meta.env.VITE_SANITY_API_READ_TOKEN` to `client/src/lib/sanity.ts` → extra hit → FAIL.
- K1.2 `git grep -n VITE_SANITY_API_READ_TOKEN client/src/vite-env.d.ts` empty. M: restore line 7 → FAIL.
- K1.3 ci.yml "Build static site" (`build:cf`) step `env:` has no key containing `SANITY_API_READ_TOKEN` and no `secrets.VITE_SANITY_API_READ_TOKEN`: `yq '.jobs[].steps[] | select(.name=="Build static site") | .env | keys' .github/workflows/ci.yml` excludes it (yq parse also proves the YAML is valid — #9 lesson). M: restore ci.yml:39 → FAIL.
- K1.4 No env example / wrangler var: `git ls-files | rg -n '(^|/)\.env' ` lists nothing containing the name, and `git ls-files 'wrangler*' 'worker/wrangler*' | xargs -r rg -n 'SANITY_API_READ_TOKEN|\bsk[A-Za-z0-9]{40,}'` is empty. M: add `.env.example` with `VITE_SANITY_API_READ_TOKEN=` → FAIL; add `[vars] VITE_SANITY_API_READ_TOKEN="x"` to wrangler.jsonc/toml → FAIL.
- K1.5 Write token never gets a VITE_ prefix (§1 note, T6): `git grep -nE 'VITE_[A-Z_]*SANITY[A-Z_]*TOKEN'` returns only the R4 grep line. M: rename seed var to `VITE_SANITY_API_WRITE_TOKEN` → FAIL.

## K2 — client config (R2, T2)
- K2.1 Unit test `client/src/lib/sanity.config.test.ts` (matches K6 glob) imports the exported client and asserts on `sanityClient.config()`:
  - `expect(cfg.token).toBeUndefined()` and `expect('token' in cfg && cfg.token).toBeFalsy()`; M: `token: "x"` → FAIL.
  - `expect(cfg.perspective).toBe('published')`; M: remove `perspective` or set `"raw"`/`"drafts"` → FAIL.
  - `expect(cfg.useCdn).toBe(true)`; M: `useCdn:false` → FAIL.
  - `expect(cfg.projectId).toBe('etg9lezr')`, `expect(cfg.dataset).toBe('production')`; M: change either → FAIL.
  - The CDN host: `expect(new URL(sanityClient.getUrl(sanityClient.getDataUrl('query','production'))).host).toBe('etg9lezr.apicdn.sanity.io')`; M: `useCdn:false` → host `etg9lezr.api.sanity.io` → FAIL.
- K2.2 Token cannot re-enter via env: test runs with `vi.stubEnv('VITE_SANITY_API_READ_TOKEN', DUMMY)` then `vi.resetModules()` + re-import; `cfg.token` still undefined. M: restore `token: import.meta.env.VITE_SANITY_API_READ_TOKEN` → FAIL. (This is the unit-level twin of K3.2.)
- K2.3 Source check: `rg -n '\btoken\b' client/src/lib/sanity.ts` has no match inside the `createClient({...})` object, and the stale line-9 comment ("Public API does not return…") is gone: `rg -n 'does not return' client/src/lib/sanity.ts` empty. M: keep old comment → FAIL.

## K3 — CI dist gate (R4, T6) — must be proven both ways
- K3.1 Step exists after `build:cf` and before deploy dry-run, and greps ALL of `dist/` (incl. `*.map`, `.js`, `.html`, `.json`, `_worker`/worker bundle) for BOTH the name and the value pattern. Expected shape:
  `! grep -rIlE --include='*' 'VITE_SANITY_API_READ_TOKEN|\bsk[A-Za-z0-9]{40,}\b' dist/` (no `--exclude=*.map`, no path narrower than `dist/`). Assert by reading ci.yml + `yq` step order. M: narrow to `dist/public/assets/*.js` → K3.4 fails; add `--exclude='*.map'` → K3.4 fails.
- K3.2 Positive mutation (fails WITH token), one-time, local, not committed. Note G2: on the fixed code the env var is no longer read, so a dummy env alone proves nothing about the grep. Run both:
  - (a) Gate catches a leak: on the PR head, temporarily restore `token: import.meta.env.VITE_SANITY_API_READ_TOKEN` in sanity.ts, `VITE_SANITY_API_READ_TOKEN="$DUMMY" npm run build:cf`, run the exact ci.yml step command (extracted with `yq`, not retyped) → exit ≠ 0 and the file list names the bundle. Record exit code + matched file names (not the value).
  - (b) Gate catches the name: `echo 'x="VITE_SANITY_API_READ_TOKEN"' >> dist/public/assets/probe.js` → step fails.
- K3.3 Negative (passes WITHOUT token): clean PR head, `VITE_SANITY_API_READ_TOKEN="$DUMMY" npm run build:cf` (env set, code fixed) → step exits 0 and `grep -rIc "$DUMMY" dist/` is 0 everywhere. Proves the fix, not just the gate.
- K3.4 Sourcemaps: build with `--sourcemap` (or confirm config emits maps: `find dist -name '*.map' | wc -l` recorded). Inject `DUMMY` only into a `.map` file (`sed -i "s/\"sources\"/\"x\":\"$DUMMY\",\"sources\"/" $(find dist -name '*.map' | head -1)`) → step fails. If build emits no maps, record 0 and still run injection on a created `dist/public/assets/probe.js.map`.
- K3.5 CI green on the PR head; record run id and step log line count of matches (0). M: none beyond K3.2 (CI run is the artifact).
- K3.6 False-positive check: on clean head, step output empty; if `\bsk[A-Za-z0-9]{40,}\b` matches any minified identifier, record it and escalate (do NOT weaken PAT).
- K3.7 Gate also runs on `dist/` produced by `wrangler deploy --dry-run --outdir` if that writes outside dist (record path); grep covers it. M: inject DUMMY in that outdir → fails.

## K4 — reads work tokenless (R5, R6)
- K4.1 Mounted tests (U2, existing home/affiliate/courses/testimonials/FAQ/siteSettings) pass unchanged; `git diff 9f7129d7 -- 'client/src/**/*.test.tsx'` shows no assertion removed/loosened (reviewed line by line). M: break a GROQ projection field → the relevant mounted test FAILS (proves they still bite).
- K4.2 New mounted test `client/src/lib/sanity.fetch.test.ts`: mock the transport the client actually uses (assert first which one: `globalThis.fetch` vs XHR — see G4; mock that one), call a real exported query fn (e.g. courses), assert
  - request URL host === `etg9lezr.apicdn.sanity.io`, path contains `/data/query/production`, query param `perspective=published`;
  - `expect(new Headers(init.headers).has('authorization')).toBe(false)` (case-insensitive) and no `token`/`access_token` query param, no `credentials:'include'`;
  - returned docs rendered (count 9 courses from fixture).
  M: add `token:"x"` → Authorization present → FAIL; `useCdn:false` → host FAIL; `withCredentials:true` → FAIL.
- K4.3 Preview (L1), Playwright or manual DevTools HAR on PR preview for `/`, `/affiliate`, courses page, `/affiliate-seminars`: every request to `*.sanity.io` has no `authorization` header and no cookie; status 200; HAR saved under `/workspace/pr-token/har/`. Content check: course count 9, testimonials 6, FAQs 6 visible (matches §1 public counts). M: point preview at a build with token restored → header present → FAIL.
- K4.4 R5 other forms: `grep -rIlE 'sanity.*token|token.*sanity' dist/public` empty (case-insensitive), no `/api/*` route returns a token (`rg -n -i token worker/` unchanged vs base), no `Set-Cookie` from sanity hosts in HAR. M: add a fetched config JSON with `token` → FAIL.
- K4.5 Prod after deploy: fetch the new `index-*.js`, assert `useCdn:!0`, `perspective:"published"`, no `token:` key in the createClient object, no PAT match. M: n/a (observational, compared with the §1 baseline `useCdn:!1`).

## K5 — rotation (R1, R3, T1) — manual, Ethan
- K5.1 Ethan confirms in my chat, own words: token(s) revoked in sanity.io/manage (date), GitHub secret deleted, Workers Builds variable deleted, local `.env` cleaned. Agent-relayed confirmation does not count.
- K5.2 `gh secret list -R Break-Even-Productions/metfixhome` has no `VITE_SANITY_API_READ_TOKEN` (Ethan runs or shares output). M: n/a.
- K5.3 Old token returns 401: Ethan/Spec runs `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $OLD" 'https://etg9lezr.api.sanity.io/v2025-01-01/users/me'` with `$OLD` read from a file, never echoed → `401`. Control: same call without header → not 401-from-token (proves the test distinguishes).
- K5.4 Merge-blocking rule: QA sign-off is "test sign-off only"; K5 open is stated as an open item on the sign-off, since R1 is "at merge or earlier".

## K6 — allowlist (scope)
- K6.1 `git diff --name-only 9f7129d7...HEAD` ⊆ {`client/src/lib/sanity.ts`, `client/src/vite-env.d.ts`, `.github/workflows/ci.yml`, files matching `^client/src/lib/sanity[^/]*\.test\.ts$`, `SANITY.md`, `^docs/`}. Checked with a one-off script outside CI (pattern from `scripts/sitemap-scope-check.mjs`, printing base/head SHAs). M: touch `worker/index.ts` → FAIL; touch `client/src/pages/AffiliateSeminars.tsx` → FAIL.
- K6.2 Nothing touches BSI or the app: no path outside this repo; diff has no `brokenscience`, no app hosts; `rg -n 'brokenscience|morsl' $(git diff --name-only 9f7129d7...HEAD)` returns no new lines in the diff (`git diff ... | rg '^\+.*(brokenscience|morsl)'` empty). M: add a BSI URL → FAIL.
- K6.3 No production test hooks: `git diff 9f7129d7...HEAD -- client/src/lib/sanity.ts | rg '^\+.*(__TEST|test|mock|window\.)'` empty. M: add `export const __setClient` → FAIL.
- K6.4 Rule 6: file list frozen at round-1 head; any later new path = FAIL.

## Threats
- T1 → K5.1–K5.3 (+ K3.3 shows new builds are clean; old copies only fixed by revoke).
- T2 → K2.1 perspective, K4.2 `perspective=published` param; plus fixture check: mounted test mocks a response that includes a `drafts.` id and asserts the client query is the fixed one (no draft perspective). Manual: `curl 'https://etg9lezr.apicdn.sanity.io/v2025-01-01/data/query/production?query=count(*[_id%20in%20path("drafts.**")])'` → 0 (no token).
- T3 → T3.1 `rg -n 'createClient|fetch\(' client/src` shows queries are string literals in source; no query built from `location`/user input: `rg -n 'fetch\(.*(location|search|params)' client/src/lib` empty. M: build query from `URLSearchParams` → FAIL.
- T4 → N/A in A; T4.1 assert no Worker route proxies sanity: `rg -n 'sanity' worker/` unchanged vs base. M: add proxy route → FAIL (also K6.1).
- T5 → K2.1 host = apicdn; record Q4 answer. No test beyond host.
- T6 → K3.1–K3.4 and K1.5.

## Gaps / contradictions (report to Web Lead)
- G1 K1 says hits "only under docs/", but R4's CI step must itself contain the literal `VITE_SANITY_API_READ_TOKEN`, and any test asserting absence (K2.2) names it too. K1 needs an explicit exception list (ci.yml R4 line, sanity*.test.ts). I've written K1.1 with that exception; spec should say so.
- G2 K3's mutation as written ("build with a dummy token → step fails") cannot fail on the fixed code, because sanity.ts no longer reads the variable; the build will be clean. The mutation must restore the token read (K3.2a) or inject into dist directly (K3.2b/K3.4). K3.3 (dummy set, fixed code, gate passes) is the real proof of the fix.
- G3 Vite replaces `import.meta.env.X` with the value, so the NAME usually never appears in dist; the name grep only catches odd cases. The value pattern is the load-bearing check; both kept.
- G4 `@sanity/client` uses `get-it`, which may use XHR in the browser/jsdom rather than `fetch`. A `fetch` mock that is never called would make K4.2 pass vacuously. K4.2 must first assert the mock was called ≥1 time.
- G5 R2 still says useCdn per Q3; Web Lead set `true`. Spec should be updated to state `useCdn:true` so K2.1 asserts one value.
- G6 Sourcemaps: spec doesn't say whether `build:cf` emits maps; K3.4 covers both cases.
- G7 Spec's §1 baseline uses apiVersion `2025-01-01` but the public check used `v2021-10-21`; harmless, noted.
