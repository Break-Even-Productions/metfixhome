# PR 29 slim: Worker → Pro /oauth/token direct (B), rev1.4

Supersedes rev1.3 (64fea012). Changes: Changelog (rev1.3 → rev1.4) at the end; earlier changelogs are kept below it.

Base: comparison rev1 (8baee332) and rework rev2 (a08e4a5e), copied to `ciparts/`. BSI cites at **6f48cfb9** (`wp-content/plugins/bsi/` unless noted). Pro = 4.3.2 local zip, cited by file:line only. Fixture IDs and secrets only. Tags: [code-read] = read, not run; [run] = executed. **Nothing in this file was run.**

## N0 Ruling → section
| Ruling | § |
|---|---|
| Drop web-login, role tags, AS1, L-ROLEW, secret lookup | §1 |
| Drop every extra login check; email accepted on /oauth/token | §1, §8 |
| K1 `bsi/v1/me` + ME1/ME2 | §2 |
| K2 SC1 | §3 |
| K3 guard, halt, RO1/RO2/AL1, L18e/L18i/L18d-t on /oauth/token | §3, §6 |
| K4 refresh rotation (in PR 29, Lead) | §4 |
| QA cond. 1 SC1 both encodings; CQ no-secret leg | §3 |
| QA cond. 2 ME1 app token | §2 |
| CQ L18e/L18i both encodings | §3 |
| CQ rotation lint L-ROT1 | §4 |
| Build must-confirm notes (B1 resolved, B2 open) | §11 |
| /me resolves only via `wo_public_get_access_token`; ME3; L-ME1 | §2 |
| SC1 (e) query-string secret; drop `$_GET` branch | §3 |
| MM3 filter-chain fallback | Mutants |
| Ethan: keep 86400 s, drop F1, accept Pro case-insensitive secret match | §8, §10 |
| CQ: /me needs a real user; ME2(e); `user_can` | §2 |
| QA: ME3 with X-WP-Nonce + cookie precheck | §2 |
| L-RDM2 / RD-M2, /auth/login | §5 |
| Dead WS1 code (L-SECRET1 dropped) | §7 |
| Worker contract Q2/Q3/Q6/Q7/Q8, HP1 | §9 |
| Accepted by ruling (incl. RF2) | §8 |
| wp-admin checklist | §10 |

## §1 Drop
- Route `/auth/web-login`: `includes/bsi-weblogin.php` (whole file) and `tests/test-bsi-weblogin-rest.php`, `tests/support/bsi-weblogin-test-helpers.php`, `tests/test-bsi-weblogin-guards.php`.
- Rev2 S2/S5 entirely: `_bsi_oauth_role`, the role admin screen and save handler (AS1), RC-ROLE, RL1–RL5, CL1/CL2, L-ROLEW, L-MAP0, L-OPT1, the per-post secret lookup `bsi_oauth_client_secret_for_post`.
- Rev1 comparison §0/§1 hooks: no `wo_login_check`, `wo_failed_login`, `wo_user_not_found` or `wo_before_token_method` lockout/policy, no failure counter, no `wp_authenticate`/2FA path, no email block. LK1, RD-M2p, RF2 are **not legs**. Rate limit + reCAPTCHA live only in the Worker.

