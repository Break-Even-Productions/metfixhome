# metfix.org: remove the Sanity read token from the client bundle (acceptance + threats)
- Rev 1.1, 2026-10-19. Author: MetFix Web Spec. Status: for Web Lead; not signed.
- Changelog:
  - rev 1.1: folds in CQ's pre-round-1 notes 1–9 as ruled by Web Lead (K1 exception list; R4 scans `dist/public` text assets, value regex primary; U2/K4 mounted-test reference removed; K2 asserts via `sanityClient.config()`; `useCdn:true` ruled; duplicate queries out of scope; apiVersion/perspective note with doc citation; `.dev.vars.example` corrected; K5/K3 no-echo; K7 build.config test). Adds Web Lead's CI-history finding: R1 is mandatory and blocks merge. Adds QA's test list (`metfix-sanity-read-token-fix-tests.md`, md5 `19ce522c3bff732296417508a504cae1`) with gap rulings G1–G7 (§6).
  - Rev 1.0 (`5e21d58c`) backed up at `metfix-sanity-read-token-fix-acceptance.rev1.0.md`.
- Order: its own PR off main, landing **before** the Affiliate Seminars image PR (`metfix-foundations-image-acceptance.md` rev 1.1 depends on it).
- Base: main `9f7129d7`; #7 head `01f4a8f` (confirmed by Web Lead).

## 1. Evidence (verified 2026-10-19, local clone at 01f4a8f; no token value printed)
Uses of the name (presence only):
- `client/src/lib/sanity.ts:10` reads `import.meta.env.VITE_SANITY_API_READ_TOKEN` and spreads it into `createClient({... token})` (around line 21). Any build with the variable set inlines the token into the browser bundle.
- `client/src/vite-env.d.ts:7` type declaration.
- `.github/workflows/ci.yml:39`, in the "Build static site" (`build:cf`) env, from `secrets.VITE_SANITY_API_READ_TOKEN`. CI's own `dist/` therefore contains the token whenever the secret is set. CI has no artifact upload, and "Wrangler deploy dry-run" (line 58–59) doesn't publish. The existing B2 grep doesn't look for it.
- Mentions only: `docs/metfixhome-cleanup/metfix-pages-cleanup-acceptance.md:66` and `docs/metfix-cloudflare-move/metfix-cloudflare-move.md:173` (already flagged as a follow-up there).
- `.dev.vars.example` exists at the repo root and is clean. Verified via cursor-github on `main` and on `01f4a8f`: its only line is an empty `DAILY_FIX_API_KEY=`, with no Sanity variable. No other `.env*` file or `wrangler.*` Sanity entry is in the repo. Spec can't see the Workers Builds env vars from here (Q1).
- Vite build (`vite.config.ts` build block, at 9f7129d7 and 01f4a8f): `outDir: dist/public`, with no `build.sourcemap` key. Vite's default is `false`, so **no sourcemaps are emitted** today. R4 scans `*.map` anyway (G6).
- **CI history (finding attributed to Web Lead, not verified by Spec):** every CI build since the GitHub secret was set put the token into `dist/public`. CI has no artifact upload, so exposure is through CI runners and logs and any copy of those builds. Combined with T1, this makes R1 mandatory.
- Separate and server-side only: `scripts/seed-sanity.ts:36` uses `SANITY_API_WRITE_TOKEN` from local `.env`, and `SANITY.md:59` shows only the placeholder `sk...`. That's out of scope, but it must never get a `VITE_` prefix.

Production bundle `https://metfix.org/assets/index-aZcK-OxC.js` (842,440 B, fetched 2026-10-19, about 3:30 PM PT):
- The `createClient` call is `{projectId:"etg9lezr",dataset:"production",apiVersion:"2025-01-01",useCdn:!1}` with **no token**.
- No match for `sk[A-Za-z0-9]{80,}`.
- The deployed build had the variable unset, so no token is exposed on prod today. The risk lives in the code path and in CI builds. Whether a token was ever in an earlier deployed bundle can't be known from here, so treat it as exposed and rotate it (R1).

Public-dataset check (unauthenticated, no token):
| Query (`etg9lezr.apicdn.sanity.io/v2021-10-21/data/query/production`) | Result |
|---|---|
| `count(*)` | 26 |
| `count(*[_id in path("drafts.**")])` | 0 |
| `array::unique(*[]._type)` | affiliatePage, course, faqItem, homePage, sanity.imageAsset, siteSettings, testimonial |
| `count(*[_type=="course"])` / `testimonial` / `faqItem` | 9 / 6 / 6 |
| `api.sanity.io` (no CDN) `count(*)` | HTTP 200 |

