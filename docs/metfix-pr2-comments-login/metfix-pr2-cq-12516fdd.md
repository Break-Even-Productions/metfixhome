# metfixhome PR2 (#2): CQ review at 12516fddb2c3780ad029fea33f0b64275d72645c (read-only)

Date: 2026-10-21, about 11:30 AM PT. Seat: MetFix Web Code Quality. Throwaway clone at /workspace/tmp/pr2-12516. I didn't comment, push or edit anything.
Range reviewed: bdbfa910..12516fdd (15 commits), plus the whole login, refresh, logout and Google path.

## Pins (CK-P1)
- Spec rev1.6.12: md5 `ce2e3727988d7ac8299315fd8012343d`. The box copy and both repo copies match.
- QA list r1.34 pins `ce2e3727988d7ac8299315fd8012343d`. Its header gate count is 275, and its own `gate-ids` block also has 275 lines. Box 12, post-deploy 14. OK.
- Contract: `2026-10-21-pr29-direct-token-slim.rev1.4.md` is in the repo docs.

## Tests
- `npm ci --legacy-peer-deps`, then `npm test`: 39 files, 632 passed, 4 skipped, 0 failed.
- `npm run test:workers`: 9/9 and 1/1 pass.

## Verdict: CHANGES NEEDED

### Blockers
1. **The coalesced refresh writes KV once per caller, not once.**
   - Where: `worker/do/session.ts:130-138` and `worker/auth/session.ts:175-177`.
   - What happens: `withRefreshLock` gives every joiner a clone of the same `{refreshed:true}` response. Each caller then runs `putMeCache` on the same `/me` key. With 50 concurrent callers (AU7.6), that's 50 identical KV puts.
   - Why it matters: KV limits writes to the same key to about 1 per second. The `putMeCache` at line 177 isn't wrapped in a try/catch, so a throttled put can turn a successful refresh into an error.
   - Fix: only the caller that started the refresh writes KV. For example, the DO returns `refreshed:true` to the initiator only, or the DO itself returns the record and a single writer handles it. You could also catch the error and continue, because the DO is the source of truth.
2. **The error map passes the upstream Retry-After where the spec fixes it at 60.**
   - Where: `worker/auth/login.ts:210-218` and `worker/do/session.ts:230-235`.
   - What happens: for `invalid_client`, `unauthorized_client`, `unsupported_grant_type`, `invalid_request` and unknown codes on a 4xx, the code returns `retryAfter ?? 60`.
   - What the spec says: §0v.3 fixes these rows at `Retry-After: 60`. Only 429 and 5xx go through `parseRetryAfter`.
   - Also: login.ts:210-217 is a dead branch, because it returns exactly what line 218 returns. Collapse it to one fixed-60 return for the whole non-429, non-5xx class.
   - Missing test: AU27.3 has no case that sends a Retry-After on a 400 `invalid_client`.
   - `client_not_allowed` (the old web-login row, 503) can't arrive on `/oauth/token`. Under the direct flow, any such code falls into the unknown-code row, so after this fix it maps to 503 with Retry-After 60.

### Should fix (not blocking alone)
3. **Legacy APIs are left behind after the migration. These are code deletions inside files, not file removals.**
   - Unused exports in `worker/upstream.ts`: `bsiWebLogin` (:700), `bsiRefreshToken` (:771), `bsiExchangeCode` (:793) and `bsiRevokeToken` (:820). Nothing calls them.
   - `applyRefreshResult` (`worker/auth/session.ts:234`) has no callers. The DO route `/refresh` (`worker/do/session.ts:83-95`, `applyRefresh` :287) only serves it.
   - The dangerous part: `/refresh` shares `refreshInflight` with `/ensure-access`. If a `/refresh` call joins an in-flight ensure-access, its token body is never read and it gets the ensure-access response back. That's a silent token drop.
   - `/refresh` also accepts a pair without `refresh_token` and keeps R0, which contradicts §0v.4. Delete the route and the helpers.
4. **Logout's revoke failures are never logged.**
   - Where: `worker/auth/logout.ts:57-80`.
   - What happens: `oauthRevokeToken` returns `{kind}` and never throws (`upstream.ts:276-293`). So the `catch { console.log("bsi_revoke_failed") }` blocks are dead, and a 5xx or timeout from revoke is dropped silently.
   - Fix: check `res.kind !== "ok"` and log `bsi_revoke_failed` with the hint only. The order (refresh first, then access), the best-effort behaviour and the 204 are correct.
5. **The Google bridge state is written but never used.**
   - Where: `worker/auth/google.ts:427-439`.
   - What happens: `putOauthState(bridgeState)` costs one OAUTH_STATE DO write per Google login. Nothing reads or takes it back, and the `state` on `followed.location` (:465-470) is never compared with `bridgeState`.
   - Fix: either verify and take it (match `loc.searchParams.get("state")` against `bridgeState` before using `wpCode`), or stop writing it.
   - The rest of this leg is fine. The WP code is fetched server-side, the client secret stays in the Worker, and the first-leg state, pre-cookie and nonce are checked (:387-397).
