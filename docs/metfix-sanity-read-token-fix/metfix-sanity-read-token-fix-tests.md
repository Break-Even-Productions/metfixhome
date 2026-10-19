# metfix.org: Sanity read-token removal — QA test list (rev 1.1, round 1)
- Rev 1.1, 2026-10-19 ~4:10 PM PT. Rev 1.0 (`19ce522c3bff732296417508a504cae1`) kept at `metfix-sanity-read-token-fix-tests.r1.md`. Rev 1.0 items below are unchanged in wording/strength, except where the spec's G rulings supersede them (marked). New items: §V (vite.config guard), K3.8–K3.10, K4.6, K6.5, K7, and the round-1 results table (§R).
- Spec: `metfix-sanity-read-token-fix-acceptance.md` rev 1.1, md5 `c2e48ca44109637684e062a03bf76077` (verified 2026-10-19). Rev 1.0 was `5e21d58c`. 1.0 → 1.1: K1 exception list; R4 scope = `dist/public` text assets, value regex primary; K4.1 void; K2 via `sanityClient.config()`; `useCdn:true`; apiVersion `2025-01-01` pinned (G7); R1 mandatory and merge-blocking; K7 added; QA gap rulings G1–G7.
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
- K3.1 (shape superseded by spec G3: scope is `dist/public` `*.js,*.html,*.css,*.map`; order and both patterns still required) Step exists after `build:cf` and before deploy dry-run, and greps ALL of `dist/` (incl. `*.map`, `.js`, `.html`, `.json`, `_worker`/worker bundle) for BOTH the name and the value pattern. Expected shape:
  `! grep -rIlE --include='*' 'VITE_SANITY_API_READ_TOKEN|\bsk[A-Za-z0-9]{40,}\b' dist/` (no `--exclude=*.map`, no path narrower than `dist/`). Assert by reading ci.yml + `yq` step order. M: narrow to `dist/public/assets/*.js` → K3.4 fails; add `--exclude='*.map'` → K3.4 fails.
- K3.2 Positive mutation (fails WITH token), one-time, local, not committed. Note G2: on the fixed code the env var is no longer read, so a dummy env alone proves nothing about the grep. Run both:
  - (a) Gate catches a leak: on the PR head, temporarily restore `token: import.meta.env.VITE_SANITY_API_READ_TOKEN` in sanity.ts, `VITE_SANITY_API_READ_TOKEN="$DUMMY" npm run build:cf`, run the exact ci.yml step command (extracted with `yq`, not retyped) → exit ≠ 0 and the file list names the bundle. Record exit code + matched file names (not the value).
  - (b) Gate catches the name: `echo 'x="VITE_SANITY_API_READ_TOKEN"' >> dist/public/assets/probe.js` → step fails.
- K3.3 Negative (passes WITHOUT token): clean PR head, `VITE_SANITY_API_READ_TOKEN="$DUMMY" npm run build:cf` (env set, code fixed) → step exits 0 and `grep -rIc "$DUMMY" dist/` is 0 everywhere. Proves the fix, not just the gate.
- K3.4 Sourcemaps: build with `--sourcemap` (or confirm config emits maps: `find dist -name '*.map' | wc -l` recorded). Inject `DUMMY` only into a `.map` file (`sed -i "s/\"sources\"/\"x\":\"$DUMMY\",\"sources\"/" $(find dist -name '*.map' | head -1)`) → step fails. If build emits no maps, record 0 and still run injection on a created `dist/public/assets/probe.js.map`.
- K3.5 CI green on the PR head; record run id and step log line count of matches (0). M: none beyond K3.2 (CI run is the artifact).
- K3.6 False-positive check: on clean head, step output empty; if `\bsk[A-Za-z0-9]{40,}\b` matches any minified identifier, record it and escalate (do NOT weaken PAT).
- K3.7 (void per spec G3) Gate also runs on `dist/` produced by `wrangler deploy --dry-run --outdir` if that writes outside dist (record path); grep covers it. M: inject DUMMY in that outdir → fails.

## K4 — reads work tokenless (R5, R6)
- K4.1 (void per spec CQ3: no existing mounted content tests) Mounted tests (U2, existing home/affiliate/courses/testimonials/FAQ/siteSettings) pass unchanged; `git diff 9f7129d7 -- 'client/src/**/*.test.tsx'` shows no assertion removed/loosened (reviewed line by line). M: break a GROQ projection field → the relevant mounted test FAILS (proves they still bite).
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

