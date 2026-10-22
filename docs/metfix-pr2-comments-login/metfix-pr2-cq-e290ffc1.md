# metfixhome PR2 (#2): CQ re-check at e290ffc182d2e8514447f8d70348abef064bb413 (read-only)

Date: 2026-10-21, about 12:45 PM PT. Seat: MetFix Web Code Quality. Throwaway clone at /workspace/tmp/pr2-e290. I didn't comment, push or edit anything.
Against: metfix-pr2-cq-12516fdd.md (md5 8a794248…). Range: 12516fdd..e290ffc1 (7 commits). Bar: egregious only (Ethan's ask, via Web Lead).

## Verdict: ONE REAL BLOCKER (test:workers is red). Product code is OK.

### Blocker
1. **`npm run test:workers` fails, deterministically (2 of 2 runs).**
   - Test: `worker/do/session.refresh.workers.test.ts:144`, AU7.6 on the real DO. It expects 49 bodies with `refreshed:false` and gets 0.
   - Cause: on real workerd, `blockConcurrencyWhile` holds back the other 49 requests until the leader is done, so they never join `refreshInflight`. They run `ensureAccess` on the already-rotated pair and hit `session.ts:199` `json({ status: "ok", record })`, which has no `refreshed` field at all.
   - Behaviour is still right: 1 token POST, all 50 get ACCESS2/REFRESH2, exactly 1 `refreshed:true`, so exactly 1 KV write. Only the assertion is wrong.
   - Fix, either one: assert `refreshed !== true` for 49 bodies, or return `refreshed:false` explicitly at :199. Then make sure CI runs test:workers. The Project's "green" claim didn't include this run.

## Prior blockers
- **B1: fixed.** Only one caller writes `/me`, and `putMeCache` (`auth/session.ts:118-128`) now swallows a KV error, so a throttled put can't fail a good refresh. The harness gate AU7.6 (`gates-au-03-session.test.ts:633`) counts 1 KV put and throws `kv_put_throttled`, so it fails if either half is reverted. On the real DO, the single writer comes from serialisation rather than the joiner rewrite; see the blocker above.
- **B2: fixed.** `login.ts` collapses to one `unavailable503(60)`, so the dead branch is gone. `do/session.ts` and `google.ts` use `parseRetryAfter` only for 429 and 5xx, and fixed 60 for everything else. `acting.ts` now passes the DO's Retry-After through. AU27.3 (:272) and AU27.10 (:1286) send upstream 17 and 600 on non-grant codes and expect 60. Both fail if reverted.

## Items 3-9
- 3 legacy APIs: done. The four `bsi*` exports, `applyRefreshResult`, and the DO `/refresh` route plus `applyRefresh` are deleted, so the token-drop path is gone.
- 4 revoke logging: done. `revokeBestEffort` checks `res.kind !== "ok"` and logs the hint only. The harness adds a "timeout" case.
- 5 Google bridge state: done. The state is taken and compared before the token exchange; on a mismatch or `unavailable` it redirects to the error page.
- 6 Rule 4: partly done. The `{current}` box is gone, but `SessionDoEnv.fetchImpl` is still an optional prod-type field set only by tests. **Parked.**
- 7 AU7.6 at 50 callers: done (now red; see the blocker).
- 8 unused `LoginBody` fields: done.
- 9 nit: done (the redundant line was removed).
- Also: signup now uses `requireAuthConfig` (the D2 minor).

## Delta scan for anything egregious: none in product code
- Tokens and secrets stay server-side. No new route to the browser.
- Single-flight holds (1 token POST across 50 callers on the real DO).
- No lost rotation. No new upstream calls. No retry loops.
- `package.json` pins react and react-dom to exact 19.2.1 and adds npm `overrides`. That's fine for npm ci, though it sits beside the pnpm `packageManager` field.

## Tests and pins
- `npm ci --legacy-peer-deps`, then `npm test`: 646 tests; 641 passed, 4 skipped, 1 failed on the first run. The failure was TK1.r (`repo-scan.test.ts`): its porcelain snapshot saw the `dist/` that another test built during the same run. When I re-ran that file on its own, it passed 16/16. It's an order-dependent flake, so I've parked it, but it will bite in CI on a fresh checkout.
- `npm run test:workers`: 9/9, then 0/1 (the blocker above).
- CK-P1: OK. List r1.35 (md5 `a8213885e607830753088635c28e6abe`; the box's `metfix-pr2-comments-login-tests.md` is identical) pins spec 1.6.12 `ce2e3727988d7ac8299315fd8012343d`, which matches the box and repo copies. Header gate count 275 = `gate-ids` block 275.

## Parked follow-ups (not blocking)
- F1: the S6 remnant. Move `fetchImpl` off `SessionDoEnv` into a test-only subclass or bindings.
- F2: the joiner rewrite in `withRefreshLock` rebuilds the response with `json(body, status)`, which drops headers such as Retry-After on a shared 503. In practice it never runs on workerd, which serialises the requests. Simplify it or delete it.
- F3: the TK1.r order flake (snapshot the porcelain before any build, or ignore `dist/`).
- F4: `ensureActingAccess` accepts Retry-After only as `/^[1-9][0-9]*$/`, a second parser beside `parseRetryAfter`. That's harmless because the DO emits canonical values, but it should be one function.

## Which findings a lint, type, test or CI check could catch
- Blocker: **CI**. A required job that runs `npm run test:workers` would have shown this before the "green" claim. **Type**: a `refreshed: boolean` (not optional) on the DO's ok-response type makes :199 fail to compile.
- F1: **lint**. `no-restricted-syntax` on `fetchImpl` in `worker/do/**` types (the deferred tooling PR).
- F2: **test**. A shared-503 test that asserts Retry-After on every caller. Review otherwise.
- F3: **CI**. Run the suite in random order (`--sequence.shuffle`) on a clean checkout.
- F4: **lint**. `no-restricted-syntax` banning Retry-After regexes outside `parseRetryAfter`.