## §2 `bsi/v1/me` (K1)
- `GET /wp-json/bsi/v1/me`, `permission_callback => '__return_true'`; auth is done in the callback so every auth failure is the same 401.
- **User resolution, the only allowed path**: `wo_public_get_access_token(wp_oauth_get_authentication_token($_SERVER))` (Pro `includes/public.php:27`, expiry checked at `:39-40`; token read from the request at `includes/functions.php:701`). The user is the returned token's `user_id`. No result, or a falsy `user_id` → 401.
- **Forbidden in `/me`**: `wp_set_current_user`, `apply_filters('determine_current_user', …)`, `get_current_user_id()`/`wp_get_current_user()` for identity, and Pro's bearer bypass. **Why**: core's cookie check runs on `determine_current_user` at priority 10, before Pro's bypass at 20, and Pro's bypass passes an earlier user through unchanged (`wp-oauth-main.php:116-118`). So a valid login cookie plus a junk bearer resolved to the cookie user and returned 200 at 4e0a4b02 (QA `qa/pr29-me3-4e0a4b02.md`, md5 d7dbfd68).
- **Real-user rule (CQ)**: `/me` returns 401 with none of the 4 keys unless `(int)$row['user_id'] > 0` **and** `get_user_by('id', (int)$row['user_id'])` returns a real user. A `client_credentials` token row has no `user_id`, so it gets 401. This single `get_user_by` is the only user lookup; the 4 fields are built from it.
- Response 200, exactly 4 keys: `id` **int** (`(int)` cast), `display_name` string, `avatar_url` string (`get_avatar_url`), `can_moderate` bool, computed with `user_can()` against the token's user ID (via `bsi_content_reports_can_moderate()` given that user), **never `current_user_can`**.
- Headers on every response (200 and 401): `Cache-Control: no-store`, `Vary: Authorization`.
- **Status contract: only 200 or 401.** Missing, malformed, unknown, expired or revoked token → 401 `{"code":"bsi_me_unauthorized"}`. Token valid but user deleted → 401. A login cookie never authenticates `/me`. A 403 or 500 on any bad token is a defect.
- Lockdown: `/bsi/` is a BSI-owned prefix, so `bsi_rest_lockdown_requires_auth` returns false for it (`includes/rest-api-lockdown.php:17-21,92-99`) [code-read]. No X-API-Key (§9 Q2).

| Leg | Setup | Assert | @6f48cfb9 |
|---|---|---|---|
| ME1 | real Pro password grant (fixture user) with the **web** fixture client and, separately, the **app** fixture client; GET /me with each token; repeat for moderator and non-moderator | for both clients: 200; key set === {id,display_name,avatar_url,can_moderate}; `assertSame((int)$uid, $body['id'])` and `assertIsInt($body['id'])`; `assertSame` on can_moderate (true/false cases); both headers present | RED (absent) |
| ME3 (must-fail) | Cookie set **inside each test method only** (`wp_set_auth_cookie` + `$_COOKIE`, cleared in the same method), plus a valid `X-WP-Nonce` for action `wp_rest` created **inside the same method**. Each case first asserts the cookie really validates as user A (cookie + nonce, no bearer → core resolves user A); if that precheck fails the leg fails. Why: without a valid nonce core's REST cookie check drops the cookie user, so the leg would pass with the hole still open. (a) valid login cookie for user A + junk bearer; (b) valid cookie for user A + bearer of user B, revoked first through the live `POST /oauth/revoke` | each exactly 401 (`assertSame(401,…)`), body has none of the 4 keys, both headers present | must be shown RED at 4e0a4b02 as built, with the nonce in place (both) |
| ME2 | (a) no header, (b) garbage token, (c) token with `expires` in the past, (d) token revoked via Pro `/oauth/revoke`, (e) valid unexpired token row with no user (`client_credentials`-style fixture row, `user_id` empty/0) | each exactly 401 (`assertSame(401,…)`), body has none of the 4 keys, both headers present | RED |

