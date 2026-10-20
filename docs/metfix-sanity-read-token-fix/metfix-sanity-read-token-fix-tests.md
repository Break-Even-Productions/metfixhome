# metfix.org: Sanity read-token removal — QA test list (rev 1.4, pre-round-3)
- Rev 1.4, 2026-10-19 ~4:30 PM PT. Points at spec **rev 1.1.3, md5 `aefcc701aa7bf6a71d5086d1cf296ccd`** (verified; diff vs 1.1.2: K1 names the K1.6 exceptions; R4b gains the V3 whitespace ruling and requires Vite's `loadEnv` precedence; new K8(d) = QA V2b). Rev 1.3 (`253889edcbbed59df8c5c4a94dddf231`) kept at `metfix-sanity-read-token-fix-tests.r1.3.md`. Changes: V2b rewritten to K8(d) per the Web Lead correction of 10-19 (a blank shell value wins, guard passes, no throw), with mutations so it can fail; K1.7 confirmed against 1.1.3; D1 now targets the rev 1.4 md5. Nothing weakened. The rev 1.3 per-source-throw requirement is dropped by ruling, not loosened, because it contradicted Vite's actual inlining and would have rewarded a wrong fallback.
- (Rev 1.3 history) Rev 1.3, 2026-10-19 ~4:25 PM PT. Rev 1.2 (`2aecd7f702619e2863acf43bba5ed0b6`) kept at `metfix-sanity-read-token-fix-tests.r1.2.md`. Changes: V3 rewritten per the **Web Lead ruling of 10-19** (a whitespace-only value counts as unset and passes, matching spec 1.1.2 R4b/K8(b)); new items K1.7, V2b (required behavior), V11 (temp envDir), V10 (temp outDir) and D1 (docs copy). No assertion weakened: V3 keeps the throw on padded real tokens and adds dist and source checks.
- (Rev 1.2 history) Rev 1.2, 2026-10-19 ~4:25 PM PT, round 2 at `0d362f6f`. Rev 1.1 (`3c4341554e8e2e12066bfcd41aa9e623`) kept at `metfix-sanity-read-token-fix-tests.r1.1.md`. Spec now rev 1.1.2, md5 `9f0f405441f6e83c3a407e40b955da3c`. 1.1 → 1.1.2 adds R4a/R4b, R7 (no bare `import.meta.env` in `client/src`), K8, T7, and K6 entries for `vite.config.ts` and `client/src/const.ts`; it also restates K3(c), moves K4.3 to `wrangler dev --local`, makes K4.5 post-deploy only, and allows no bypass switch. No rev 1.1 assertion is weakened here; §V V3 is flagged below. Rev 1.2 adds K1.6, V2b, V10, V11, K8.1 and §R2.
- (Rev 1.1 history) Rev 1.1, 2026-10-19 ~4:10 PM PT. Rev 1.0 (`19ce522c3bff732296417508a504cae1`) kept at `metfix-sanity-read-token-fix-tests.r1.md`. Rev 1.0 items below are unchanged in wording/strength, except where the spec's G rulings supersede them (marked). New items: §V (vite.config guard), K3.8–K3.10, K4.6, K6.5, K7, and the round-1 results table (§R).
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
- V3 (Web Lead ruling, 10-19: whitespace-only = unset, passes; matches spec 1.1.2 R4b/K8(b). Replaces the rev 1.0–1.2 wording "whitespace-only throws".) Must assert all of:
  - (a) Each whitespace-only value, `' '`, `'\t'` and `'\n'`, in `process.env` does not throw for `serve` or `build`, and `npm run build:cf` exits 0 with that value set.
  - (b) After the (a) build: `dist/public` has 0 occurrences of that value as the token. The inlined `VITE_SANITY_API_READ_TOKEN` is absent, or only as `VITE_SANITY_API_READ_TOKEN:""`. Assert with a regex on `VITE_SANITY_API_READ_TOKEN:"[^"]` → 0 matches; it must not match `:" "`, `:"\t"` or `:"\n"` (escaped forms included).
  - (c) A real dummy padded with spaces and newlines (`'  sk…  '`, `'\nsk…\n'`) STILL throws, separately from `process.env` and from `.env` (V11 temp envDir). The error message, stdout and stderr never contain the dummy or its trimmed form.
  - M(c): treat any trimmed non-empty value as unset (e.g. `if (false && sanityReadToken)`, or skip values with leading/trailing whitespace) → (c) FAILS.
  - M(a): remove `.trim()` → (a) FAILS (whitespace becomes non-empty and throws).
  - M(b): with R4b removed in scratch and `const.ts` reverted, set `' '` → the (b) regex must match (proves (b) can fail).

- V4 The error message contains `VITE_SANITY_API_READ_TOKEN` and never the value: assert that the dummy is absent from the error message and from captured stdout/stderr. M: interpolate the value into the message → FAILS.
- V5 It throws for both `command:"serve"` and `command:"build"`. M: guard only on build → the serve case FAILS.
- V6 The test calls the real exported default config function (or real `loadEnv` + config). No helper exported just for the test (rule 4). M: add `export function __checkToken` → K6.3-style grep FAILS.
- V7 Unset or empty `""` → no throw, and `npm run build:cf` exits 0. M: throw on defined-but-empty → FAILS.
- V8 (reasoning, no direct test) Workers Builds runs `vite build` with this config, so V1–V3 cover it. Record the build command from the Cloudflare dashboard as evidence (Ethan/Web Lead).
- V9 BLOCKER: K6.5 spec doc-only rev must be pinned before V1–V7 land.

- V2b = spec 1.1.3 **K8(d)** (Web Lead correction, 10-19: no throw expected). Setup: dummy in `.env` (V11 temp envDir) and `VITE_SANITY_API_READ_TOKEN=` (present, blank) in the shell. The guard must decide on exactly what Vite inlines, i.e. the `loadEnv` result, where a key present in `process.env` overrides `.env` even when it's empty. Assert:
  - (a) The config resolves for `serve` and `build`, `build:cf` exits 0, and `dist/public` has 0 dummy matches (`grep -rIl` count 0, value never printed). Also required: the (b) regex from V3 shows `VITE_SANITY_API_READ_TOKEN` absent or only `:""`. A `.env` value inlined = FAIL (K8(d)).
  - (b) The guard tracks Vite's precedence. Two mutations, each recorded:
    - M1, `process.env` only (guard ignores `.env`): the V2 `.env`-only case (shell unset) must FAIL. Round 2 recorded this: the "process.env only" mutation failed V2.
    - M2, fallback `process.env.X || fileValue` (or `?? ` on a trimmed empty): V2b must FAIL because the guard throws while Vite inlines `""`.
  - (c) The opposite case, cross-reference V2: shell **unset** plus dummy in `.env` → throws (serve and build), and the message never shows the value.
  - The rev 1.3 "throw on each source separately" requirement is removed per the ruling.

- V10 (rev 1.3) V7's `build:cf` builds into a temp outDir (e.g. `vite build --outDir <tmp> --emptyOutDir`) and leaves `dist/public` untouched. Assert by recording, before and after the V7 test, a recursive listing with mtimes and the md5 of every file in `dist/public` (or that it is still absent): they must be identical. Clean up the temp outDir. M: drop `--outDir` → the snapshot differs → FAIL. Rationale (round 2): `emptyOutDir` on the shared dist can clobber a running `wrangler dev`/`test:workers`.

- V11 (rev 1.3) V2, V2b and V3(c) use a temp envDir and never touch `<repo>/.env`. With no test hook (rule 4), copy the real `vite.config.ts` into a temp dir and import it from there, so its envDir is the temp dir. Assert:
  - the `<repo>/.env` mtime and md5 are unchanged before and after the suite (or it is still absent), with a sentinel `.env` present during the run;
  - **kill case:** run the V2 test in a child process, send SIGKILL after the temp `.env` is written (a test-only wait via env or file is allowed in the test, not in production code), then assert `<repo>/.env` still has the same mtime and md5 and contains no dummy.
  M: write `<repo>/.env` (the round-2 approach) → the mtime/md5 check FAILS, and the kill case leaves the dummy → FAIL.

- K1.6 (CQ round 2) K1 greps must include dotfiles: `rg -n --hidden VITE_SANITY_API_READ_TOKEN -g '!docs/**' -g '!node_modules/**' -g '!dist/**' -g '!.git/**' .` (plain rg skips `.github`). Exact expected hits after #7: `vite.config.ts:212,215`, `.github/workflows/ci.yml:47`, `client/src/lib/sanity.vite-guard.test.ts:7`, `client/src/lib/sanity.config.test.ts:32`. Spec gap: the K1 exception list in 1.1.2 does not yet name `vite.config.ts` (R4b) or `sanity.vite-guard.test.ts`. Spec must add them by name. M: re-add the token read to `sanity.ts` → extra hit → FAIL.
- K8.1 R7: `rg -nP 'import\.meta\.env(?!\.[A-Za-z_])' client/src` returns 0 hits. Scratch proof: remove R4b, build with the dummy set → 0 dummy files in `dist/public`. With R4b removed and `const.ts` reverted to main → 1 dummy file and R4a exits 1, which proves the check catches a regression.

- K1.7 Spec 1.1.3 K1 names `vite.config.ts:212`, `vite.config.ts:215` and `client/src/lib/sanity.vite-guard.test.ts:7` (md5 `aefcc701…` verified). Confirmed at `0d362f6f` with `rg -n --hidden VITE_SANITY_API_READ_TOKEN -g '!docs/**' -g '!node_modules/**' -g '!dist/**' -g '!.git/**' .`. Exactly 6 hits, no drift:
  - `vite.config.ts:212` and `:215` (named);
  - `client/src/lib/sanity.vite-guard.test.ts:7` (named);
  - `client/src/lib/sanity.config.test.ts:32` (category: config test);
  - `.github/workflows/ci.yml:47` (category: R4 step);
  - `.github/workflows/deploy-pages.yml:40` (not allowed; BLOCKED on #7, must be 0 after the rebase).
  Any line shift or extra hit on a later head = FAIL until Spec re-pins it. Status: PASS for the named exceptions; the K1 overall stays BLOCKED on #7.

- D1 (round 3; target is rev 1.4 md5 and spec 1.1.3 `aefcc701…`) The PR's `docs/metfix-sanity-read-token-fix/metfix-sanity-read-token-fix-tests.md` md5 equals this list's current rev md5. The acceptance copy equals the current spec rev md5. M: any byte difference → FAIL.

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

## §R2 Round-2 results at 0d362f6f — SUPERSEDED by §R3 (kept as the record; V3 'CONFLICT' was resolved by the Web Lead ruling of 10-19) (QA ran every item on a local clone; scratch worktree for the R4b removal, never committed)
| Item | Owner | Status | Evidence |
|---|---|---|---|
| CI | QA | PASS | Run 39339532106, head_sha 0d362f6f…, success. Log: `Tests 312 passed (312)`, `sanity.vite-guard.test.ts (7 tests)`, workers `Tests 8 passed (8)`, "No Sanity token in dist" step success. Local run: 312/312, 16 files |
| 305→312 | QA | — | +7 = the new `sanity.vite-guard.test.ts` V1–V7. config 2 and fetch 1 are unchanged in count |
| Docs copies | QA | PASS (stale) | PR `docs/` acceptance = 9f0f4054 (= 1.1.2), tests = 3c434155 (= rev 1.1). Rev 1.2 supersedes the tests copy, so the PR must update it to the rev 1.2 md5 |
| K1.1/K1.5 | QA | BLOCKED on #7 | `rg --hidden`: the only non-allowed hit is `deploy-pages.yml:40` |
| K1.6 | both | FAIL (spec doc) | `vite.config.ts` and `sanity.vite-guard.test.ts` hits are not in the spec's K1 exception list |
| K1.2–K1.4, K2.*, K6.1–K6.4, K7.1 | QA | PASS | Unchanged from round 1. K6: the 2 new paths (`vite.config.ts`, `const.ts`) plus `sanity.vite-guard.test.ts` are allowed in 1.1.2 |
| K3.1/K3.2/K3.4–K3.6 | QA | PASS | 0 maps emitted |
| K3.3 | QA | PASS | Guard in, dummy in shell → build exit 1 with `Error: VITE_SANITY_API_READ_TOKEN must not be set`, dummy count in output 0. Dummy only in `.env` → exit 1, dummy count 0. Scratch with R4b removed + dummy → build 0, 0 dummy files, R4a exit 0. Scratch with `const.ts` also reverted → 1 file, R4a exit 1 |
| K8.1 / R7 | QA | PASS | rg PCRE 0 hits. The R7 change is only in `client/src/const.ts` |
| K3.8 / V1,V2,V4–V7 | QA | PASS | Mutations, each made the named tests fail: remove throw → V1–V5 fail; process.env only → V2 fails; value in message → V4 fails; serve exempt → V4,V5 fail; build exempt → V1,V2,V3,V5 fail; throw on empty → V3,V7 fail; `export function __checkToken` → all 7 fail; broken import in main.tsx → V7 fails. `vite dev` with the dummy also exits 1 and names the variable |
| V3 | QA | CONFLICT | Spec 1.1.2 says whitespace-only passes; needs Web Lead confirmation (no-trim mutation → V3 fails) |
| V2b | CQ | FAIL (non-blocking gap) | Blank shell value + `.env` dummy → build 0 (guard misses), 0 dummy files in dist. With R4b removed and `const.ts` reverted, still 0 (inlined as an empty string; Vite gives the shell precedence). No leak; needs a test case |
| V10 | CQ | OPEN (non-blocking) | See item |
| V11 | CQ | OPEN (non-blocking) | Confirmed by reading the code (V2 writes `<repo>/.env`) |
| K3.9 | QA | PASS (by reasoning, V8) | `build:cf` = `vite build` with no `--config`, so it loads `vite.config.ts`. The Workers Builds dashboard command is still to be recorded by Ethan/Web Lead |
| K3.10 | QA | PENDING on R1 | Spec 1.1.2 still conditions the legacy pattern on R1's finding and defines none |
| K4.2 / K4.6 | QA | PASS | XHR stub and `xhrCounts` gone. Duplicates gone (config line 16; fetch lines 99–100 now reads one `toBe("published")`). New `config().withCredentials` assertion at fetch:80 fails alone under `withCredentials:true`. The `token:"x"` mutation fails at the Authorization line |
| K4.3 | QA | PASS (headers/host/data) | `wrangler dev --local`, no secrets or `.dev.vars`, no `--remote`. Origin 127.0.0.1:8799: every apicdn request is CORS-rejected (Sanity returns 403 to that Origin; only `https://metfix.org` is allowed), but 0 carry auth/cookie and all have perspective=published. Re-run served at https://metfix.org mapped to local wrangler (`--host-resolver-rules`, local bundle index-Du1heQHs) → all sanity requests 200, hosts apicdn plus cdn.sanity.io (images), 0 auth/cookie, 0 set-cookie. Response counts: courses 9, testimonials 6, FAQs 6. HARs in `/workspace/pr-token/har/` |
| K4.4 | QA | PASS | Set-cookie 0 in the HARs |
| K4.5 | QA | PENDING (post-deploy only, not a merge gate) | — |
| K5 | Ethan | PENDING | Merge blocked until Ethan confirms |

## §R3 Round-3 results at be43c485 (results only; no assertion changed. Rev 1.4 assertions as of f940a449; spec 1.1.3 aefcc701)
CI 39342499472: head_sha be43c4850d65…, 16 steps success, log `Tests 315 passed (315)`, `sanity.vite-guard.test.ts (10 tests)`, workers `Tests 8 passed (8)`. Local: 315/315.
312→315: vite-guard went from 7 to 10 tests. V1–V7 were reworked; new tests are V2b, the V2b mutation meta-test, and the V11 kill case (V7 and V10 are merged into one).
Scope: since 0d362f6f only `client/src/lib/sanity.vite-guard.test.ts` and the two `docs/` copies changed. The full diff vs 9f7129d has 10 paths, all on the K6 list (1.1.3). Rule 6 OK: no new path beyond the round-3 batch.
CQ = Code Quality round-3 notes as relayed (CQ signed off and called them non-blocking; this list governs).
| Item | QA status | CQ note | Evidence |
|---|---|---|---|
| D1 | PASS | — | PR docs/ tests copy = f940a449…, acceptance = aefcc701…, byte-equal by md5 |
| K1.7 | PASS | — | `rg --hidden`: exactly vite.config.ts:212, :215; sanity.vite-guard.test.ts:7; sanity.config.test.ts:32; ci.yml:47; deploy-pages.yml:40. No shift |
| K1.1/K1.5 | BLOCKED on #7 | — | deploy-pages.yml:40 |
| K3.3 / K8.1 | PASS | — | Scratch, R4b removed + dummy → build 0, 0 dummy files. Also with const.ts reverted → 1 file (the check catches the regression) |
| K4.6 | PASS | — | fetch/config/sanity.ts unchanged since r2. No XHR stub (0 matches). withCredentials mutation fails at fetch:80. token:"x" mutation fails at the auth/token block |
| V1, V2, V5, V6 | PASS | — | remove-throw and M1 mutations fail them |
| V2b (K8(d)) | PASS | — | (a) blank shell + temp .env dummy → build 0, 0 dummy, no inline. (b) M1 process.env only → V2 FAILS. M2 raw-file `\|\|` fallback → in-suite M2 meta-test FAILS (it throws). Note: my own M2 via `loadEnv` result `\|\|` cannot fall through, because loadEnv already gives the shell value precedence. (c) = V2 |
| V3(a) | **FAIL** | CQ4 agrees | The test resolves config for ' ', '\t', '\n' but builds only ' '. The list requires `build:cf` exit 0 for each value. (QA manual run: all three build 0, regex 0, but the test must assert it.) Mutation no-trim → V3 fails ✓ |
| V3(b) | PASS for ' ', gap for '\n' | — | Test asserts no `NAME:"[^"]` in the temp outDir. Scratch M(b), R4b removed + const.ts reverted: ' ' → 1 hit, '\t' → 1 hit, **'\n' → 0 hits**, so the regex can't fail for '\n'. The (b) check for '\n' must match the escaped form as the list says |
| V3(c) | **FAIL** | CQ1 agrees | Padded dummy throws from env and .env; message has no value. Mutation `console.error(value)` before the throw → **10/10 pass**. stdout/stderr are not asserted (the list requires all output). Mutation "treat padded as unset" → V3 fails ✓ |
| V4 | **FAIL** | CQ1 agrees | Round 2 asserted stdout/stderr; round 3 removed it (a weakening). Same console.error mutation passes. Value-in-message mutation → V4 fails ✓ |
| V7 / V10 | PASS | CQ6 note | Temp outDir, dist/public snapshot equal. Mutation dropping --outDir → V7/V10 + V3 FAIL. CQ6: the three builds take about 31s total against 60s per-test timeouts (local suite 16.8s for the file; CI 20.3s). Note, not a fail |
| V11 sentinel | **FAIL** | CQ2 agrees | No sentinel `.env` is created. Mutation "write the repo .env, then delete it" → 10/10 pass (absent→absent fingerprint). A direct repo-.env write is caught (6 tests fail) |
| V11 kill case | **FAIL** | CQ2 agrees | The child only runs a script that writes a temp .env itself. It never runs the real config or the V2 path, so SIGKILL proves nothing about the config/test cleanup. Mutation "config writes the repo .env": the kill test failed only because earlier tests left the file; its own child would never trigger it |
| V11 temp-project rewrite | PASS (partial) | CQ3 | `replaceAll` calls aren't asserted. No-op mutations on `root` and on the `@` alias are caught by V2b's build. The `@shared`/`@assets` replaces are unverified (unused in the build), so no failure is expected; recommend asserting each replace matched |
| K3.9 | PASS (reasoning) | — | unchanged |
| K3.10 | PENDING on R1 | — | |
| K4.3 / K4.4 | PASS (round 2, code unchanged) | — | |
| K4.5 | PENDING post-deploy | — | |
| K5 | PENDING on Ethan | — | merge blocked |
| §R2 doc rows | FIXED here | CQ5 | §R2 marked superseded; §R3 added |