6. **Rule 4 carry-over: a production hook exists only for tests.**
   - Where: `worker/do/session.ts:43-44` and `:111-123`.
   - What it is: `SessionDoEnv.fetchImpl` accepts a mutable `{ current }` box that the harness fills after build. No production binding ever sets it. Inject it through the test config's bindings or a test-only DO subclass instead. This was already there before this range.
7. **The real-DO single-flight test is thinner than spec AU7.6.**
   - Where: `worker/do/session.refresh.workers.test.ts:43-146`.
   - What it covers: 2 concurrent callers, which proves 1 token POST with the rotating mock.
   - What the spec says: AU7.6 asks for 50 callers across two isolates. Raise it to 50. That would also have caught blocker 1 if the test counted KV puts.
8. **Unused fields.** `LoginBody.client_id` and `client_secret` (`worker/auth/login.ts:40-41`) are never read. Drop them, or comment that they're deliberately ignored. AU27.1 already proves the browser's `client_id` is ignored.
9. **Nit:** `tools/pr2/gates/comments.p-gates.test.ts:553` is implied by 552 plus 554.

### What checks out
- **Single-flight on the real DO.** `blockConcurrencyWhile` plus one shared promise gives one `/oauth/token` call for success, `invalid_grant` and 5xx alike.
- **Rotation is stored before `/me`** in one `put` (:251-257).
- **Failure paths:**
  - Refresh `invalid_grant` and `/me` 401 → `deleteAll` and a KV delete (`auth/session.ts:166-172`).
  - Token 5xx or a 200 without `refresh_token` → the pair is untouched.
  - `/me` non-401 → R1 is kept and R0 is never restored.
- **Tokens never reach the browser.** Login and Google return only `{signed_in, public_name}` or a 302 plus the sid cookie.
- **The client secret goes only to `/oauth/token`.** Revoke sends only `token` and `token_type_hint`.
- **No duplicate token or `/me` calls.** Login makes one token call and one `/me` call. The Google exchange makes one `/oauth/token` call and one `/me` call.
- **Login order** is config → R8a → R8b → siteverify → R8c → token.

## Prior delta items
- **D2: landed.** One read site, `oauthClientId` (`upstream.ts:161`), and one `Env` (`upstream.ts:62`). `session.ts` now uses `Pick<Env,…>`.
  - Minor: `signup.ts:87-90` logs `auth_config_missing` by hand instead of calling `requireAuthConfig`.
- **D3: landed.**
  - `requireAuthConfig` runs before R8a, R8b and R8c (`login.ts:107-114`).
  - Google returns 503 JSON before the limiter (`google.ts:369-376`).
  - The log name is `auth_config_missing <field>`, as spec 1.6.12 line 159 requires. The old name `bsi_client_config_missing` is superseded by the spec, which is correct.
- **D4: landed.** AU27.1 (`gates-au-27-direct-token.test.ts:125-164`) sends browser `client_id: "EVIL"` and asserts that the form's `client_id` equals `env.BSI_OAUTH_CLIENT_ID`.
- **D5: landed.** The P1.1 `indexOf` duplicates are gone; only `toEqual` is left (:51). Nit 9 is a separate leftover.
- **D6: resolved differently.** List r1.34 declares M-P1O1 as {P1.1, P8.1, P8.2}, and the log shows that exact observed red set. P8.1 and P8.2 now go through the limiter, so the wider set is backed by evidence. I accept it.

## Which findings a lint, type, test or CI check could catch
- **B1:** a test. AU7.6 on the real DO with 50 callers that also counts KV puts on the `/me` key (expect 1).
- **B2:** a test. AU27.3 rows where the upstream sends a 400 `invalid_client` or an unknown code with `Retry-After: 17`, and the browser must still get 60. eslint `no-dupe-else-if` won't catch it; `sonarjs/no-identical-functions` and `no-duplicated-branches` would flag the dead branch.
- **S3:** `ts-prune` or knip (unused exports) in CI. A test that the DO returns 404 for `/refresh`.
- **S4:** `@typescript-eslint/no-floating-promises` won't catch it, but a test will: AU8.2 asserts one `bsi_revoke_failed` log per failed revoke. A type would too: a `Result`-returning function marked as never throwing, with a lint against try/catch around it.
- **S5:** a test. The bridge-leg location returns the wrong `state`, so expect an auth-error redirect and 0 `/oauth/token` calls.
- **S6:** a lint. `no-restricted-syntax` banning `current` boxes and `fetchImpl` in `worker/do/**` types, or the deferred `no-restricted-globals` rule.
- **S8:** `noUnusedLocals` doesn't cover type fields; knip can. Review otherwise.
- **S7 and nit 9:** review only.
