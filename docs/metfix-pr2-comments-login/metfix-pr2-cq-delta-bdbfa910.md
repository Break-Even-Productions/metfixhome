# metfixhome PR2 (#2) — CQ delta check b65bcdf1 → bdbfa910 (read-only)

Date: 2026-10-21 ~9:00 AM PT. Seat: MetFix Web Code Quality. Throwaway clone /workspace/tmp/d2. Nothing commented, pushed or edited.
Commits: 61b5404 (docs pin 1.6.6 / r1.29), 42c96c1 (r1.29 catalog + r14 sabotages), bdbfa91 (BSI_OAUTH_CLIENT_ID var; M-CW20/M-C62 kills).

## Verdict: CHANGES NEEDED (client_id half-done against spec 1.6.7; pins OK for 1.6.6 but already stale)

Tests run at bdbfa910 (`npm ci --legacy-peer-deps`; plain `npm ci` fails ERESOLVE): `npx vitest run` 38 files, 614 passed / 4 skipped / 0 failed; `npm run test:workers` 9/9 + 1/1 pass. P1.1 + P8.2 green; with M-P1O1 applied, P1.1 goes red (`['siteverify','limiter','bsi']` vs expected), P8.2 stays green.

Note: the delta's "client_id" is the **BSI WP OAuth client id** for web-login (spec 1.6.7 §0u), not a Google client ID. GOOGLE_WEB_CLIENT_ID is untouched in this delta (still unset in wrangler.jsonc; BX3 still Ethan's).

## (1) client_id var
- OK: plain wrangler `vars` (wrangler.jsonc:72-76), not a secret, not `VITE_`; 0 hits under client/**; value byte-equals spec 1.6.7 §0u.2 (not invented); typed in `Env` (worker/upstream.ts:66, optional string).
- **CQ-D1 (blocker) — name drift.** Spec 1.6.7 §0u.2 / AU27.1 names `METFIX_ORG_OAUTH_CLIENT_ID`; code keeps `BSI_OAUTH_CLIENT_ID` (wrangler.jsonc:75). §0u.2 marks the name "proposed (OQ-OC4)": Web Lead must rule which name wins, then spec or code changes once.
- **CQ-D2 — not a single read site.** `env.BSI_OAUTH_CLIENT_ID` is read in 7 places: worker/auth/login.ts:97, worker/do/session.ts:186, worker/auth/logout.ts:56, worker/auth/signup.ts:94, worker/auth/google.ts:415,437,467. session.ts:30 redeclares the field in a second local Env type. Want one `bsiClientId(env)` accessor (in upstream.ts) that returns `string | null`.
- **CQ-D3 — missing-value behaviour off-spec.** login.ts:90-100: `reserveR8c` runs *before* the config check, so a missing var spends the site-wide 25/60s login cap on every attempt and returns 503 for a config fault. No `bsi_client_config_missing` log anywhere (0 hits). Empty string is caught (`!clientId`), and 0 BSI calls are made; that part is good. google.ts:415 redirects to an auth error, not 503. Check config before reserving R8c, and log the code with no values.
- **CQ-D4 — no AU27 tests.** AU27.1–AU27.4 / M-OC1–M-OC4 (1.6.7) have 0 tests or sabotages. Harnesses hard-code `cid_QA`/CID (tools/pr2/harness/*.ts), so nothing proves body `client_id === env var` when the browser body also sends `client_id`/`client_secret`, or that the secret never leaves. `METFIX_ORG_OAUTH_CLIENT_SECRET` has 0 references (right for now; AU27.3 scan is still missing).
- **Rule 6:** the var is spec 1.6.7 scope folded into PR2 under "Ethan's decision, relayed". That's a relay, not Ethan's own go. Flag only.

## (2) P1.1 call-order test (tools/pr2/gates/comments.p-gates.test.ts:24-74)
- Unchanged in this delta (last touched ac56010). It records real calls: it wraps the real write-limiter binding's `limit` and the injected fetch (siteverify vs BSI POST), then asserts `["limiter","siteverify","bsi"]`. It's not a mock self-check. Swapping the order (M-P1O1) turns it red, verified above. No production hook: it uses the existing injected fetch/binding (Rule 4 OK).
- **CQ-D5 (nit, slop):** lines 70-71 `indexOf` asserts restate line 69's `toEqual` exactly; delete them.
- **CQ-D6:** M-P1O1 lists red {P1.1, P8.2}, but P8.2 does not go red (CSRF/logged-out path never reaches either call). Fix the red set to {P1.1}.

## (3) Pins (CK-P1 style)
- List /workspace/specs/metfix-pr2-comments-login-tests.md = r1.29, md5 052f4489b856bd01795c6760d45a7f71, byte-identical to the repo's docs/specs copy. It pins spec 1.6.6 `ff62bd08fb0e111e8709363f63bec845`, and the box and repo 1.6.6 files both hash to that. Header counts 271 / 12 / 14 match its own blocks: one `gate-ids` block (271 lines), `box-ids` 12, `post-deploy-ids` 14. **PASS for 1.6.6.**
- **CQ-D7 — stale.** Spec rev1.6.7 (bd635df7caff88bd0d4a2462725009f6, 08:42 PT) is newer than list r1.29 (07:15 PT) and adds §0u (client_id, AU27.1–4, M-OC1–4). No list pins it, so the client_id work in this delta has no governing gate rows. 1.6.7's own counts (264→268 gate, 260→264 catalogue) don't match the list's 271/283, but the list governs, so QA has to re-pin (r1.30) and the spec's counts get ignored.
- **CQ-D8 (slop):** spec and list are committed twice, in docs/specs/ and docs/metfix-pr2-comments-login/, byte-identical. That's 2×2,662 lines of drift risk. Keep one path (the spec's G3 docs path).

## Other delta items
- **CQ-D9:** tools/pr2/run-mutations.mjs:52 adds `--skip-workers`, which silently stubs the Workers suite (`status:null`). Any mutant whose red set lives in the Workers suite then reads "survived/not observed". Either drop the flag or record it in each result row (`workers: "skipped"`).
- **CQ-D10:** the CW14.1 test (gates-cw-client.test.tsx:217-236) is fine. It checks behaviour through `within(row)`; `getAllByRole` length 1 plus the row check overlap slightly, which is OK. The page.mount rename "6."→"C6.2" is ID hygiene only.
- npm install needs `--legacy-peer-deps` (ERESOLVE on a clean `npm ci`), so CI on a clean runner breaks. That's pre-existing, not from this delta, but it's still not fixed.

## Which findings a check could catch
- CQ-D1, CQ-D7: CK-P1 extension that fails when a newer `acceptance.rev*.md` exists than the one the list pins, plus a config-name lint (wrangler `vars` keys ⊆ names in pinned spec §config).
- CQ-D2: eslint `no-restricted-syntax` banning `env.BSI_OAUTH_CLIENT_ID` member access outside worker/upstream.ts; a single `Env` type (TS duplicate-type lint / no local Env redeclare).
- CQ-D3, CQ-D4: tests — AU27.1 (var unset/"" → 503, 0 BSI calls, 0 R8c reservations, log code present), AU27.2 sentinel, AU27.3 repo/bundle scan in CI.
- CQ-D5: no lint catches it cleanly. Review only.
- CQ-D6: orphan/red-set CI check: run each targeted mutant and diff the observed red set against the declared one (the deferred tooling PR).
- CQ-D8: CI check that the docs/ spec/list files are unique by md5.
- CQ-D9: a test of the runner that fails when a result row lacks a workers status; or forbid the flag in CI.
- npm ERESOLVE: CI step running a plain `npm ci`.