## §3 Guard, SC1, halt (K2, K3)
- **Keep unchanged**: exact client-ID guard `bsi_oauth_guard_exact_client_id` (`includes/bsi-oauth-client-allowlist.php:400`), hooked at `:479` (`wo_before_authorize_method`) and `:480` (`wo_before_token_method`), both priority 5; Pro fires them at `library/class-wo-api.php:147,185`. Basic-first read `:296-370`; three-way resolve `bsi_oauth_resolve_client_like_pro` `:166`; `bsi_oauth_halt` `:372` (status_header + nocache_headers + wp_send_json, `:383-391`).
- **SC1 (add)**: inside the guard, after resolve OK. If the resolved post has a non-empty `client_secret` and the request carries none, halt with the existing `invalid_client` reject (Pro allows public clients via `wo_allow_public_clients`, `library/class-wo-api.php:56`, so BSI fails closed for confidential posts itself). When the request carries a client_secret (Basic or body, `class-wo-api.php:55`; **`bsi_oauth_request_client_secret` reads only the Authorization header and the POST body; its `$_GET` branch is removed**, because Pro never reads the secret from the query string): `hash_equals((string) get_post_meta($post_id, 'client_secret', true), $request_secret)`; on false → `bsi_oauth_halt` with the guard's existing `invalid_client` reject. Empty stored secret → existing 500 misconfigured halt. Reason: Pro compares the secret case-insensitively (`library/WPOAuth2/Storage/Wordpressdb.php:65-96`). The resolved post ID comes from `:166`; no new lookup function.
- Legs SC1. (a) and (b) each run **twice: HTTP Basic, and secret in the form body** (so MS2 dies):
| Case | Assert | @6f48cfb9 |
|---|---|---|
| (a) case-changed secret ×2 encodings | `assertSame(BSI_OAUTH_GUARD_REJECT_STATUS, status)`, `error`=`invalid_client`, `bsi_code` present, 0 new `oauth_access_tokens` rows | RED (Pro folds case) |
| (b) trailing-space secret ×2 encodings | same | RED |
| (c) correct secret control ×2 encodings | 200 with token | GREEN |
| (e) secret sent **only in the query string** (`?client_secret=…`), no Basic, no body secret | same as (a) (BSI halt, `bsi_code` present), 0 new rows | RED at 4e0a4b02 if the `$_GET` branch is read |
| (d) **no secret at all** (no Basic, no `client_secret` field), confidential fixture client | same as (a) (the BSI halt, `bsi_code` present), 0 rows | RED (Pro answers itself, no `bsi_code`) |
- **Moved onto /oauth/token (must-fail, unchanged assertions)**: L18e (`tests/test-bsi-oauth-client-guards.php:146`, Basic variant `:210`) and L18i (`:303`) each run **with Basic and with form-body credentials** (Pro accepts the body, `class-wo-api.php:55`); L18i adds a Basic variant if it has none. Also L18d-t (`:338`), RO1 (`:405`). RO2 unchanged (unrun until billing returns). All GREEN at head.

## §4 Refresh rotation (K4)
- Pro defaults (`wp-oauth-main.php:37,42-43`): `refresh_tokens_enabled` off, refresh lifetime 86400 s, access lifetime 3600 s; read into config at `library/class-wo-api.php:47-48`, refresh grant enabled at `:90`. Admin fields: `includes/admin/page-server-options.php:181-192`.
- Rotation knobs exist as filters: `wo_always_issue_new_refresh_token` and `wo_unset_refresh_token_after_use` (`library/class-wo-api.php:57-58`), consumed by `library/WPOAuth2/GrantType/RefreshToken.php:98-99` (defaults `:25-45`). Pro ships "issue new" on and "unset old" off, which is why QA saw no rotation.
- **In PR 29 (Lead ruling).** Hook `wo_unset_refresh_token_after_use` (`class-wo-api.php:58`) to `__return_true` in the BSI OAuth include. `:57` (`wo_always_issue_new_refresh_token`) already defaults to issuing a new refresh token, so it is left alone.
- **RF1** (must-fail): one password grant, then refresh with refresh token R0 → 200 with new R1, `assertNotSame(R0, R1)`. Then refresh again with **R0** → Pro's `invalid_grant` (`RefreshToken.php:63`), status read live in the same run (§9 Q7) and compared with `assertSame`, 0 new access-token rows. Then refresh with R1 → 200. **RED at 6f48cfb9** (R0 still works).
- **L-ME1 (lint)**: scoped **only** to `includes/bsi-rest-me.php` (five other includes legitimately use these calls). Fails if the file contains `wp_set_current_user` or `determine_current_user`. Plant: add one of those calls → red.
- **L-ROT1 (lint)**: fails unless `add_filter('wo_unset_refresh_token_after_use', '__return_true')` is registered exactly once in `includes/`. Plant: delete the line → red.