- K6.5 (CQ) `vite.config.ts` is not in the rev 1.1 K6 allowlist. The required §V guard lives there, so Spec must ship a doc-only rev adding `vite.config.ts` to K6 with its md5 pinned **before** the fix lands. Status: BLOCKER until that rev exists.

## K3 additions (rev 1.1)
- K3.8 (Web Lead ruling b, R4) Build-time env guard: the build FAILS when `VITE_SANITY_API_READ_TOKEN` is non-empty, PASSES when it is empty or unset, and it cannot be skipped: it runs before/inside the build in the same CI job as build and deploy dry-run, with no `if:`/`continue-on-error`. Proven by §V. Reason (found in round 1): `client/src/const.ts:29` references the whole `import.meta.env` object, so Vite inlines **every** `VITE_*` var, token included, into the main chunk even though `sanity.ts` no longer reads it. The dist scan alone only catches it after the fact.
- K3.9 (CQ) Workers Builds (Cloudflare's production build; build command is set in the dashboard, not the repo) runs neither the ci.yml dist scan nor any guard. Covered only via §V (the config runs there too); covering the scan itself in Workers Builds needs Web Lead's Rule 6 ruling. Status: OPEN.
- K3.10 (CQ, R4 bullet 3) Legacy (non-`sk`) token pattern: if R1 shows the revoked token was non-`sk`, a matching pattern (never the value) is added and proven with a dummy of that shape. Status: PENDING on R1.

## K4 additions (rev 1.1)
- K4.6 (CQ) Fetch test must not contain vacuous or duplicate assertions:
  - The XHR stub in `sanity.fetch.test.ts` (lines 32–44 at 45fdc15a) never installs under vitest `environment: "node"` (`typeof XMLHttpRequest === "undefined"`), so `expect(xhrCounts.open).toBe(0)` (line 90) is always true. Delete it, or replace it with an assertion that can fail. M: n/a; the item fails as long as the line is present.
  - Duplicates: fetch lines 99–100 (`not.toBe("drafts")`/`not.toBe("raw")` after `toBe("published")`) and config line 16 (`"token" in cfg && cfg.token` after `toBeUndefined()`). Remove them or justify each one; keeping them weakens nothing, but they don't count as evidence.
  - Authorization mutation (`token:"x"` in `createClient`) must fail the fetch test **on the Authorization assertion** (line 104), not only on the config test. Verified in round 1.
  - `withCredentials:true` mutation currently fails only on the host assertion (the client drops the CDN), not on `options.withCredentials`. The credentials assertion has no proof that it bites. Replace it with one that fails on its own, or record it as host-covered.

## §V — vite.config.ts token guard (Web Lead ruling, CQ addendum). All FAIL at 45fdc15a (not present)
Shell line in ci.yml stays as the second check.
- V1 `vite.config.ts` throws when `VITE_SANITY_API_READ_TOKEN` is non-empty in `process.env`. M: remove the throw → the test FAILS.
- V2 It also throws when the var is set **only** in a `.env` file: the test writes a temp `.env` in the root Vite actually uses (the config's `root`/`envDir`, read from the config, not assumed) and runs the real config through `loadEnv`. M: guard reads `process.env` only → V2 FAILS.
- V3 A whitespace-only value (`"   "`) counts as non-empty and throws. M: `.trim()` before the check → FAILS.
- V4 The error message contains `VITE_SANITY_API_READ_TOKEN` and never the value: assert that the dummy is absent from the error message and from captured stdout/stderr. M: interpolate the value into the message → FAILS.
- V5 It throws for both `command:"serve"` and `command:"build"`. M: guard only on build → the serve case FAILS.
- V6 The test calls the real exported default config function (or real `loadEnv` + config). No helper exported just for the test (rule 4). M: add `export function __checkToken` → K6.3-style grep FAILS.
- V7 Unset or empty `""` → no throw, and `npm run build:cf` exits 0. M: throw on defined-but-empty → FAILS.
- V8 (reasoning, no direct test) Workers Builds runs `vite build` with this config, so V1–V3 cover it. Record the build command from the Cloudflare dashboard as evidence (Ethan/Web Lead).
- V9 BLOCKER: K6.5 spec doc-only rev must be pinned before V1–V7 land.

## K7
- K7.1 `worker/build.config.test.ts` (reads ci.yml) passes unchanged on the PR head. Present at base and head; re-run after the #7 rebase too.

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

## §R Round-1 results at 45fdc15a (QA ran all of these on a local clone; raw output in the round-1 notes)
Legend: PASS / FAIL / BLOCKED / PENDING. Owner: QA = this list, CQ = Code Quality, both = deduped.
| Item | Owner | Status | Evidence |
|---|---|---|---|
| CI | QA | PASS | Run 39337522815 at head_sha 45fdc15a…, job test-and-build success. Log: `Tests 305 passed (305)`, workers `Tests 8 passed (8)` |
| Deltas | QA | — | main 9f7129d: 302 unit locally. +3 = config ×2, fetch ×1. Workers 8 = main's 8. #7 (01f4a8f) adds `it("social-preview.jpg from ASSETS is image/jpeg")`, giving 9. Nothing was removed; #10 isn't rebased on #7 |
| K1.1/K1.5 | QA | BLOCKED on #7 | The only out-of-list hit is `.github/workflows/deploy-pages.yml:40`. pr7 deletes that file. Other hits: ci.yml:47 (guard) and sanity.config.test.ts:33, both allowed. Re-run after rebase |
| K1.2 | QA | PASS | vite-env.d.ts line removed |
| K1.3 | QA | PASS | ci.yml parses (node yaml). The Build env keys are GITHUB_REPOSITORY, VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET |
| K1.4 | QA | PASS | No .env* tracked. `.dev.vars.example` = `DAILY_FIX_API_KEY=` only |
| K2.1/K2.2/K2.3 | QA | PASS | Mutations token:"x", useCdn:false, "raw", no perspective, projectId, dataset: all FAIL. Restoring the env read fails the K2.2 test. The stale comment is gone |
| K3.1 | QA | PASS | Step order: Build → No Sanity token in dist → B2 → … → dry-run. Both patterns, G3 scope |
| K3.2(a) | QA | PASS | Token read restored + dummy build → guard exit 1, names index-*.js |
| K3.2(b)/K3.4 | QA | PASS | Name in probe.js, dummy in created probe.js.map and probe.html → exit 1 each. 0 maps emitted (verified; PR's claim holds) |
| K3.3 | QA | **FAIL** | Clean head built with the dummy env → guard exit 1. The dummy is inlined in `index-*.js` as `{BASE_URL:"/",…,VITE_SANITY_API_READ_TOKEN:"<dummy>",…}`, via `client/src/const.ts:29` (`import.meta.env &&`). The PR's local K3(c) "passes, 0 matches" is false |
| K3.5 | QA | PASS | Guard step green in CI (env unset) |
| K3.6 | QA | PASS | No false positive on the clean build |
| K3.8 / §V V1–V7 | both | FAIL | Guard not present |
| K3.9 | CQ | OPEN | Workers Builds gap; needs a Rule 6 ruling |
| K3.10 | CQ | PENDING | R1 |
| K4.2 | QA | PASS | Transport is node https (fetch spy not called). Host apicdn, perspective=published, no auth. Auth mutation fails at line 104 |
| K4.3 | QA | BLOCKED | No preview deployment on 45fdc15a (the only check run is test-and-build). No HAR possible |
| K4.4 | QA | PASS (build part) | worker/ sanity refs 0 at base and head. HAR part blocked with K4.3 |
| K4.5 | QA | PENDING | Post-deploy observation; nothing deployed from #10 |
| K4.6 | CQ | FAIL | Vacuous XHR assertion; duplicates; withCredentials unproven |
| K5.1–K5.3 | Ethan | PENDING | Not a pass. Merge blocked |
| K6.1/K6.3/K6.4 | QA | PASS | 7 paths, all allowed. No hook lines |
| K6.2 | QA | PASS | Only hit is this list's own text in docs/ |
| K6.5 / V9 | CQ | BLOCKER | Spec rev for vite.config.ts |
| K7.1 | QA | PASS | `worker/build.config.test.ts` passed in the local 305/305 run at head; file unchanged by #10 |