The `sanity.ts:9` comment says "Public API does not return courses/testimonials/FAQs without it". That's **false today**: all three types return publicly. Every type the client queries is public, and there are no drafts. Limitation: an unauthenticated query can't see private docs or drafts by definition, so "no private docs" rests on the type list matching the schema exactly (Q2).

## 2. Decision: Option (A), drop the token and read via the public CDN
Option (B), a Worker proxy, isn't needed. It stays in reserve if Q2 finds private content.

## 3. Requirements
- R1 (Ethan) **MANDATORY, blocks merge** (Web Lead's CI-history finding, §1). Revoke every Sanity API token that was ever stored as `VITE_SANITY_API_READ_TOKEN`, in sanity.io/manage → project etg9lezr → API → Tokens. Record the date. Do it at merge or earlier. Don't create a new read token for the client.
- R2 `client/src/lib/sanity.ts`: no `token` option and no reference to `VITE_SANITY_API_READ_TOKEN`. **`useCdn: true`** (Web Lead ruling), so reads go to `etg9lezr.apicdn.sanity.io`. Set `perspective: "published"` explicitly. Keep `apiVersion` as the code's `2025-01-01` (G7). Fix the stale comment. No new export just for tests.
  - Why pinning is required: the code uses `apiVersion` `2025-01-01`. Sanity's docs say the default perspective is `raw` for API versions before `v2025-02-19` and changed to `published` from that version on ("With the release of API version 2025-02-19, the default perspective changed from `raw` to `published`"; "the `raw` perspective (the default for API versions before v2025-02-19)"). Source: https://www.sanity.io/docs/perspectives (fetched 2026-10-19). With `raw`, an authenticated client would get drafts, so `published` must be pinned.
- R3 Remove the name from `client/src/vite-env.d.ts`, from `ci.yml` build env (`VITE_SANITY_PROJECT_ID`/`DATASET` may stay), and, as an Ethan step, from the GitHub secret, the Workers Builds env and any `.env.example`/local `.env`.
- R4 CI guard step `No Sanity token in dist` in `.github/workflows/ci.yml`, after "Build static site" and before "Wrangler deploy dry-run". It scans the Vite outDir `dist/public`, text assets only (`*.js`, `*.html`, `*.css`, `*.map`), recursively:
  - Primary (the real check), value regex: `\bsk[A-Za-z0-9]{40,}\b`.
  - Secondary, name: `VITE_SANITY_API_READ_TOKEN`.
  - If R1 shows the revoked token used a legacy (non-`sk`) format, add a matching pattern in this PR. It must never be the token value itself.
  - On a match, print only file names (`grep -l`), never the matched text.
- R5 Never send any Sanity token to the client in any form (env, inline, fetched config, cookie).
- R6 Reads keep working: home, affiliate, courses, testimonials, FAQs and site settings render the same content as before on the PR preview.

**Read path the image PR assumes after this fix:** the browser calls `@sanity/client` with no token, `perspective:"published"`, and `useCdn:true` to `https://etg9lezr.apicdn.sanity.io` only. Images come from `https://cdn.sanity.io/images/etg9lezr/production/...`. There's no Worker hop.

## 4. Acceptance
- K1 `git grep -n VITE_SANITY_API_READ_TOKEN` finds hits only in this exception list: `docs/**`, the R4 guard step in `.github/workflows/ci.yml`, and the guard/config test `client/src/lib/sanity.config.test.ts`. Exact expected lines are recorded at round 1 (QA K1.1/K1.5, G1 = CQ1).
- K2 Unit test `client/src/lib/sanity.config.test.ts` imports the existing `sanityClient` and asserts on `sanityClient.config()`: `token` absent/undefined, `useCdn === true`, `perspective === "published"`, `apiVersion === "2025-01-01"` (G7), and projectId/dataset. No new exported config is added for the test.
- K3 CI R4 step present and green on the PR head. One-time local proof (G2), not committed:
  - (a) temporarily restore the token read in `sanity.ts` and build with a realistic dummy (`sk` plus ≥ 80 alphanumerics, generated, not a real token) → the step fails;
  - (b) directly inject the dummy, and separately the name, into a file in `dist/public` (including a `*.map`) → the step fails each time;
  - (c) clean head built with the dummy env set → the step passes, with 0 matches.
  The dummy goes in via env or a file and is never echoed into CI or agent logs.
- K4 New mounted fetch test (QA K4.2): mock the transport the client actually uses, **assert the mock was called** (G4), host is `etg9lezr.apicdn.sanity.io` (G5), `perspective=published`, and there's no Authorization header. On preview, no `*.sanity.io` request carries Authorization or cookies, and pages render Sanity content (R6). There are no existing mounted content tests to rely on.
- K5 Ethan confirms R1 and R3 in his own words (tokens revoked; GitHub secret and Workers Builds variable deleted); a relay doesn't count. After that, a request with the old token returns 401. The token is passed via env or file and never echoed into CI or agent logs. **Merge is blocked until K5 passes.**
- K6 Allowlist: `client/src/lib/sanity.ts`, `client/src/vite-env.d.ts`, `.github/workflows/ci.yml` (build env plus the R4 guard step), test files matching `^client/src/lib/sanity[^/]*\.test\.ts$` (incl. `sanity.config.test.ts`, `sanity.fetch.test.ts`), `SANITY.md`, `docs/`. Nothing in `worker/`.
- K7 `worker/build.config.test.ts` (which reads `ci.yml`) still passes unchanged with the new guard step. QA confirms on the PR head. If it needs an edit, that's a new path and needs Web Lead's ruling (rule 6).

## 5. Threats
- T1 The old token stays valid until it's revoked. Code removal alone fixes nothing for copies already out (CI dists, local builds, any past deploy), so R1 is mandatory and K5 checks it.
- T2 Leaked drafts or private docs. A read token with viewer rights can read drafts and unpublished content. Mitigation: no token, plus `perspective:"published"`. If private types appear later, use option B, never a client token.
- T3 GROQ injection or an open proxy: N/A in A. The client sends fixed queries from source, and the public API only returns public published docs. If B is ever used: whitelisted named queries only, no GROQ passthrough, parameters validated and passed as GROQ `$params`, the token as a Worker secret.
- T4 Cache poisoning: N/A in A (Sanity's CDN). In B: cache key = query name + validated params only, cache only 200 JSON, short TTL, never vary on client headers.
- T5 Quota and abuse: public reads count against the project's API/CDN quota. Prefer apicdn (R2). Watch usage in Sanity manage (Q4). There's no token whose rate limit could be abused.
- T6 Regression: R4 blocks re-adding any `VITE_` Sanity token.

## 6. Test list
QA's list: `metfix-sanity-read-token-fix-tests.md`, md5 `19ce522c3bff732296417508a504cae1` (verified). It's adopted as written, with these rulings (Web Lead):
- G1 = CQ1: K1.1/K1.5 use the K1 exception list.
- G2: K3 proof = restore the token read and build with the dummy, plus direct injection into `dist/public` (K3(a)–(c)).
- G3 = CQ2: the scan covers `dist/public` text assets (`*.js,*.html,*.css,*.map`), not all of `dist/`. QA K3.1's "all of dist/" shape and K3.7 are superseded by R4.
- G4: K4.2 asserts the mock was called.
- G5: `useCdn` is true; apicdn host only.
- G6: sourcemaps aren't emitted (§1). `*.map` is scanned anyway, and K3.4's injection runs on a created `.map`.
- G7: apiVersion is asserted equal to the code's `2025-01-01`.
- CQ3: QA K4.1 (existing mounted tests) is void; there are none.
## 7. Out of scope
- Duplicate `siteSettings` and home queries across `content.ts`/`homeContent.ts` (own follow-up PR).
- Option B Worker proxy (unless Q2 changes the answer).
- `SANITY_API_WRITE_TOKEN` and the seed script.
- CSP for sanity hosts (PR4).
- The image PR itself.
- Studio changes.
- CORS changes, beyond confirming metfix.org and www are listed.

## 8. Open questions
- Q1 (Ethan) Is `VITE_SANITY_API_READ_TOKEN` set in Workers Builds env, GitHub secrets or anywhere else? Has any past deploy been built with it? R1 applies either way.
- Q2 (Ethan/Web Lead) Is any content meant to be private or draft-preview on the site? If yes, option B.
- Q3 decided (Web Lead): `useCdn:true`.
- Q4 (Ethan) Is there a Sanity plan quota to watch for public reads?