## §5 /auth/login, L-RDM2, RD-M2
- `/auth/login` is unchanged and app-only: route `includes/app-password-auth-rest.php:202-211`, API key `:19-21` (`bsi_require_api_key`), policy/lockout `:27-92`, grant `:99`, app lock `bsi_oauth_require_auth_login_client` (`includes/bsi-oauth-client-allowlist.php:266`). Its policy, lockout and email refusal still apply there.
- **AL1** (must-fail, GREEN): web client_id on `/auth/login` → existing reject (`:287`, 401), 0 token HTTP calls, 0 rows.
- **RD-M2 and L-RDM2 stay** and cover `/auth/login` only. Email login on `/oauth/token` is accepted by ruling (Pro `Wordpressdb.php:674-675`); add no leg for it.
- The app lock keeps reading option `bsi_oauth_app_client_id` (`:63-70`). The `web` map entry goes (§7).

## §6 Leg summary
| ID | Path | Kind | @6f48cfb9 |
|---|---|---|---|
| ME1, ME2 | bsi/v1/me | new | RED |
| SC1 (a)(b)(d)(e), (c) control | /oauth/token | new | RED (a)(b)(d)(e) |
| RF1 | /oauth/token refresh | new (in PR 29) | RED |
| L-ROT1 | lint | new | RED |
| ME3 | bsi/v1/me | new must-fail | RED at 4e0a4b02 |
| L-ME1 | lint | new | RED at 4e0a4b02 |
| HP1 | /oauth/token | new parity (§9 Q7) | GREEN on status if constant stays 400 for invalid_client |
| L18e, L18i (Basic + body), L18d-t, RO1 | /oauth/token | kept must-fail | GREEN |
| RO2 | /oauth/token | kept | unrun |
| AL1, RD-M2 | /auth/login | kept must-fail | GREEN |
No leg may accept "400 or 401": every status assert is `assertSame` against one value (a live-read value for HP1/RF1, the shared constant for guard legs).

## §7 Dead at 6f48cfb9 → remove
| Item | Cite |
|---|---|
| web-login route + file | `includes/bsi-weblogin.php` (all) |
| web map entry, option `bsi_oauth_web_client_id`, slug `metfix_web_oauth_client_secret` | `includes/bsi-oauth-client-allowlist.php:74-80` (+ misconfig `web` branch near `:89-98`) |
| `bsi_oauth_client_secret_for` non-app branch (per-slug resolve + filter) | `:141-147`; app branch `:138-140` stays (used by `/auth/login`) |
| route constant `BSI_OAUTH_ROUTE_WEB_LOGIN` uses | allowlist `:74-80`, `bsi_oauth_require_client_route` `:216` web callers |
| WS1 tests | `tests/test-bsi-weblogin-rest.php:788-856` (WS1, WS1 control), W11a `:764` |
| web-map guard test | `tests/test-bsi-oauth-client-guards.php:75` |
| `bin/bsi-oauth-ro1-cli.php` web-option reads | per rev2 `:54-55,68` |
- **WS1-app stays**: the empty-secret fail-closed at `includes/app-password-auth-rest.php:106-115` protects `/auth/login`. Add a WS1-app leg if not already present.

## §8 Accepted by ruling (risks, not legs)
1. **Email login on /oauth/token** partly undoes PR 28 there: Pro resolves an email to a user (`Wordpressdb.php:674-675`). PR 28 holds only on `/auth/login`.
2. **RF2: a user disabled or locked after login keeps refreshing** until the refresh token expires (86400 s default, `wp-oauth-main.php:42`). The refresh grant never checks the password or BSI policy (`RefreshToken.php:60-70` checks only token existence/expiry).
   - **Rotation does NOT close RF2.** With the §4 hook (`class-wo-api.php:58`) a disabled user just gets a fresh refresh token on every rotation.
   - **Only a shorter refresh lifetime caps the window.** It is a Pro setting (`refresh_token_lifetime`, `wp-oauth-main.php:42`; admin `page-server-options.php:191-192`). **Ethan's call: keep Pro's default 86400 s.** RF2 stays an accepted risk; no follow-up is planned.
3. **Worker secret holders can run password grants with no captcha**: captcha and rate limit are Worker-only.
4. **No lockout on Pro's grant**: Pro checks the password itself (`Wordpressdb.php:440-455`, `:642-648`), so BSI's per-username lockout never runs there.
5. **Pro's case-insensitive secret match** (`Wordpressdb.php:65-96`) is accepted by Ethan with no extra work. SC1 stays exactly as written and built; nothing is added beyond it.
6. Missing `grant_types` meta → Pro 500 TypeError (QA rerun), which the Worker maps to 503. Mitigated only by checklist §10.

## §9 Worker contract (Web Lead, spec 1.6.8)
- **Q2 X-API-Key** [code-read]: **not required on either.** `/oauth/token` is a Pro rewrite endpoint (`library/class-wo-api.php`, method dispatch; discovery lists `/oauth/token/` at `:344`), not REST, so BSI's REST lockdown (`rest_pre_dispatch`, `includes/rest-api-lockdown.php:224`) never sees it. BSI's API key is per-route `permission_callback` only (e.g. `/auth/login`, `app-password-auth-rest.php:19-21`); `/me` will not use one. `/bsi/` is exempt from lockdown (`rest-api-lockdown.php:17-21,92-99`). Caveat: Pro's "block all unauthenticated REST" setting (`wp-oauth-main.php:77,144-153`) can return 401 on `/me` without a bearer; that is still 401, inside the contract.
- **Q3 token URL + encoding** [code-read]: path `/oauth/token` (BSI `includes/bsi-oauth-client.php:17-20`, `home_url('/oauth/token')`; Pro discovery `/oauth/token/`, `class-wo-api.php:344`). Body `application/x-www-form-urlencoded`: `grant_type=password&username&password` or `grant_type=refresh_token&refresh_token`; client creds via HTTP Basic (preferred; BSI reads Basic first, allowlist `:296-370`) or body (Pro allows body, `class-wo-api.php:55`). Do not send both with different IDs (L18n halts). **Hosts: not in repo config** (none found at 6f48cfb9). Prod is brokenscience.org. **Staging host: brokenstaging.wpengine.com** (from Ethan via CEO).
- **Q6 revoke on logout** [code-read]: `POST /oauth/revoke` (`class-wo-api.php:159`, discovery `:348`), form body `token=…&token_type_hint=refresh_token|access_token`. **No client secret required**: the revoke path checks method, hint and token presence only (`library/WPOAuth2/Controller/TokenController.php:276-332`; 405 non-POST, 400 bad hint/missing token), and returns 200 `{"revoked":true}` even for unknown tokens. Worker should revoke the refresh token, then the access token. Note: BSI's guard does not run on revoke (only token/authorize hooks).
- **Q7 statuses** [code-read]: Pro on `/oauth/token`:
  - `invalid_client` → **400** (`library/WPOAuth2/ClientAssertionType/HttpBasic.php:58,64,69,129`).
  - `invalid_grant`, wrong username/password → **401** (`GrantType/UserCredentials.php:40`); user info missing → 400 (`:48`); bad/expired refresh token → **400** (`GrantType/RefreshToken.php:63,69`).
  - Halt: `BSI_OAUTH_GUARD_REJECT_STATUS = 400`, `BSI_OAUTH_GUARD_REJECT_BSI_CODE = 'invalid_client'` (`bsi-oauth-client-allowlist.php:27,32`), shared by RO1/L18e. **400 matches Pro's invalid_client, so no constant change is proposed.** The halt only ever emits `invalid_client` (or 500 misconfigured), never `invalid_grant`.
  - Body difference: halt sends `{error, error_description, bsi_code}` (`:385-391`); Pro sends `{error, error_description}` (+ optional `error_uri`). **Lead ruled: keep `bsi_code`; the N4.0.5 condition stands.** Parity (HP1) is on status and `error` only.
  - Worker mapping: 401 `invalid_grant` → bad credentials; 400 `invalid_grant` on refresh → re-login; 400 `invalid_client` → 503 (config); 5xx → 503.
  - **HP1 parity leg**: same run, (a) Pro-native `invalid_client` (unknown-but-exact client with wrong secret, guard passes) and (b) Pro-native `invalid_grant` (wrong password, valid client) via live `/oauth/token`; record status and `error`. Then (c) a halt-triggering request (case-changed client_id). Assert `assertSame(status_a, status_c)` and `assertSame('invalid_client', error_c)`; assert (b)'s live status equals the status the Worker contract documents for invalid_grant. No hardcoded Pro numbers. If Pro's status ever differs, only `BSI_OAUTH_GUARD_REJECT_STATUS` changes.
- **Q8 /me** [code-read, decided here]: statuses **200 or 401 only**; 403/500 on a bad token is a defect. `id` is **int**, `(int)` cast, ME1 checks with `assertSame`.

## Mutants (advisory, no floor, never blocking)
| ID | Change | Killed by |
|---|---|---|
| MM1 | /me reads token without expiry check | ME2(c) |
| MM2 | /me returns `id` as string | ME1 |
| MM3 | /me falls back to the `determine_current_user` filter chain | ME3, L-ME1 |
| MM4 | /me drops `Vary` (was MM3) | ME1/ME2 |
| MS1 | SC1 uses `strcasecmp`/`==` | SC1(a) |
| MS2 | SC1 skipped for one encoding (Basic or body) | SC1 (a)/(b) other-encoding run |
| MS3 | SC1 skips the check when no secret is sent | SC1 (d) |
| MR1 | rotation filter removed | RF1, L-ROT1 |
| MH1 (existing) | kept | L18e |

## §10 Ethan's wp-admin checklist (OAuth Server → Clients / Settings)
1. **CLOSED (Ethan confirmed the config).** Third (web) client is **confidential** (secret set) with grant types **explicitly** set to `password`, `refresh_token` AND `authorization_code` (Google sign-in uses `authorization_code`; do not remove it). Missing grant_types → Pro 500.
2. App client: no `client_credentials`, no `implicit`; record its grants.
3. Token lifetimes: access (default 3600 s); refresh tokens **enabled** (default off, `wp-oauth-main.php:37`). **Refresh lifetime** (`wp-oauth-main.php:42`): confirm the default 86400.
4. Rotation ships in PR 29 as a code hook (§4); confirm no wp-admin setting overrides it.
5. "Block all unauthenticated REST requests" setting state (affects §9 Q2 caveat).

## §11 Build notes (must confirm before the build is signed)
- **B1: resolved (rev1.2).** `/me` uses `wo_public_get_access_token` only (§2). The bearer-hook fallback is removed.
- **B2 (was OQ6)**: confirm whether `bsi_rest_resolve_bearer_user_id` reads `oauth_access_tokens` with its own SQL. If it does, `/me` must not use it; use B1. Report file:line.

## Open questions
1. Staging host for the Worker: closed, brokenstaging.wpengine.com (§9 Q3).

## Changelog (rev1.2 f1356074 → rev1.3)
- N0: rows for Ethan's calls, CQ's /me real-user rule, QA's ME3 nonce condition.
- §8 RF2: Ethan keeps Pro's default 86400 s; RF2 stays accepted. Follow-up F1 (revoke on disable) dropped entirely.
- §8: new item 5, Pro's case-insensitive secret match accepted with no extra work; SC1 unchanged (already built). Old item 5 renumbered 6.
- §10 item 3: refresh lifetime check is now "confirm the default 86400".
- §2: /me returns 401 (none of the 4 keys) unless `(int)$row['user_id'] > 0` and `get_user_by('id', …)` finds a real user; that is the only lookup. `can_moderate` uses `user_can()` with the token's user ID, never `current_user_can` (CQ).
- §2 ME2: new case (e), a token row with no user gets 401 (CQ).
- §2 ME3: (a) and (b) each send a valid `wp_rest` X-WP-Nonce created in the test method, first assert the cookie validates as user A, and must be shown red at 4e0a4b02 as built. Rationale: without a nonce core drops the cookie user, so the leg would pass with the hole open (QA).

## Changelog (rev1.1 6dfb702e → rev1.2)
- N0: rows for the /me resolution rule, ME3, L-ME1, SC1 (e), MM3; §11 row shows B1 resolved.
- §2: `/me` resolves the user only via `wo_public_get_access_token(wp_oauth_get_authentication_token($_SERVER))` (Pro `public.php:27,39-40`, `functions.php:701`) and the token's `user_id`. The bearer-hook / `determine_current_user` fallback, `wp_set_current_user`, the duplicate `get_user_by` and its 401 branch are removed. The rationale is the cookie-at-priority-10 pass-through (`wp-oauth-main.php:116-118`) that gave 200 for cookie + junk bearer at 4e0a4b02.
- §2: new must-fail leg ME3 (a) cookie + junk bearer, (b) cookie + another user's bearer revoked via live `/oauth/revoke`; exactly 401, none of the four keys; the cookie is set inside each test method only. Red at 4e0a4b02 (QA `qa/pr29-me3-4e0a4b02.md`, d7dbfd68).
- §4/§6: new lint L-ME1, scoped only to `includes/bsi-rest-me.php` (`wp_set_current_user`, `determine_current_user`); plant = add one call.
- §3 SC1: the `$_GET` branch of `bsi_oauth_request_client_secret` is removed; new leg (e) query-string secret → halt, 0 rows.
- Mutants: new MM3 (/me falls back to the filter chain; killed by ME3, L-ME1); the old MM3 (drops `Vary`) is renumbered MM4.
- §11: B1 resolved; B2 still must-confirm.

## Changelog (rev1 fa04d9df → rev1.1)
- N0 updated with the new rows.
- §2 ME1: also run with an app-client token; same four keys, int `id` (`assertIsInt` + `assertSame`) (QA 2).
- §3 SC1: (a)/(b) run with Basic and with form-body secret (QA 1); new (d) no-secret leg; the guard halts a confidential client that sends no secret, citing public clients `class-wo-api.php:56` (CQ).
- §3 L18e/L18i: Basic and form-body variants, `class-wo-api.php:55` (CQ).
- §4: rotation is in PR 29 (Lead), via the `:58` filter → `__return_true`; `:57` is untouched (CQ). RF1 now asserts the OLD refresh token gets `invalid_grant` after one use; RED on main. New lint L-ROT1.
- §6 leg table and mutants updated (MS2 reworded, MS3 added, MR1 also killed by L-ROT1).
- §7: L-SECRET1 removed (never existed, Lead).
- §8 RF2: 86400 s (`wp-oauth-main.php:42`) is the accepted window unless Ethan picks shorter (CQ).
- §9 Q3: staging host pending from Ethan via CEO. Q7: `bsi_code` kept, N4.0.5 stands (Lead).
- §10 item 3: refresh lifetime choice; item 4: rotation is a code hook.
- §11 new: old OQ4 and OQ6 became must-confirm build notes B1/B2, with the bearer-hook fallback.
- Open questions reduced to the staging host.

## Changelog (rev1.3 → rev1.4)
Wording only; no leg, lint, mutant or code requirement changed.
- §10 item 1: web client grants are `password`, `refresh_token` and `authorization_code` (Google sign-in); marked closed, confirmed by Ethan.
- §9 Q3 and open question 1: staging host is brokenstaging.wpengine.com; closed.
