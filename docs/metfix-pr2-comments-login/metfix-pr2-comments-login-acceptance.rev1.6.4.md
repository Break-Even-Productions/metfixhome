# metfixhome PR2 (#2): Daily Fix comments and login, acceptance spec, rev 1.6.4

> **1.6.0/1.6.1 scope rev (2026-10-20):** web-login ships in PR2 (ruled by MetFix Web Lead, 2026-10-20; Ethan's ruling relayed via CEO, scope: web-login ships in PR2). 1.6.1: `X-MFX-Client-IP` dropped and the never-forward-IP rule stands unchanged (ruled by MetFix Web Lead, 2026-10-20); BSI-side PKCE and refresh-token rotation deferred (Ethan's deferral relayed via CEO and MetFix Web Lead, 2026-10-20). §0s wins over every earlier section where they differ.
>
> **1.6.2 (2026-10-20):** BSI-C10 contract locked by BSI Lead in the MetFix Web Build room, 2026-10-20; ruled by MetFix Web Lead. §0s.11 locks the BSI-C10 details and the single BSI client module.
>
> **1.6.3 (2026-10-20, wording only):** ruled by MetFix Web Lead, 2026-10-20 (QA 1.6.2 points). Login order: R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10. Worker clamps `Retry-After` (§0s.12).
>
> **1.6.4 (2026-10-20):** ruled by MetFix Web Lead, 2026-10-20 (CQ delta 1.6.2); item 4 CEO accepted (relayed). §0s.13 addresses CQ's delta report `metfix-pr2-cq-spec-delta-1.6.2.md` (md5 `fdb03c29…`).

> **1.5.0 scope rev (2026-10-20):** Web Lead unfroze PR2 for a scope rev on 2026-10-20 (still pre-round-1). §0p carries the five scope decisions, each relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT. §0p wins over every earlier section where they differ. The freeze (D3) applies again once CQ confirms 1.5.0; after that, any change needs Web Lead's ruling first. QA re-cuts the list after CEO has seen the size impact (§0p.9).
>
> **Frozen (D3, Web Lead ruling 2026-10-19; history up to 1.4.25):** once CQ re-confirms 1.4.25, this rev is frozen (1.4.25 is a post-freeze change allowed by Web Lead's 2026-10-19 ruling (b) on CQ pin check 7 B1: `.fixture` suffix, a run-not-reasoned tsc/check:worker acceptance, a TK2.x anchoring row, corrected counts; 1.4.24 is a post-freeze change allowed by Web Lead's 2026-10-19 follow-up ruling: committed TK2.m7 fixtures, merged main = the handoff SHA, R-A evidence scope, stale `.map` wording struck; 1.4.23 cut for three corrections to §0l: TK2.m7 line, no pre-merge fixture, TK1 scans dist as shipped; 1.4.22 cut to close CQ pin check 5 B1 (TK2.m fixture includes #7) and B2 (TK1 redesigned for #10's guard), with N1/N2 as review items; 1.4.21 cut to add the odd real-use forms Web Lead's ruling (b) requires to TK2; 1.4.20 cut to restore TK2 real-use matching with extended forms after CQ withdrew the worker/ point; 1.4.19 cut to replace TK2's real-use matching with a literal-anywhere scan plus one exact-line exception; 1.4.18 cut under Web Lead's 2026-10-19 ruling option (a): RS-A1 leaves `npm test` for the gate's scope step, plus the TK2 fix; 1.4.17 cut under Web Lead's 2026-10-19 ruling on the ls-remote freshness check for RS-A1, with QA list PR2 1.6 items; 1.4.16 cut under Web Lead's 2026-10-19 ruling on main's history for RS-A1; 1.4.15 cut under Web Lead's 2026-10-19 rulings R-A/R-B); any change needs Web Lead's ruling first. QA list: the QA list whose header pins this spec's md5 (D1); Web Lead's handoff names its rev and md5 and is authoritative.

> **PR shape (1.4.6, G2):** Decided: one PR (Ethan Oct 13 and 15; re-asked Oct 19), relayed via MetFix CEO (Ethan's standing rule on CEO-relayed decisions, as relayed by Web Lead 2026-10-15; Web Lead restated 2026-10-19). E-R9 is reported closed by Web Lead quoting Ethan ("Decisions MetFix CEO Relays count as mine", 2026-10-20 8:27 AM PT); awaiting Ethan's direct confirmation in my chat. CQ has asked Ethan directly; if he answers otherwise, this reopens.
>
> **Scope:** #2 delivers **real login and account creation** (email/password and Google) plus comments, leaderboards and posting. Everything goes through the same-origin Worker; no secrets in the client; the browser never calls BSI. It shows existing comments and leaderboards (leaderboards signed-in only, N8 default), requires login to comment, and posts comments through the metfixhome Worker with reCAPTCHA v3 verified on the server (the secret is a Worker secret only). §5 is merge-gating.
>
> **Dependency:** a matching BSI PR for the sign-in and posting routes (BSI's comment API is read-only for this use, as relayed). The local BSI checkout `d3234a5` has a POST callback near `daily-fix-apis.php:1691-1699` (F7, F9); BSI Lead to confirm whether that route is usable or a new one is needed (Q-BSI-7).

- Repo: Break-Even-Productions/metfixhome. PR #2, branch `cursor/daily-fix-comments-ce2c`, head **`3a721dcc`** (`3a721dccd0c9d2e901bce39640076461612ab6e6`, "comment UI changes", Ethan's push 2026-10-19 7:16 PM PT). Re-anchored in 1.4.1; earlier cites to `3470e50c` are historical.
- Main at time of writing: `9f7129d7` (#1, which added `worker/`). At `3a721dcc` the merge base with main **is** `9f7129d7` (12 ahead, 0 behind; GitHub compare, read 2026-10-19).
- #3 (posts) is **not** stacked on #2 (W5-R, Web Lead): #2 and #3 both target main and are independent.
- Date: 2026-10-19. Author: MetFix Web Spec. BSI cites for §5 are at `d3234a50`.

## 0. Provenance (historical, 1.3 rebuild; superseded by §0a.1 for code facts and §10 for backups)

**This rev is a REBUILD. It is not derived from a byte-exact 1.2.3.**
- Contract rev 1.2.3 (md5 `21046387…`) was lost in the box rollback. Searches that found nothing:
  - `/workspace/specs`, `/workspace/specs/recovered`, and every `*.md` on the box, checked by md5 prefix `21046387`.
  - #2's tree at `3470e50c`. #2 commits **no** docs: its diff against main touches only `client/**`, `package.json` and `package-lock.json`.
  - #2's 10 commit messages, `77c6207` through `3470e50`.
- No older PR2 rev survives on the box either, so there are no backups to keep.
- Rebuilt from four sources:
  1. #2's branch code at `3470e50c`.
  2. main `9f7129d7` `worker/`.
  3. BSI `wp-content/plugins/bsi/daily-fix-apis.php`, at local checkout `d3234a5`, 2026-10-13.
  4. The 1.2.x locked items as relayed by Web Lead from memory (§3). Wherever the code contradicts one of those, it is flagged ⚠.
- The md5 of this file differs from 21046387 by construction. Item IDs B4, O6, Q5a, Q19a, Q24a, G5, G6 and G7 keep their 1.2.x names. Every other ID is new in 1.3 and may not match 1.2.3 numbering.

## 0s. Rev 1.6.0: web-login ships in PR2 (2026-10-20). Read first; wins over §0r, §0q, §0p and every earlier section where they differ. Every other security rule stays in force. E-R9's text is unchanged.
Rulings in this section: **ruled by MetFix Web Lead, 2026-10-20; Ethan's ruling relayed via CEO, scope: web-login ships in PR2.** 1.6.1 changes are ruled by MetFix Web Lead, 2026-10-20 (§0s.5, A-T38, accepted defaults) and Ethan's deferral relayed via CEO and MetFix Web Lead, 2026-10-20 (§0s.10). No security rule exception remains.

### 0s.1 Password login calls only BSI web-login (BSI-C10)
- **Every `/auth/login` (BSI-C1) path is removed from PR2.** The Worker's password login (`POST /api/auth/login`) calls only **`POST /wp-json/bsi/v1/auth/web-login`** (BSI-C10, §0s.7). No Worker code path, fallback, retry or feature flag calls `/wp-json/bsi/v1/auth/login`. BSI-C1 is retired as a PR2 dependency (text kept in §5b for history, struck).
- Order (1.6.3): **R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10** (reCAPTCHA is now verified inside BSI-C10; see §0s.3). Replaces R25's login order (§0b.2) for login only. Signup and comment orders are unchanged.
- **Kept (ruling 3):** the per-client secret dependency (BSI-C8: confidential metfix.org WP OAuth client, secret stays in BSI) and the **dedicated metfix.org `client_id`**, sent in the web-login body. The Worker never holds or sends the client secret.
- Every earlier mention of "BSI-C1", "`/auth/login`" or "`/bsi/v1/auth/login`" as the Worker's login call (§0r.1, §0p.7 BSI-CM6 row, §0b.2, §5.1, §5a AU2, §5b, §6 A-T10, §8 WT13) reads as BSI-C10. `can_moderate`, `user_id` and `public_name` on login now come from the BSI-C10 200 body; on refresh and code exchange still from BSI-C3 (§0r.1 otherwise unchanged).

### 0s.2 Contract (BSI-C10, posted to BSI Lead by Web Lead)
- **Request:** `POST /wp-json/bsi/v1/auth/web-login`, JSON body key set exactly `{username, password, client_id, recaptcha_token}`. `username` = the browser's `identifier`; `client_id` = the dedicated metfix.org client id from Worker config (never from the browser); `recaptcha_token` = the browser's `recaptcha` value, byte-exact (§0s.3).
- **Headers:** exactly the W5 set (`X-API-Key`, `Accept: application/json`, `User-Agent: metfixhome-worker/1.0`) + `Content-Type: application/json`. No `Authorization`, no Cookie, and no IP header of any kind (T2 unchanged; 1.6.1). BSI throttles web-login per username and per client; the Worker's own per-IP R8b limit is the per-user guard.
- **200:** the contracted body (BSI Lead ruling, 1.6.2; `/auth/login` is unchanged and not used): `access_token`, `refresh_token`, `expires_in`, `token_type`, `user_id`, `public_name`, optional `member_id`, strict boolean `can_moderate` (non-boolean or absent → `false`, CW12.2 rule unchanged).
- **Errors:** 400 `missing_fields`; 400 `recaptcha_missing`; 403 `recaptcha_failed` (one generic code for score, action and hostname failures); 403 `client_not_allowed`; 401 `invalid_credentials`; 403 `login_disabled`; 429 `rate_limited` with `Retry-After`; 500 `oauth_misconfigured`; 502 `oauth_upstream_error`.

### 0s.3 Login reCAPTCHA is verified by BSI, not the Worker
- The Worker forwards the browser's login token **unverified and byte-exact** as `recaptcha_token` (no trim, no re-encode, no normalisation). Tokens are single-use, so the Worker makes **0 `siteverify` calls on login**. Same v3 key (D-3 domains), action `login`; BSI checks score, action and hostname.
- **Accepted by Web Lead (1.6.1):** the Worker keeps only a shape check that does not consume the token: `recaptcha` must be a non-empty JSON string, else 400 `{"error":"invalid_request"}`, 0 BSI (counts as one R8b attempt; not R8a). It runs after R8b and before R8c, so it takes no R8c slot (1.6.3).
- **Signup and comment posting are unchanged:** the Worker still calls `siteverify` itself (action `signup` / `comment`, `hostname === "metfix.org"`, threshold 0.5, AU18, AU18.h, N5).
- **Rows updated (login part only; signup/comment parts unchanged):**
  - §0b.1 **N5**: login no longer runs Worker siteverify; a BSI 403 `recaptcha_failed` (or 400 `recaptcha_missing`) → 403 `try_again`, body byte-identical to the signup/comment body.
  - **R8b counting (§0b.1 N5, Q5 row 5, judgment call 4):** a BSI 403 `recaptcha_failed` or 400 `recaptcha_missing` **counts as one R8b attempt** for that IP. It does **not** count toward R8a (not an identifier failure). It **did** take an R8c slot (a BSI call was made; R8c counts BSI calls). Every login request that reaches the DO is counted once in R8b whatever the outcome; no outcome counts twice.
  - **Q18 / judgment call 4 (siteverify outage):** not applicable to login. A BSI 5xx or timeout on web-login → 503 `unavailable`, `Retry-After: 300`, not counted toward R8a; it is still one R8b attempt (counted on entry) and one R8c slot.
  - §0b.2 **R25**: login order is now R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10 (1.6.3). The §0b.2 bullet "siteverify before R8c" and its residual no longer apply to login.
  - §0p.3 **AU18.h** and the "Worker is stricter than the key" bullet: apply to signup and comment only. For login the hostname check is BSI's (BSI-C10 must accept only `metfix.org`-minted tokens for the metfix.org client; listed in §0s.7).
  - §5.4 reCAPTCHA bullet, §5a **AU18**, §6 **T9**, §8 **WT13**: "verified server-side on login" → login verified by BSI (AU26.2); signup/comment verified by the Worker.
  - S-G18 / Q3 "0 siteverify": still holds (login never calls siteverify).
- **A-T38 (ruled by MetFix Web Lead, 2026-10-20, 1.6.1):** the per-IP R8b limit is applied **before** the site-wide R8c cap, so one IP can spend at most its own 20/60 s quota of R8c slots on bad tokens (AU26.6). The remaining many-IP fill (≥2 IPs at 20/60 s each can still fill R8c's 25/60 s with bad tokens) is an **accepted residual**. No `remoteip` is sent to siteverify (signup/comment).

### 0s.4 Worker → browser mapping for web-login (fixed bodies; never says which check failed)
| BSI-C10 outcome | Browser | Counters |
|---|---|---|
| 200 | 200 `{signed_in:true, public_name}` + new `__Host-mfx_sid` (AU2) | clears R8a for the identifier (Q17) |
| 400 `missing_fields` | 400 `{"error":"invalid_request"}` | R8b |
| 400 `recaptcha_missing` | 403 `{"error":"try_again"}` "Something went wrong. Please try again." | R8b only |
| 403 `recaptcha_failed` | 403 `{"error":"try_again"}` (same bytes) | R8b only (one attempt) |
| 401 `invalid_credentials` | 401 `{"error":"invalid_login"}` "Email/username or password is incorrect." | R8a + R8b |
| 403 `login_disabled` | 401 `{"error":"invalid_login"}` (byte-identical to the row above; A-T8, AU16) | R8a + R8b |
| 403 `client_not_allowed` | 503 `{"error":"unavailable"}`, `Retry-After: 300` (**accepted by Web Lead, 1.6.1**; config fault; logged as `bsi_client_not_allowed` with no secrets) | R8b |
| 429 `rate_limited` (either source, §0s.11 (b); mapped identically) | 429 `{"error":"rate_limited"}` with BSI's `Retry-After` clamped by the Worker (integer seconds only, at most 600; missing, invalid, non-integer or HTTP-date → 60) | R8b |
| 500 `oauth_misconfigured`, 502 `oauth_upstream_error`, other 5xx, timeout (5 s), bad JSON, unknown code or status | 503 `{"error":"unavailable"}`, `Retry-After: 300` (R21) | R8b |
| 401 `forbidden` (missing or wrong `X-API-Key`; HTTP 401, code `forbidden`, body `{code:"forbidden", message, data:{status:401}}`, returned before any rate counter (BSI `functions.php:4360-4362`; cited by BSI Spec, locked by BSI Lead)) | 503 `{"error":"unavailable"}`, `Retry-After: 300`. **Branch on the code, not the status:** 401 `invalid_credentials` → 401 `invalid_login`; 401 `forbidden` → 503; any other 401 code → 503. | R8b |
- The client honours the Worker-clamped `Retry-After` with the existing **600 s cap** (kept) and shows the remaining time (§0r.2, CW13.3 rule applied to the sign-in button).
- Distinct upstream codes never change the body, a header other than `Retry-After`, or the status beyond this table. BSI's error text is never relayed (W6). This replaces R21's "BSI 429 → 60" for login only.

### 0s.5 No forwarded-IP header (1.6.1, ruled by MetFix Web Lead, 2026-10-20)
- `X-MFX-Client-IP` is dropped entirely; 1.6.0's exception is withdrawn. The never-forward-IP rule (T2, WT2) stands unchanged on every route, including web-login: no `X-Forwarded-For`, `X-Real-IP`, `True-Client-IP`, `Forwarded`, `CF-Connecting-IP` or any other IP header goes upstream, and no `remoteip` goes to siteverify. BSI throttles web-login per username and per client; the Worker's per-IP R8b is the per-user guard.

### 0s.6 New CI IDs (each with a mutation)
- **AU26.1 (no /auth/login, scan).** Repo scan of `worker/**` (excl. `*.test.ts` and `*.fixture*`) for `auth/login` as a BSI path (`/bsi/v1/auth/login`, `'/auth/login'` built from `bsi/v1`, any string join ending in `auth/login` with no `web-` before it) → 0 hits; plus a runtime test: every login outcome in §0s.4 records 0 requests to any URL whose path ends `/bsi/v1/auth/login`, and exactly 1 to `/bsi/v1/auth/web-login` (0 when rejected before BSI). — **M-WL1**: add a fallback that calls `/auth/login` when web-login returns 5xx → red {AU26.1}.
- **AU26.2 (token forwarded byte-exact; 0 siteverify on login).** Tokens with leading/trailing spaces, `+`, `/`, `=`, `-`, `_`, unicode and a 2,000-char value → the BSI body `recaptcha_token` equals the browser value byte-for-byte; body key set exactly `{username,password,client_id,recaptcha_token}`; `client_id` from config even when the browser sends one; across every §0s.4 outcome the siteverify mock records **0** calls on login (and still 1 on signup and comment). — **M-WL2**: the Worker calls siteverify on login before forwarding → red {AU26.2}; **M-WL3**: the Worker `trim()`s the token → red {AU26.2}.
- **AU26.3 (error mapping, every code).** One case per §0s.4 row (1.6.2: incl. BSI 401 `forbidden` (bad `X-API-Key`) → 503 `unavailable`, `Retry-After: 300`) → exact status, exact body bytes, `Retry-After` value, and the counter effects in the table; `recaptcha_missing` and `recaptcha_failed` bodies byte-identical to each other and to signup/comment `try_again`; `invalid_credentials` and `login_disabled` byte-identical; BSI 429 `Retry-After: 17` → 17; `600` → 600; `99999` → 600 from the Worker (clamped) and the client disables sign-in for 600 s; missing, `abc`, `0`, `1.5`, `-3`, `1e30`, a 30-digit value and an HTTP-date → 60 (1.6.4: integers above 600 clamp to 600; non-integer forms → 60). — **M-WL4**: map `recaptcha_failed` to `{"error":"recaptcha_failed"}` → red {AU26.3}; **M-WL5**: map `login_disabled` to 403 → red {AU26.3, AU16}; **M-WL6**: replace BSI's Retry-After with 60 → red {AU26.3}; **M-WL7**: map `client_not_allowed` to 403 `forbidden` → red {AU26.3}.
- **AU26.5 (R8b counting with BSI reCAPTCHA).** Mocked `LOGIN_THROTTLE` DO: 20 web-login requests from one IP each answered by BSI 403 `recaptcha_failed` → 20 R8b attempts, 0 R8a failures, 20 R8c slots; the 21st → 429 from R8b, 0 BSI (order per §0s.1: R8a → R8b → shape check → R8c → BSI). — **M-WL11**: count `recaptcha_failed` toward R8a → red {AU26.5}.
- **AU26.6 (R8b before R8c, 1.6.1).** Mocked `LOGIN_THROTTLE` DO, one IP, 30 web-login requests in 60 s, each answered by BSI 403 `recaptcha_failed` → exactly 20 BSI calls and 20 R8c slots taken; requests 21–30 → 429 from R8b with 0 R8c slots and 0 BSI calls (R8b and the shape check both run before R8c); a second IP then still gets the remaining 5 R8c slots. — **M-WL12**: check R8c before R8b → red {AU26.6}.
- **AU26.7 (both 429 sources identical, 1.6.2).** BSI-C10 mock returns 429 `rate_limited` once as the key ceiling and once as the per-username limit (distinguished only by mock-internal labels, any BSI message text and the same `Retry-After: 17`) → the two client responses are byte-identical (status, body, every header incl. `Retry-After: 17`); `99999` → 600 and missing/`abc`/HTTP-date → 60 for both (Worker clamp). — **M-WL13**: map the key-ceiling 429 to 503 `unavailable` → red {AU26.7}.
- **AU26.8 (single BSI client module, scan, 1.6.2).** Repo scan of `worker/**/*.ts` excluding `*.test.ts`, `__fixtures__/**` and `worker/upstream.ts`: 0 `fetch(` calls whose URL references the BSI base (the configured BSI base URL as used by `upstream.ts`'s `${base}`, `brokenscience.org`, `brokenstaging.wpengine.com`) or any `/wp-json` path, and no `/wp-json` string literal. `worker/upstream.ts` has ≥1 hit (vacuity check). The scan prints the files it scanned. The scan is backed by a **runtime check (1.6.4):** in the AU26.1/AU26.3 runtime tests `upstream.ts` receives an injected `fetch` and base URL; the number of requests to the BSI host equals the number of `upstream.*` calls, and `globalThis.fetch` sees 0 BSI-host requests. `worker/upstream.ts` takes `fetch` and the base URL as parameters (no module-level `fetch`). — **M-WL14**: add a direct `` fetch(`${base}/wp-json/bsi/v1/auth/web-login`) `` in `worker/auth/login.ts` (or `worker/comments.ts`) → red {AU26.8}; **M-WL14b**: `globalThis.fetch(...)` to BSI from another worker file → red {AU26.8}; **M-WL14c**: aliased fetch (`const f = fetch; f(url)`) to BSI → red {AU26.8}; **M-WL14d**: `fetch(new Request(url))` with the BSI URL built in another module → red {AU26.8}.
- **AU26.9 (map by code, not status, 1.6.2).** BSI-C10 mock returns 401 `{code:"forbidden",…,data:{status:401}}` → 503 `unavailable`, `Retry-After: 300`, 0 R8a; 401 `{code:"invalid_credentials"}` → 401 `invalid_login`, +1 R8a; 401 with an unknown code → 503. — **M-WL15**: map by HTTP status alone (every 401 → `invalid_login`) → red {AU26.9, AU26.3}; **M-WL16**: map by HTTP status alone (every 401 → `unavailable`) → red {AU26.9, AU26.3, AU16}.
- **Changed (no new ID):** AU2 (BSI-C10 body above, no IP header), AU18 (signup/comment only), AU18.h (signup/comment only), WT13 (login: 0 siteverify, token forwarded), CK-W7 (b) order R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10 (1.6.3). WT2 unchanged.

### 0s.7 BSI dependency
| ID | What | Status | Owner / merge |
|---|---|---|---|
| **BSI-C10** (next free ID after BSI-C9) | `POST /wp-json/bsi/v1/auth/web-login`, contract §0s.2 (body `{username, password, client_id, recaptcha_token}`, W5 headers, no IP header); BSI verifies the reCAPTCHA token (v3 key per D-3, action `login`, hostname `metfix.org` for the metfix.org client, single use); BSI throttles per username and per client; `client_id` restricted to the dedicated metfix.org client (`client_not_allowed` otherwise); `can_moderate` strict boolean on 200. | **Missing; to add** | **BSI Lead owns it. PR2 merge dependency.** |
- **BSI-C1 retired from PR2** (not called). Its "needed fix" (IP-aware throttling) is not carried: BSI-C10 throttles per username and per client, and the Worker owns per-IP (1.6.1). BSI-C8 (dedicated client, per-client secret in BSI) kept. BSI-CM6's `can_moderate` source reads "the BSI-C10 web-login, `authorization_code` and `refresh_token` responses".

### 0s.8 New threat rows
| # | Threat | Control |
|---|---|---|
| A-T38 | **R8c saturation without passing reCAPTCHA** (reCAPTCHA now behind R8c, §0s.3). | Per-IP R8b (then the token shape check) before R8c caps one IP at its own quota (AU26.6, M-WL12). **Accepted residual (ruled by MetFix Web Lead, 2026-10-20):** many IPs can still fill R8c's 25/60 s. |
| A-T39 | **Token reuse or Worker double-verify** (single-use token burned by a Worker siteverify, failing every login). | 0 siteverify on login, byte-exact forward (AU26.2). |
| A-T40 | **Oracle via distinct reCAPTCHA / client errors** (attacker learns which check failed). | Fixed bodies per §0s.4; one `try_again` body; `client_not_allowed` → generic 503 (AU26.3). |
| A-T41 | **Deferred BSI-side PKCE and refresh-token rotation** (accepted residual, Ethan's deferral relayed via CEO and MetFix Web Lead, 2026-10-20; later follow-up, no tests): an authorization code intercepted on the BSI bridge/`authorization_code` leg can be redeemed without a verifier; a stolen refresh token can be replayed until it expires or is revoked (BSI-C4). | Codes go only to the pinned `https://metfix.org/api/auth/callback`, are exchanged once server-side, state is single-use (AU10); **What stands in for PKCE (1.6.4):** the token proxy `/metfix/v1/proxy/oauth/token` requires the Worker's `X-API-Key`, and BSI adds BSI-C8's confidential client secret, so an intercepted code can't be redeemed without both; **BSI-C8 is a PR2 merge dependency** for this deferral. **Refresh replay without rotation: accepted residual** (the token stays in the `SESSION` DO, is encrypted at rest (R7), and is revoked on logout (AU8)). |
| A-T38r | (adopted from QA, as written; ruled by MetFix Web Lead, 2026-10-20 (CQ delta 1.6.2)) A sustained flood can 429 every metfix.org login via BSI's per-client breaker (and R8c's site-wide 25/60 s); the Worker per-IP R8b (AU26.6) is the only IP-level guard. QA notes: BSI throttling is not testable here; recorded so no row claims availability under flood. | Accepted residual, non-gate, no mutation beyond AU26.6. |
| A-T43 | **Global per-username lockout** (accepted residual, CEO accepted (relayed); ruled by MetFix Web Lead, 2026-10-20 (CQ delta 1.6.2)): BSI-C10's per-username failed-password throttle has no IP in its key, so anyone can lock a user out for 15 minutes with 10 bad passwords. | A completed password reset clears it. Worker R8a/R8b limit how fast one client can do it. No test. |
| A-T42 | **Shared 600/min key ceiling exhausted** (accepted residual, BSI-C10 contract locked by BSI Lead in the MetFix Web Build room, 2026-10-20; ruled by MetFix Web Lead): BSI-C10's 600/min ceiling on metfix.org's API key is shared by every metfix.org user, so a many-IP flood could exhaust it and every login would get 429. | The Worker's per-IP R8b (20/60 s) and site-wide R8c (25/60 s) sit below it; both 429 sources are identical to the client (AU26.7). No further test. |

### 0s.9 Size impact (1.6.0, as corrected by 1.6.1)
- `gate-ids`: 1.5.4 257 → 1.6.0 262 (+5: AU26.1–AU26.5) → **1.6.1 260** (−1 AU26.4, +1 AU26.6, −1 AU7.6 per §0s.10, −1 CK-W4 per §0s.10). Changed in place, no new ID: AU2, AU5.z, AU6, AU11, AU18, AU18.h, WT13, CK-W7.
- `box-ids` 12 and `post-deploy-ids` 14 unchanged.
- Mutations: 1.5.4 244 → 1.6.0 255 (+11) → **1.6.1 253** (−3 M-WL8–M-WL10, +1 M-WL12).
- BSI deps: +1 BSI-C10 (missing, BSI Lead, PR2 merge dependency); −1 BSI-C1 retired from PR2; −1 BSI-C7 removed (deferred, §0s.10); BSI-C3 rotation ask removed; BSI-C8 kept; BSI-CM6 text updated. Net −1.
- Files: **0** added. Threat rows: 1.6.0 +6 → 1.6.1 net +4 (A-T38, A-T39, A-T40, A-T41; A-T35–A-T37 removed).
- Open: none from §0s. (A-T38 ruled; X-MFX-Client-IP dropped.)

### 0s.10 BSI-side PKCE and refresh-token rotation deferred (Ethan's deferral relayed via CEO and MetFix Web Lead, 2026-10-20)
- **Removed:** BSI-C7 (PKCE / `code_verifier` on the bridge `authorization_code` leg); BSI-C3's "confirm rotation" and "confirm `code_verifier` is forwarded" asks; CK-W4's rotation-specific half; every rotation assumption in §5.2, §0a R4/R14, §6 A-T4/A-T13/A-T17. (1.6.4: AU7.6 restored without the rotation premise, with M42c and M42e, §0s.13 (1); the 1.6.1 "no mutant remains" statement was wrong, CQ B1.) Follow-up recorded as A-T41.
- **Kept:** Worker-to-Google PKCE S256 (AU11 Google leg); `SESSION` DO serialising refresh (one upstream refresh per session at a time, G1). Refresh stores whatever BSI returns: a new `refresh_token` if present, else keeps the current one; no assumption either way.

### 0s.11 BSI-C10 locked details and single BSI client module (1.6.2; BSI-C10 contract locked by BSI Lead in the MetFix Web Build room, 2026-10-20; ruled by MetFix Web Lead)
- **(a) reCAPTCHA at BSI:** v3, action `login`, hostname `metfix.org`, score ≥ 0.5, no `remoteip`. A missing or non-numeric score, a siteverify error or a timeout → BSI 403 `recaptcha_failed` → Worker 403 `try_again` (unchanged, §0s.4).
- **(b) 429 sources:** BSI's 600/min ceiling on metfix.org's API key, or BSI-C10's own per-username failed-password limit (separate from `/auth/login`'s). The Worker maps both identically; `Retry-After` is clamped by the Worker (integer seconds only, at most 600; missing, invalid, non-integer or HTTP-date → 60); the client cap of 600 s stays. Test AU26.7; residual A-T42.
- **(c) BSI check order (BSI behaviour, BSI-C10; recorded, not a Worker test):** API key → key ceiling → fields → username limit → client lock → reCAPTCHA → password. A wrong `client_id` gets 403 `client_not_allowed` before any siteverify.
- **(d) Missing or wrong `X-API-Key`:** HTTP 401, code `forbidden`, body `{code:"forbidden", message, data:{status:401}}`, returned before any rate counter (BSI `functions.php:4360-4362`; cited by BSI Spec, locked by BSI Lead). The Worker maps 401 `forbidden` to 503 `unavailable`, `Retry-After: 300`. The Worker's mapping branches on the BSI `code`, never on the status alone, because 401 `invalid_credentials` maps to 401 `invalid_login` (AU26.3, AU26.9). Open item closed.
- **(e) One BSI client module:** every BSI call (web-login, BSI-C2/C2a/C3/C4/C5/C5a, comments read/write/like, leaderboards) lives in `worker/upstream.ts`. `worker/auth/**` and `worker/comments.ts` call its functions and never `fetch` BSI themselves. `worker/upstream.ts` is already in PR2's allowed-files set (§0b.3 S-G2 block); **file set unchanged**. Scan AU26.8.
- **Size impact (1.6.2):** `gate-ids` 260 → **263** (+3: AU26.7, AU26.8, AU26.9); mutations 253 → **257** (+4: M-WL13–M-WL16); `box-ids` 12 and `post-deploy-ids` 14 unchanged; files +0 (allowed-files unchanged); BSI deps unchanged (BSI-C10 text extended); threat rows +1 (A-T42). No open items.

### 0s.12 Rev 1.6.3 wording (ruled by MetFix Web Lead, 2026-10-20 (QA 1.6.2 points))
- Login order everywhere: R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10.
- Worker `Retry-After` on every BSI 429 (login and comment writes/likes): clamped by the Worker (integer seconds only, at most 600; missing, invalid, non-integer or HTTP-date → 60). The client cap of 600 s stays.
- BSI-C3 `authorization_code` request: exactly 4 keys (`grant_type`, `code`, `client_id`, `redirect_uri`); stray comma removed.
- No new IDs or mutations; `gate-ids` 263, mutations 257, `box-ids` 12, `post-deploy-ids` 14, files unchanged.

### 0s.13 Rev 1.6.4: CQ delta 1.6.2 (ruled by MetFix Web Lead, 2026-10-20 (CQ delta 1.6.2); item 4 CEO accepted (relayed))
- **(1) B1:** AU7.6 restored as refresh serialisation across two isolates with a non-rotating BSI-C3 mock (exactly 1 BSI call); M42c and M42e restored against it (§5a).
- **(2) B2:** R8c stays **25 per 60 s**: metfix.org's own site-wide breaker, kept far below BSI-C10's 600/min key ceiling so one flood can't use up that ceiling for all users. A-T38 stays the residual. Retired BSI-C1 asks struck (R8c, CK-W7 note, §0a.3 tooling note, §0a.X item 3, §0b.2 rationale and residual, Q20, judgment-call residual 3, A-T10, §5b BSI-C1); stale BSI-C1/BSI-C7 mentions outside history/changelog now point to BSI-C10 or are struck.
- **(3) N3:** AU20.1 extended to web-login across every outcome; M-WL17.
- **(4) N1:** A-T43 per-username global lockout, accepted residual (CEO accepted, relayed); a completed password reset clears it.
- **(5) N2:** **one shared Retry-After parser** (`parseRetryAfter`) for login and comments: integer seconds (`^[0-9]+$`, ≥ 1), clamped at 600; anything else (missing, `0`, non-integer, exponent, over-long digits, HTTP-date) → 60. Comments no longer pass a 5-digit value through (§0p.4, CW13.1 already say clamped in 1.6.3; this names the single parser). AU26.3 gains `1e30` and a 30-digit case.
- **(6) N4:** AU26.8 gains a runtime fetch-accounting check and M-WL14b/c/d; `upstream.ts` takes `fetch` and the base URL as parameters.
- **(7) N5:** A-T41 names the API-key-gated token proxy plus BSI-C8's client secret as the stand-in for PKCE; BSI-C8 is a PR2 merge dependency; refresh replay without rotation is an accepted residual.
- **(8) N6:** §0r.1 sources `can_moderate` from web-login; R4 says session ID; R25/R8 rationale updated.
- **(9) N7:** AU5.z case (e) has a non-rotating variant (QA to re-reason M-CW33's red set).
- **(10)** **M95b**: forward `X-Forwarded-For` (from the incoming request) on web-login → red {AU2.1, WT2} (next to M95, `CF-Connecting-IP`).
- **(11)** A-T38r adopted as written.
- **Open for Web Lead:** (a) CQ N9: spec mutations 257 (1.6.2/1.6.3) vs QA r1.20 256; reconcile at QA's re-pin (spec now 264). (b) CQ's suggested tooling (orphan-mutant CI self-check; doc lint for retired IDs; `no-restricted-globals: fetch` lint) is not adopted here; Web Lead to decide. (c) CQ N1 alternative (ask BSI to count only failures after reCAPTCHA) not pursued; recorded as A-T43. (d) CQ's post-freeze/E-R9 caveat on §0s: the spec keeps E-R9 text unchanged; Web Lead to confirm.
- **Size impact (1.6.4):** `gate-ids` 263 → **264** (+1 AU7.6 restored). Mutations 257 → **264** (+2 restored M42c, M42e; +5 new M-WL14b, M-WL14c, M-WL14d, M-WL17, M95b). `box-ids` 12, `post-deploy-ids` 14 unchanged. Files +0. BSI deps: BSI-C8 becomes a PR2 merge dependency (no new ID). Threat rows +2 (A-T38r, A-T43).

## 0r. Rev 1.5.3: Web Lead rulings on CQ pin check 9 (2026-10-20). Read first; wins over §0q, §0p and any earlier text where they differ. Every security rule stays in force. E-R9's text is unchanged.
Source: `metfix-pr2-cq-pin-check-9.md` (CQ, 2026-10-20). Rulings below are ruled by MetFix Web Lead, 2026-10-20; BSI facts are relayed from BSI Lead.

### 0r.1 Where `/me.moderator` comes from (closes CQ B1; ruled by MetFix Web Lead, 2026-10-20)
- **Relayed from BSI Lead:** BSI returns a strict boolean `can_moderate` on the BSI-C10 web-login response (1.6.4; was the retired BSI-C1) and on the `/proxy/oauth/token` (BSI-C3) responses for both `grant_type=authorization_code` and `grant_type=refresh_token`. There is no BSI me route.
- The Worker reads `can_moderate` only from those responses, at login (password or Google code exchange) and at token refresh. It stores it in the `SESSION` DO with the token pair and copies it into the 60 s KV `/me` entry. Anything other than JSON `true` is stored as `false`.
- `/me` makes **0 BSI calls on a KV hit and 0 on a KV miss**: a miss rebuilds the entry from the `SESSION` DO (R5 unchanged). `/me` never asks BSI for moderator status.
- **BSI-C6 is dropped** (no me route; `user_id`/`public_name` come on the BSI-C10/C3 responses, 1.6.4). BSI-CM6 text updated (§5b table).

### 0r.2 Client Retry-After (closes CQ N2; ruled by MetFix Web Lead, 2026-10-20)
- CW13.2 covers all five actions: post, reply, edit, delete and like.
- The client honours `Retry-After` up to a cap of **600 s**: wait = min(value, 600). While waiting it shows the remaining time and sends 0 requests for that action. The Worker clamps first (CW13.1, 1.6.3, §0s.12).

### 0r.3 Stale moderator status after demotion (closes CQ N3; ruled by MetFix Web Lead, 2026-10-20)
- **Accepted residual:** after a demotion, moderator controls stay visible until the next token refresh. It is display only; BSI's `canModifyComment` refuses the action and the user sees the fixed 403 message. Threat row A-T31. No test.

### 0r.4 BSI-CM6 is a PR2 merge dependency (closes CQ N4; ruled by MetFix Web Lead, 2026-10-20)
- PR2 does not merge until BSI-CM6 (`can_moderate`) ships, **or** it uses the fallback: ship with moderator controls hidden, i.e. `/me` `moderator` is always `false`. The fallback only removes UI and adds nothing; owner controls and BSI authorization are unchanged. E-R9 text stays as it is.
- **1.5.4 wording (CQ pin-check-10 item 4; ruled by MetFix Web Lead, 2026-10-20):** the fallback turns on when BSI omits `can_moderate`, which the existing absent or non-boolean means `false` rule (CW12.2) already covers. There is no separate flag.

### 0r.5 Deleted comments (closes CQ N6; ruled by MetFix Web Lead, 2026-10-20; BSI behaviour relayed from BSI Lead)
- No one, owner or moderator, can edit a deleted (`deleted != 0`) comment. BSI refuses → Worker 409 `{"error":"comment_deleted"}` (fixed body), 0 retries, 0 purges. Client: no edit control on deleted rows for anyone.
- Deleting an already-deleted comment is an **idempotent 204**: BSI 204 → Worker 204, 0 retries.

- **1.5.4 wording (CQ pin-check-10 item 3; ruled by MetFix Web Lead, 2026-10-20):** the client treats a repeat-delete 204 the same as a 200 `{deleted:true}`. A 204 does not clear the cache.
### 0r.6 `liked` at BSI (relayed from BSI Lead; ruled by MetFix Web Lead, 2026-10-20)
- `liked` is optional at BSI: no value toggles, a boolean sets. Our Worker always sends the boolean, so CW15.1 holds unchanged (missing or non-boolean from the client → 400, 0 BSI). This replaces §0q.2's "`liked` required" for BSI only; the Worker rule stands.

### 0r.7 Evidence on Node 24 (closes CQ N5(b),(c); ruled by MetFix Web Lead, 2026-10-20)
- All R-A and PR-head evidence (E1 `tsc --listFilesOnly`, E2 `check:worker`, TK2.m, TK1, TK1.g, TK1.r, M-RS2) runs on **Node 24** to match CI. Web Lead's handoff quotes the output with the head SHA. The Node v22.20.0 box proof in §0o 2 is history only; no acceptance relies on it. E1/E2 stay unnumbered evidence rows (box count unchanged); the handoff quote is the check.

### 0r.8 New and changed CI IDs (each with a mutation)
- **CW12.2 (extended).** Adds: `/me` on a KV hit and on a KV miss → 0 BSI calls; `moderator` equals `can_moderate` stored at login/refresh (true and false); non-boolean `can_moderate` (`"true"`, `1`, absent) → `false`. — **M-CW23**: `/me` asks BSI for moderator on a KV miss → red {CW12.2}.
- **CW13.2 (extended).** Retry-After 17 on post, reply, edit, delete and like → rollback, 0 requests for 17 s, re-enabled at 17 s. M-CW19 unchanged.
- **CW13.3 (Retry-After cap) new.** Client unit test fed a raw response header (1.6.3: the Worker never emits more than 600; this keeps the client cap as defence in depth). Retry-After 99999 → control disabled for exactly 600 s, 0 requests, re-enabled at 600 s; remaining time is shown and decreases with the fake clock (17 s case shows 17 then 16 after 1 s). — **M-CW24**: no cap (honours 99999) → red {CW13.3}.
- **CW16.1 (no edit on deleted) new.** Worker: owner and moderator PATCH on a deleted comment, BSI refusal → 409 `{"error":"comment_deleted"}`, 1 BSI call, 0 retries, 0 purges. Client: no edit control on `deleted != 0` rows, incl. for `/me` `moderator:true` and `own:true`. — **M-CW25**: Worker maps the 409 to 403 `forbidden` → red {CW16.1}; **M-CW26**: client renders edit on deleted rows for moderators → red {CW16.1}.
- **CW16.2 (idempotent delete) new.** DELETE of an already-deleted comment: BSI 204 → Worker 204, 1 BSI call, 0 retries; a second DELETE also 204. — **M-CW27**: Worker maps the repeat delete to 404 → red {CW16.2}.

### 0r.9 New threat rows
| # | Threat | Control |
|---|---|---|
| A-T31 | **Stale moderator controls after demotion** (accepted residual, ruled by MetFix Web Lead, 2026-10-20). | Display only until the next refresh; BSI `canModifyComment` refuses; fixed 403 (CW11.1, CW12.2). |
| A-T32 | **Editing a deleted comment** (resurrecting removed content, owner or moderator). | BSI refuses; Worker fixed 409 `comment_deleted`; no client control (CW16.1); repeat delete idempotent 204 (CW16.2). |
| A-T33 | **Long Retry-After locking out the UI** (hostile or buggy upstream value). | Client cap 600 s with remaining time shown (CW13.3). |
| A-T34 | **`/me` turning into a BSI call per KV miss** (request amplification, R5 break). | `can_moderate` only from login/refresh, stored in the DO and KV; 0 BSI calls on hit and miss (CW12.2, M-CW23). |

### 0r.10 Size impact
- `gate-ids`: 254 → **257** (+3: CW13.3, CW16.1, CW16.2).
- `box-ids` 12 and `post-deploy-ids` 14 unchanged.
- Mutations: 239 → **244** (+5: M-CW23–M-CW27).
- Files: none added. BSI deps: −1 (BSI-C6 dropped); CM3, CM3d, CM4, CM6 text updated.

### 0r.11 CQ pin check 9 findings, how handled
- **B1:** fixed (§0r.1, CW12.2 assertion, M-CW23).
- **N1:** list re-cut as rev 1.18 with a corrected title line and changelog line; drafted by Spec, QA re-pins and signs off. CQ re-checks on the new md5.
- **N2:** fixed (§0r.2: all five actions in CW13.2; 600 s cap, CW13.3, M-CW24).
- **N3:** accepted residual (§0r.3, A-T31).
- **N4:** BSI-CM6 is a merge dependency with the hidden-controls fallback (§0r.4). No split.
- **N5:** (a) already closed; (b) Node 24 (§0r.7); (c) E1/E2 stay unnumbered, quoted with the head SHA in Web Lead's handoff (§0r.7).
- **N6:** fixed (§0r.5, CW16.1, CW16.2).

## 0q. Rev 1.5.1: moderators and BSI server rules (2026-10-20). Read first; wins over §0p where they differ. Everything else, including E-R9's "awaiting Ethan's direct confirmation" note, is unchanged.

### 0q.1 D-6. Owners and moderators may edit or delete (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20)
- Replaces the owner-only pin in §0p.4 and BSI-CM3. The open question on `canModifyComment` is **resolved: owner or moderator (relayed)**.
- **The Worker trusts only BSI's server-side moderator decision.** BSI's `canModifyComment`, run as the Bearer user, decides. The Worker sends no role, moderator or admin field, drops any the client sends (header, body, query or cookie, e.g. `X-Moderator`, `X-Role`, `is_moderator`, `role`, `moderator`), and never skips, softens or short-circuits a BSI 403 because of a client claim. Client local state is never sent.
- A non-moderator editing or deleting someone else's comment → BSI 403 → Worker 403 `{"error":"forbidden"}`. The fixed message becomes "You can't change this comment." (§0p.4's text "You can only change your own comments." is replaced.)
- **`/me` carries `moderator: boolean`** taken only from BSI (BSI-CM6), refreshed with the session, never from the client. *(1.5.3: source pinned in §0r.1: `can_moderate` from login/refresh only, stored in the DO and KV; `/me` makes 0 BSI calls.)* It is a display input only. If BSI gives no status, `/me` says `moderator:false`.
- **Client:** moderator edit/delete controls on other people's comments render only when `/me` returns `moderator === true` (strict boolean). A `/me` without it (absent, `false`, `"true"`, `1`) hides them, whatever local storage, a URL flag or earlier state says. Own-comment controls stay on `own === true`.

- **Moderator definition (relayed by MetFix Web Lead from BSI, 2026-10-20):** a moderator is exactly a WordPress administrator or a Daily Fix admin, as BSI decides server-side in `canModifyComment` and reports for `/me` via BSI-CM6. No other role counts, and metfix.org never computes it.

### 0q.2 BSI server rules (relayed as confirmed by BSI Lead, 2026-10-20)
- **One-level replies.** Replies go one level deep. Client: no reply control on a reply. Worker: a BSI refusal of a nested reply → 400 `{"error":"invalid_parent"}` (fixed body), 0 retries.
- **No likes on deleted comments.** Client: no like control on a deleted (`deleted != 0`, incl. `[Anonymous]`) comment. Worker: BSI's refusal → 409 `{"error":"comment_deleted"}` (fixed body), 0 retries, 0 purges.
- **`liked` required (idempotent set).** The Worker requires a boolean `liked` from the client (missing or non-boolean → 400, 0 BSI) and always sends upstream body exactly `{"liked":<bool>}`. No read-then-toggle. The client always sends `liked`.
- **Throttle = 429 with `Retry-After`.** On writes and likes, a BSI 429 → Worker 429 `{"error":"rate_limited"}` with BSI's `Retry-After` clamped by the Worker (integer seconds only, at most 600; missing, invalid, non-integer or HTTP-date → 60); 0 retries, 0 purges. (The anonymous read path keeps W6: 429 → 503.) The client honours `Retry-After`: it rolls back, disables that action for that many seconds, and sends nothing in that window. *(1.5.3, §0r.2: capped at 600 s, remaining time shown.)*

### 0q.3 New CI IDs (each with a mutation)
- **CW11.1 (non-moderator IDOR).** BSI mock decides owner-or-moderator from the Bearer. Non-moderator B PATCHes and DELETEs A's comment → 403 fixed body, comment unchanged, 0 purges, no retry. Moderator M PATCHes and DELETEs it → 200 (BSI allows). — **M-CW14**: Worker pre-checks `own` and refuses M (owner-only in the Worker) → red {CW11.1}.
- **CW11.2 (forged moderator claim).** B sends `X-Moderator: 1`, `X-Role: moderator`, body/query `is_moderator:true`, `role:"moderator"`, `moderator:true`, cookie `mfx_mod=1` → upstream headers exactly the W5 set + Bearer, body key set exactly `content` (PATCH) / none (DELETE); BSI 403 → Worker 403. — **M-CW15**: Worker forwards `is_moderator` / treats `X-Moderator` as allowing → red {CW11.2}.
- **CW12.1 (UI gating on /me).** `/me` `moderator:true` → controls on others' comments; `moderator` absent / `false` / `"true"` / `1` with `localStorage.mfx_mod="1"` → no edit/delete on others' comments (own still on `own:true`). — **M-CW16**: client reads moderator from localStorage or truthiness → red {CW12.1}.
- **CW12.2 (/me moderator source).** `/me` `moderator` equals BSI's value for the session user; client-sent moderator headers/cookies don't change it; BSI silent → `false`. — **M-CW17**: `/me` takes `moderator` from a request header → red {CW12.2}.
- **CW13.1 (429, clamped Retry-After).** BSI 429 with `Retry-After: 17` on POST, PATCH, DELETE, like → 429 `{"error":"rate_limited"}`, `Retry-After: 17`; `99999` → `600`; `abc` / `0` / `1.5` / HTTP-date / missing → `60`; 1 BSI call, 0 retries, 0 purges. — **M-CW18**: map BSI write 429 → 503 → red {CW13.1}.
- **CW13.2 (client honours Retry-After).** On a 429 with `Retry-After: 17` the like/edit control rolls back and sends 0 requests for 17 s (fake timers), then re-enables. — **M-CW19**: client ignores `Retry-After` → red {CW13.2}.
- **CW14.1 (one-level replies).** Client: no reply control on any reply row. Worker: BSI nested-reply refusal → 400 `{"error":"invalid_parent"}`, 0 retries. — **M-CW20**: reply control rendered on replies → red {CW14.1}.
- **CW14.2 (no like on deleted).** Client: no like control on `deleted != 0` rows. Worker: BSI refusal → 409 `{"error":"comment_deleted"}`, 0 purges. — **M-CW21**: like control rendered on deleted rows → red {CW14.2}.
- **CW15.1 (`liked` always sent).** Upstream like body exactly `{"liked":true}` / `{"liked":false}`; client body missing `liked`, `"true"`, `1`, `null` → 400, 0 BSI; 0 reads before the set; client like calls always carry boolean `liked`. — **M-CW22**: Worker omits `liked` when true → red {CW15.1}.
- **Adjusted:** CW3.1 keeps the `:id` cases; its toggle-with-read half is replaced by CW15.1 (same desired-state guarantee via the idempotent set). CW5.1/CW5.2 assert the new fixed message. CW10.1's own-content controls are unchanged.

### 0q.4 New threat rows
| # | Threat | Control |
|---|---|---|
| A-T27 | **Non-moderator edits/deletes someone else's comment.** | BSI `canModifyComment` (owner or moderator) from the Bearer; Worker fixed 403, no retry (CW11.1, CW5.1, CW5.2). |
| A-T28 | **Forged moderator claim from the client** (header, body, query, cookie, local state). | Worker forwards no role field and never acts on one; only BSI decides (CW11.2, CW12.2, CW4.1). |
| A-T29 | **Moderator controls shown without moderator status** (UI leak or confusion). | UI gated on strict `/me.moderator === true` from BSI (CW12.1); authorization unaffected either way. |
| A-T30 | **Throttle bypass / retry storms** on BSI 429. | 429 + `Retry-After` clamped by the Worker (integer seconds only, at most 600; missing, invalid, non-integer or HTTP-date → 60), 0 Worker retries (CW13.1); client honours it (CW13.2); Worker limiters unchanged (CW6.1, CW6.2). |

### 0q.5 Size impact
- `gate-ids`: 245 → **254** (+9: CW11.1, CW11.2, CW12.1, CW12.2, CW13.1, CW13.2, CW14.1, CW14.2, CW15.1).
- `box-ids` 12 and `post-deploy-ids` 14 unchanged.
- Mutations: 230 → **239** (+9: M-CW14–M-CW22).
- Files: none added. BSI deps: +1 row (BSI-CM6); CM2, CM3, CM3d, CM4, CM5 updated.

## 0p. Rev 1.5.0: PR2 scope decisions (2026-10-20). Read first; wins over §0a–§0o and any later text it contradicts. Every security rule in this spec stays in force.

**Provenance of every decision in §0p:** relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT. These are relayed decisions. They are not confirmed by Ethan directly in my chat (see E-R9 below).

**E-R9 (reworded, not deleted):** E-R9 is reported closed by Web Lead quoting Ethan ("Decisions MetFix CEO Relays count as mine", 2026-10-20 8:27 AM PT); awaiting Ethan's direct confirmation in my chat. *(1.5.1: replaces a literal `{er9_new}` placeholder left in 1.5.0; same text as §9 E-R9, no change of meaning.)* Until then the "relayed" label stays on every decision above.

### 0p.1 D-1. Google client: reuse the app's existing web client (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT)
- The Worker uses the MetFix app's existing Google **web** client (the client ID behind `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`). No new Google client is created. Replaces E-A1 and the "Spec leans new" note.
- `GOOGLE_WEB_CLIENT_ID` is non-secret Worker config whose value equals the app's web client ID. `GOOGLE_WEB_CLIENT_SECRET` is that client's secret, held only as a Worker secret. Never `VITE_*`, never in `client/**`, never printed.
- AU12's `aud` check is exact equality to that one ID. An `aud` array is accepted only with exactly one element equal to it (§0b.4 #16 kept). `azp`, if present, must equal it. No second or fallback client ID is accepted. The Android/iOS client IDs are **not** accepted at metfix.org.
- §5.6 step 3 becomes: add JS origin `https://metfix.org` and redirect URI `https://metfix.org/api/auth/google/callback` to the **existing** web client. No other origin or redirect is added (no www, no preview hosts).
- **Residual (accepted under D-1):** one client is shared by the app and metfix.org, so revoking its secret affects both, and an ID token minted for the app has the same `aud`. Controls: the `nonce` is bound to the Worker's `OAUTH_STATE` record, and `state` is bound to `__Host-mfx_pre` (AU10, AU12). A token without our nonce is rejected.
- **New CI IDs:** **AU12.c** (aud and azp exact to the configured app web client ID; a token for any other client ID, including a second "metfix" ID, is rejected with no BSI call). Mutation **M-GL2**: accept `aud` from a list of two IDs → red {AU12.c}.
- **New box ID:** **BX3**. On the box, QA shows that the Worker's `GOOGLE_WEB_CLIENT_ID` config value equals the app's `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` value. Both are non-secret IDs. The secret is never printed. **No mutation**, because this is a deployment-config check, not code.

### 0p.2 D-2. Auto-link only on `email_verified=true` (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT)
- Replaces "never auto-link" (A-T9, §5.3, E-A2). A Google account is linked to an existing email/password account **only** when the Worker-verified Google ID token has `email_verified === true`: the boolean `true`, not the string `"true"`, and not missing. Otherwise there is no link.
- **Worker rules:**
  - (a) The Worker verifies the ID token server-side: signature, `iss`, `aud`/`azp` per D-1, `exp`/`iat`, and `nonce`, as in AU12. It does this **before** any BSI call.
  - (b) If `email_verified !== true`, the Worker calls BSI with neither `intent=register` nor any link. It only calls `intent=login`, which resolves by Google `sub` alone. A 404 `account_not_found` there gives the generic `/?auth_error=google`, with copy telling the user to sign up with email instead. No account is created and no link is made.
  - (c) The Worker never sends BSI an email, name, `sub` or `login_hint` taken from the browser, a query parameter or a cookie. The only identity input BSI gets is the Google token the Worker itself received from Google's token endpoint. A client-claimed email is never used for linking.
  - (d) The link decision is logged as `link=verified|refused` with a 12-char sha256 prefix of `sub` only. No email is logged (AU20).
- **BSI side:** BSI already resolves by provider `sub` first (`app-social-auth-rest.php:265-268`, `getUserIDByProviderIdentifier`). Its register path then auto-links by `email_exists($email)` with **no** `email_verified` check (`:270-292`, read at `d3234a50`). BSI must refuse that email-link unless Google reports `email_verified=true` (dependency **BSI-SL1**, §0p.7). Until BSI-SL1 lands, Worker rule (b) is the only gate, and it is merge-gating.
- **New CI IDs:**
  - **AU12.v.** Token with `email_verified:true` and `intent=register` → BSI `/auth/social` called once. Variants with `email_verified` `false`, `"true"` or missing → 0 calls with `intent=register`, at most 1 call with `intent=login`, and no link.
    - Mutation **M-GL1**: treat a truthy `"true"` as verified → red {AU12.v}.
  - **AU12.u.** Unverified token whose `intent=login` returns 404 → 302 `/?auth_error=google`, 0 register calls, no session, and no `sess:*` put.
    - Mutation **M-GL4**: on 404 with an unverified email, retry with `intent=register` → red {AU12.u, AU12.v}.
  - **AU12.e.** The upstream `/auth/social` body key set is exactly `provider,intent,access_token,client_id,redirect_uri,state` (§5b BSI-C5). Browser-supplied `email`, `login_hint`, `sub` and `user_id`, in the query, the body or a cookie, never reach BSI. `login_hint` is not forwarded to Google either.
    - Mutation **M-GL3**: forward a `login_hint`/`email` query parameter into the BSI body → red {AU12.e}.

### 0p.3 D-3. reCAPTCHA key domains; login off on previews (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT)
- The reCAPTCHA v3 key's domain list is exactly `brokenscience.org`, `brokenstaging.wpengine.com` and `metfix.org`. It has no `www.`, no preview, no `*.pages.dev`, no `*.workers.dev` and no localhost. Closes N11.
- **The Worker is stricter than the key.** `siteverify` must return `hostname === "metfix.org"` exactly. A token minted on `brokenscience.org` or `brokenstaging.wpengine.com`, which the key would accept, is rejected with 403 `try_again` and no BSI call. Action names are as in §5.4.
- **Login is off on previews:** every host other than `metfix.org`, including `www.metfix.org` (which 301s anyway), `*.pages.dev`, `*.workers.dev` and localhost builds. On those hosts:
  - (i) every `/api/auth/*` route and every comment write route (POST, PATCH, DELETE, like) returns 404 (AUTH-HOST, extended to writes);
  - (ii) the client renders no sign-in, sign-up or comment composer UI, and shows read-only comments with "Sign in on metfix.org to comment.";
  - (iii) the client never loads the reCAPTCHA script and makes no `/api/auth/*` request.
  - The host test is exact equality on `metfix.org` (not `endsWith`, not a regex without anchors).
- **New CI IDs:**
  - **AU18.h.** siteverify fixtures with `hostname` set to `brokenscience.org`, `brokenstaging.wpengine.com`, `www.metfix.org` and `evilmetfix.org` → each 403 `try_again`, 0 BSI.
    - Mutation **M-RC1**: the hostname check accepts any of the key's three domains → red {AU18.h}.
  - **AU25.1.** Worker hosts `www.metfix.org`, `pr-2.metfixhome.pages.dev`, `metfixhome.x.workers.dev`, `metfix.org.evil.com` and `localhost` → `/api/auth/*`, comment POST/PATCH/DELETE and like → 404, 0 DO calls, 0 BSI. `metfix.org` → normal behaviour.
    - Mutation **M-PV1**: AUTH-HOST uses `host.endsWith("metfix.org")` → red {AU25.1}.
  - **AU25.2.** Client test with `location.hostname` set to a preview host: no sign-in/composer DOM, no `script[src*="recaptcha"]`, 0 fetches to `/api/auth/`.
    - Mutation **M-PV2**: the client loads reCAPTCHA unconditionally → red {AU25.2}.
- **New post-deploy IDs:**
  - **PD12.** Ethan or QA records a screenshot of the reCAPTCHA admin console's domain list showing exactly the three domains, with md5 recorded. **No mutation**: admin-console configuration, not code.
  - **PD13.** On a real preview deploy, a HAR shows no sign-in UI and 404 on `/api/auth/csrf`. **No mutation**: deployment evidence; the code path is mutated by M-PV1/M-PV2.

### 0p.4 D-4. Comments get full control: post, reply, edit, delete and like (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT)
- Replaces P10/N6, "post and reply only". The old AU23 "no edit/delete/like routes" is retired: QA's **AU23.1** is removed from `gate-ids`, and **M90** ("add DELETE … (IDOR)") is removed from §M because that route is now the feature. AU23.2 (signed-out leaderboard) stays.
- **New Worker routes.** All have exact paths, sit before the `/api/` 404 catch-all, and are same-origin only. `:id` must match `^[1-9][0-9]{0,9}$`, else 404. The upstream path is rebuilt from the parsed integer and never from the body.

| Route | Method | Body | Upstream (fixed) | Success |
|---|---|---|---|---|
| `/api/daily-fix/comments` | POST | as P3 (post; reply when `parent_comment_id`) | `POST /wp-json/metfix/v1/daily-fix/comments` | 201 as S-G8 |
| `/api/daily-fix/comments/:id` | PATCH | `{content}` only (trimmed 1–2000, 8 KB, JSON) | `PATCH /wp-json/metfix/v1/daily-fix/comments/<id>` body `{content}` | 200 `{comment}` (W7 whitelist + B4-W) |
| `/api/daily-fix/comments/:id` | DELETE | none (body ignored) | `DELETE /wp-json/metfix/v1/daily-fix/comments/<id>` | 200 `{"deleted":true}` |
| `/api/daily-fix/comments/:id/like` | POST | `{liked: boolean}` (desired state) | `POST /wp-json/metfix/v1/daily-fix/comments/<id>/like` | 200 `{liked, like_count}` |

  - Other methods on these paths → 405 with the correct `Allow`.
  - The anonymize route (`/anonymize`) is **not** exposed.
- **Order on every write:** AUTH-HOST → session (`SESSION` DO; none → 401 `signed_out`, 0 BSI) → CSRF + Origin + Sec-Fetch-Site (AU9) → rate limit → reCAPTCHA (POST and PATCH only, action `comment`; no reCAPTCHA on DELETE or like) → BSI with W5 + `Content-Type` (when there is a body) + `Authorization: Bearer <user token>`. Headers stay exactly the W5/P4 set. The S4 refresh-once rule applies.
- **Own-content authorization is decided server-side, by BSI, from the Bearer token.**
  - The Worker sends no `user_id`, owner or author field, and drops any the client sends.
  - The browser has no way to name the acting user.
  - BSI's `Comments::canModifyComment` (`daily-fix-apis.php:1776` (edit), `:1869` (delete), under `wp_set_current_user($user_id)` where `$user_id` comes from the Bearer) is the decision.
  - BSI 403 → 403 `{"error":"forbidden"}`, message "You can only change your own comments." The body is fixed and BSI's is never relayed. BSI 404 → 404 `{"error":"not_found"}`.
  - The Worker never turns a BSI 403 into success and never retries it.
  - ~~What `canModifyComment` allows beyond the owner (for example moderators) is **BSI-CM3**. Until BSI states it, the Worker assumes owner-only for UI purposes.~~ **Resolved 1.5.1: owner or moderator (relayed); see §0q.1.**
- **Like semantics.** BSI's like route **toggles** (`:1805-1843`). To make retries and double-clicks safe, the Worker reads the user's current `liked` for that comment from a signed-in comments read, or from BSI's response. It calls the toggle only when the desired state differs. ~~Whether BSI can add an idempotent set (`{liked:bool}`) is **BSI-CM4**; until then the toggle-with-read is used.~~ **Superseded 1.5.1 (§0q.2): BSI's like call is an idempotent set with `liked` required; the Worker always sends `{liked}` and no longer reads-then-toggles.**
- **Throttles (like-spam):**
  - (a) Likes: 30 per 60 s per `${bsi_user_id}:${ip}`.
  - (b) Per comment per user: 4 toggles per 60 s, keyed `${bsi_user_id}:${comment_id}`.
  - (c) Edits and deletes share P8's write bucket (5/60 s per `${userId}:${ip}`).
  - All use the Rate Limiting binding with the counter fallback (P8). Over limit → 429 `rate_limited` with `Retry-After: 60`, checked before siteverify and BSI.
  - BSI's own bucket is 60/60 per key per route (F8) and is shared by every metfix.org user. Whether BSI keys it per Bearer user is **BSI-CM5**.
- **Signed-in comment read.** For a signed-in user the comments GET goes uncached (`no-store`) with the Bearer token, so BSI computes `liked` for that user.
  - The Worker adds `own: boolean`, computed by comparing each row's `user.id` with the session's `bsi_user_id`. It then drops `user.id` as W7 does.
  - The anonymous cached path is unchanged: there is no Bearer token, `liked` and `user.id` are stripped (T5), and `own` is absent.
  - `own` only decides which buttons the UI shows. It is **never** an authorization input.
- **Cache:** a successful PATCH, DELETE or like purges the W9 entry for that comment's date, as P7 does. Failures purge nothing.
- **Client:**
  - Edit and delete controls render only when `own === true`. Delete asks for confirmation.
  - Like is optimistic, with a rollback on any non-2xx response.
  - One in-flight request per comment per action.
  - All error copy uses fixed strings, and content stays in text nodes (T6).
- **New CI IDs:**
  - **CW1.1.** PATCH happy path and shape. The upstream path is exact, the body key set is exactly `content`, and the headers are exactly `accept,authorization,content-type,user-agent,x-api-key`. Validation gives 400/413/415 as P3, and there is no session → 401 with 0 BSI.
    - Mutation **M-CW1**: PATCH skips the session check → red {CW1.1, CW9.1}.
  - **CW2.1.** DELETE happy path. The upstream method and path are exact, no body is sent, and the response is 200 `{"deleted":true}`. With no session → 401 and 0 BSI.
    - Mutation **M-CW2**: DELETE sent with the key only (no Bearer) → red {CW2.1, CW4.1}.
  - **CW3.1.** Like route. A non-digit, zero, leading-zero or 11-digit `:id` → 404 with 0 BSI. Desired-state handling makes 0 toggles when the state already matches and exactly 1 toggle when it differs.
    - Mutation **M-CW3**: `:id` passed through unvalidated → red {CW3.1}.
  - **CW4.1.** Bodies and queries carrying `user_id`, `author`, `owner`, `comment_id` or `id` never reach BSI on POST, PATCH, DELETE or like. The incoming `Authorization` is ignored (T2).
    - Mutation **M-CW4**: forward a body `user_id` → red {CW4.1}.
  - **CW5.1 (IDOR, edit).** User B PATCHes A's comment, and the BSI mock enforces the owner from the Bearer → 403 `{"error":"forbidden"}` with the fixed body, the comment is unchanged in the mock, 0 cache purges, and no retry.
    - Mutation **M-CW5**: map BSI 403 → 200 → red {CW5.1}.
  - **CW5.2 (IDOR, delete).** As CW5.1 for DELETE. Also, a body `comment_id` of B's own comment combined with URL `:id` of A's comment → the upstream path uses the URL id and BSI returns 403.
    - Mutation **M-CW12**: upstream id taken from the body over the URL → red {CW5.2}.
  - **CW5.3 (IDOR, like).** A like is always attributed via B's Bearer. The upstream has `authorization === "Bearer "+B_ACCESS`. With no Bearer, the Worker returns 401 and never calls key-only (F7).
    - Mutation **M-CW13**: like sent key-only → red {CW5.3, CW3.1}.
  - **CW6.1 (like-spam).** Likes 1–30 per user and IP proceed; the 31st within 60 s → 429 with 0 BSI. A different user or IP is allowed.
    - Mutation **M-CW6**: like limiter removed → red {CW6.1}.
  - **CW6.2.** The 5th toggle on one comment by one user within 60 s → 429 with 0 BSI.
    - Mutation **M-CW11**: per-comment cap removed → red {CW6.2}.
  - **CW7.1.** The signed-in read is `no-store`, carries the Bearer, has `own` correct for 2 of 3 rows, and has no `user.id` at any depth. The anonymous read has no `own` and no `liked`, and is cached as W9.
    - Mutation **M-CW7**: `user.id` kept on the signed-in read → red {CW7.1}.
  - **CW8.1.** Successful PATCH, DELETE and like each make exactly 1 `cache.delete` for the date key. Failures make 0.
    - Mutation **M-CW8**: PATCH skips the purge → red {CW8.1}.
  - **CW9.1.** CSRF on PATCH, DELETE and like: a missing token, a wrong Origin, or `Sec-Fetch-Site: cross-site` → 403 with 0 BSI and 0 limiter calls.
    - Mutation **M-CW9**: DELETE has no CSRF check → red {CW9.1}.
  - **CW10.1.** Client: edit and delete controls only on `own:true`, a delete confirmation, like rollback on 429/403/503, and a single in-flight request.
    - Mutation **M-CW10**: controls rendered on `own:false` → red {CW10.1}.
- **New post-deploy ID:**
  - **PD14.** On prod, test user B tries to edit, delete and like test user A's comment through the UI-less HAR (crafted same-origin fetch). Edit and delete → 403. The like is attributed to B: A's like state is unchanged and the count changes by B's toggle only. **No mutation**: live-system evidence; the code path is mutated by M-CW5/M-CW12/M-CW13.
- **Files added to PR2's scope:** `worker/comments.ts` and `worker/comments*.test.ts` (comment read/write handlers). These are added to the §0b.3 allowed-files block below. Nothing else is added: `wrangler.jsonc` (the new Rate Limiting bindings) and `client/**` are already allowed. If the PR keeps the handlers inside `worker/index.ts`, the new entries are simply unused.

### 0p.5 D-5. Leaderboards signed-in only (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT)
- P11/N8 is now decided, no longer a default. Leaderboards are shown signed-in only. There is no new BSI route for signed-out visitors, and **D-LB is not needed** (it is dropped, not deferred). L1–L7, S-G5, AU23.2 and T14 stand unchanged. Signed-out → 401 `signed_out`, and the UI shows "Sign in to see the leaderboard." D-NAME is still needed for names.
- **No new IDs** (AU23.2 already covers it).

### 0p.6 New threat rows
| # | Threat | Control |
|---|---|---|
| A-T20 | **Unverified Google email** used to link to (and take over) an existing account. | D-2: link only on boolean `email_verified===true` from a Worker-verified token (AU12.v, AU12.u); unverified → login-by-`sub` only, never register/link; BSI-SL1 makes BSI refuse the email-link too. |
| A-T21 | **Email change.** (a) A user's Google email changes after linking; (b) a Google account later changes its email to match a different existing WP account; (c) the WP account's email changes. | The link is keyed on Google `sub`, not email (BSI resolves `sub` first, `app-social-auth-rest.php:265-268`), so (a) and (b) keep resolving to the originally linked account and create no new link. Auto-link happens only on the first sign-in, when no `sub` mapping exists, with a verified email (D-2). (c) doesn't affect the `sub` mapping. Residual: an admin of a Google Workspace domain that owns the victim's email domain can mint verified tokens for it; this is accepted under D-2 (relayed) and noted for Ethan. |
| A-T22 | **Existing-account takeover attempt** (attacker's Google token, client-claimed victim email, forged/foreign-audience token, replayed callback). | Server-side verification only (AU12: sig, iss, aud == the existing app web client per D-1, azp, exp/iat, nonce); no linking on any client-claimed email/`login_hint` (AU12.e); state/nonce/PKCE single-use (AU10, AU11); session rotation (A-T1). |
| A-T23 | **IDOR on edit/delete** (changing another user's comment by id). | Ownership decided by BSI from the Bearer (`canModifyComment`); Worker sends no user/owner field (CW4.1), rebuilds the path from the URL id (CW5.2), maps 403 to a fixed 403 (CW5.1, CW5.2); never key-only (F7, T1c). |
| A-T24 | **IDOR on like** (liking as another user, or forcing a like state for someone else). | BSI attributes the like to the Bearer user; Worker never key-only (CW5.3); no user field forwarded (CW4.1). |
| A-T25 | **Like-spam / toggle flooding** (inflating counts, starving the shared BSI bucket). | CW6.1 30/60 s per user+IP, CW6.2 4 toggles/60 s per user+comment, before BSI; desired-state toggling (no blind toggle); BSI-CM5 per-user bucket; T4 shared-key note. |
| A-T26 | **Auth on preview hosts** (cookies/reCAPTCHA/OAuth on hosts we don't pin). | D-3: auth and writes 404 off `metfix.org` exact (AU25.1), client UI off (AU25.2), reCAPTCHA hostname exact (AU18.h); the key covers no previews (PD12). |

### 0p.7 BSI dependencies (owned by the separate BSI comments PR, through BSI Lead; **not** PR2's work)
Read-only from `Curie-and-Co/bsi` main `d3234a50` (2026-10-20, `wp-content/plugins/bsi/daily-fix-apis.php` and `includes/app-social-auth-rest.php`). "Exists" means the route is registered. It does not mean BSI Lead has confirmed the shape.

| ID | Route / behaviour | Status | Needed |
|---|---|---|---|
| BSI-CM1 | `GET /wp-json/metfix/v1/daily-fix/comments` (`:155`, cb `dfix_api_get_comments`) | **Exists** | Per-viewer `liked` with Bearer (exists via `dfix_format_comment`); confirm `user.id` stays in the payload so the Worker can compute `own`. |
| BSI-CM2 | `POST /wp-json/metfix/v1/daily-fix/comments` post + reply (`:166`, cb `:1688`) | **Exists** | ~~Missing behaviour: `parent_comment_id` is not validated.~~ **1.5.1 (relayed as confirmed by BSI Lead):** replies go one level deep only; a reply whose parent is itself a reply is refused by BSI. Worker passes BSI's 4xx through as a fixed 400 `{"error":"invalid_parent"}` (CW14.1). |
| BSI-CM3 | `PATCH /wp-json/metfix/v1/daily-fix/comments/{id}` (`:189`, cb `:1752`, `canModifyComment`) | **Exists** | **1.5.1 resolved: owner or moderator (relayed)**; the moderator decision is BSI's, server-side, from the Bearer user. **Missing:** refusal to edit a deleted (`deleted != 0`) comment. **1.5.3 (relayed from BSI Lead; ruled by MetFix Web Lead, 2026-10-20):** no edit on a deleted comment for anyone, owner or moderator → 409 `comment_deleted` (CW16.1). |
| BSI-CM3d | `DELETE /wp-json/metfix/v1/daily-fix/comments/{id}` (`:200`, cb `:1849`) | **Exists** | Same rule (owner or moderator, BSI-decided); confirm `delete_type` values (`anon` vs soft). **1.5.3 (relayed from BSI Lead; ruled by MetFix Web Lead, 2026-10-20):** deleting an already-deleted comment → idempotent 204 (CW16.2). |
| BSI-CM4 | `POST /wp-json/metfix/v1/daily-fix/comments/{id}/like` (`:179`, cb `:1805`) | **Exists; to change (BSI comments PR)** | **1.5.1 (relayed as confirmed by BSI Lead):** idempotent set, `liked` (boolean) required; likes on deleted comments refused; throttle → 429 with `Retry-After`. **1.5.3 (relayed from BSI Lead):** `liked` is optional at BSI (no value toggles, a boolean sets); our Worker always sends the boolean, so CW15.1 holds. |
| BSI-CM5 | Per-user like/write throttle | **Missing; to add (BSI comments PR)** | Only `dfix_require_api_key` 60/60 per key+route (`:608-611`) today. **1.5.1 (relayed as confirmed by BSI Lead):** throttling returns 429 with `Retry-After`; BSI to state the bucket key. |
| BSI-CM6 | Moderator status for the signed-in user (for `/me` display only) | **Missing; to add (BSI comments PR)** | **1.5.3 (relayed from BSI Lead; ruled by MetFix Web Lead, 2026-10-20):** strict boolean `can_moderate` on the BSI-C10 web-login (1.6.4), `authorization_code` and `refresh_token` responses; no me route. Display input only; authorization stays in `canModifyComment` (§0q.1). **PR2 merge dependency**; fallback if it slips: ship with moderator controls hidden (`/me` `moderator` always `false`) (§0r.4). |
| BSI-SL1 | `POST /wp-json/bsi/v1/auth/social` register path email auto-link (`app-social-auth-rest.php:270-292`) | **Exists, but missing the `email_verified` gate** | Refuse email-based link unless Google reports `email_verified=true`; accept the existing app web client `aud` (BSI-C5). Owned by the BSI sign-in PR through BSI Lead (the top-note dependency), not the comments PR. |
| — | `POST …/comments/{id}/anonymize` (`:210`) | Exists | **Not used** by metfix.org (no Worker route). |
| — | Leaderboard signed-out route (D-LB) | Not needed | D-5. |

### 0p.8 Inline changes elsewhere in this file (1.5.0)
- §0n item 1 (the stale plain-name fixtures note) is struck. §0o item 1 governs.
- The A-T9 control is rewritten per D-2 and points to A-T20–A-T22. P10, P11 and AU23 are rewritten. §5.6 step 3 and step 5 are updated. In §9, E-A1, E-A2, N6, N8 and N11 are marked decided (relayed), and E-R9 is reworded. The allowed-files block gains two lines.

### 0p.9 Size impact (for Web Lead/CEO before QA re-cuts)
- **`gate-ids`: 226 → 245.**
  - +20 new: AU12.c, AU12.v, AU12.u, AU12.e, AU18.h, AU25.1, AU25.2, CW1.1, CW2.1, CW3.1, CW4.1, CW5.1, CW5.2, CW5.3, CW6.1, CW6.2, CW7.1, CW8.1, CW9.1, CW10.1.
  - −1 retired: AU23.1.
- **`box-ids`: 11 → 12** (+BX3).
- **`post-deploy-ids`: 11 → 14** (+PD12, PD13, PD14).
- **Mutations: 211 → 230.**
  - +20 new: M-GL1–M-GL4, M-RC1, M-PV1, M-PV2, M-CW1–M-CW13. M-CW1–M-CW13 are numbered 1–13 with no gaps.
  - −1 retired: M90.
  - Red sets are Spec's expected sets; QA confirms them on the box at re-cut.
- **No-mutation IDs (reason stated):** BX3, PD12, PD13 and PD14 (config or live evidence).
- **Files added to scope:** `worker/comments.ts` and `worker/comments*.test.ts`.
- **BSI dependencies:** 8 rows. 6 are owned by the BSI comments PR (CM1–CM5 including CM3d) and 1 by the BSI sign-in PR (SL1), plus the unused anonymize route.
  - Routes: all 5 comment routes exist.
  - Missing behaviour: parent validation, the deleted-edit refusal, idempotent like, a per-user throttle, and the `email_verified` gate.

## 0o. Rev 1.4.25: Web Lead ruling (b) on CQ pin check 7 (`metfix-pr2-cq-pin-check-7.md` md5 `7952f3c404352a9c25965aba727ba400`; QA list rev 1.13 `c258650b…`). Post-freeze change allowed by Web Lead. Wins over §0n on these points only. `.gitattributes` stays out (CQ N3 not taken).
1. **`.fixture` suffix (closes CQ B1).** Every file under `worker/__fixtures__/tk2-m7/` is stored as `<original name>.fixture`: `.github/workflows/ci.yml.fixture`, `.github/workflows/deploy-pages.yml.fixture`, `client/src/const.ts.fixture`, `client/src/lib/sanity.ts.fixture`, `client/src/vite-env.d.ts.fixture`, `vite.config.ts.fixture`. The md5s are those of the stored bytes and are unchanged from QA's table (`381b3baf…`, `07812ad2…`, `7da80696…`, `703e8b4d…`, `64c894f8…`, `9758af55…`; re-computed on the box 2026-10-19). TK2.m7 copies the fixtures into the `mkdtemp(os.tmpdir())` repo, strips the `.fixture` suffix, asserts each md5 (mismatch → `SCAN SETUP FAIL: fixture md5 <path>`), then scans. The allowed-files block in §0b.3 now lists the six exact `.fixture` paths (replacing `worker/__fixtures__/tk2-m7/**`). TK2's exclusion stays the exact, root-anchored prefix `worker/__fixtures__/tk2-m7/`, which covers exactly those six files.
2. **Acceptance: run, not reasoned.** On the PR2 head, `npx --no-install tsc --noEmit -p worker/tsconfig.json --listFilesOnly` prints no `__fixtures__` path, and `npm run check:worker` exits 0 on clean code. Both must be **run** on the PR head, with output recorded as evidence. The box proof below is not a substitute.
   - **Box proof, 2026-10-19 ~9:45 PM PT.** Read-only clone `/tmp/pr2proof` of `Break-Even-Productions/metfixhome` at main `9f7129d7` (nothing pushed); `npm ci --legacy-peer-deps` (rc 0); Node v22.20.0 on the box, where CI uses Node 24. *(1.5.3, §0r.7: history only; acceptance evidence runs on Node 24 on the PR head and is quoted with the head SHA in Web Lead's handoff.)* The six fixtures were copied from QA's `/workspace/tk2/fixtures/`.
     - Baseline, no fixtures: `tsc … --listFilesOnly` rc 0, 0 `__fixtures__` lines; `check:worker` rc 0.
     - **`.fixture` suffix: `tsc … --listFilesOnly` rc 0, 0 `__fixtures__` lines; `check:worker` rc 0.**
     - Control, plain names: `--listFilesOnly` lists 4 fixture files (`vite.config.ts`, `client/src/const.ts`, `client/src/vite-env.d.ts`, `client/src/lib/sanity.ts`); **`check:worker` rc 2** with 11 errors, e.g. `const.ts(21,19): error TS2304: Cannot find name 'window'.`, `vite.config.ts(9,31): error TS2307: Cannot find module './vite/asterisk-glass' …`, `vite.config.ts(7,42): error TS2305: Module '"vitest/config"' has no exported member 'ViteDevServer'.`, plus TS7006 implicit-any errors. So plain names turn `check:worker` red, as CQ reasoned.
3. **TK2.x anchoring row.** A plant `import.meta.env.N` at `client/worker/__fixtures__/tk2-m7/a.ts` → exactly one `SCAN FAIL: TK2 client/worker/__fixtures__/tk2-m7/a.ts:1`. That proves the exclusion is anchored at the repo root. New mutation **M-TOK15** (exclusion matched unanchored, e.g. `path.includes("worker/__fixtures__/tk2-m7/")`) → red **{TK2.x}**.
4. **Counts corrected (supersedes §0n's "No mutation change" and 207).** Mutations = QA's 210 (M-TOK12 prefix widened {TK2.x}; M-TOK13 no trailing slash {TK2.x}; M-TOK14 md5 assertion skipped {TK2.m7}) + M-TOK15 = **211**. **Tampered-fixture row (kills M-TOK14):** a temp copy with one byte changed in a fixture that keeps the same scan result (e.g. a trailing LF appended to `client/src/const.ts` after suffix stripping) → exactly `SCAN SETUP FAIL: fixture md5 client/src/const.ts`, rc 1, and no `SCAN FAIL: TK2` line. `gate-ids` stays **226**; box 11, post-deploy 11.
- **QA deltas:** TK2.m7 re-worded for `.fixture` storage, suffix stripping and stored-bytes md5s (same values); new acceptance evidence rows for `--listFilesOnly` and `check:worker` on the PR head (box/R-A evidence, not new gate IDs); TK2.x gains the anchoring row; new **M-TOK15** {TK2.x}; the tampered row is now spec-backed. Expected: `gate-ids` 226, mutations 211.
- **D3** freeze note kept, now naming 1.4.25 (post-freeze change per Web Lead's ruling).

## 0n. Rev 1.4.24: Web Lead post-freeze follow-up ruling (2026-10-19). Wins over §0l/§0m and earlier text on these points only. Nothing else changes.
1. ~~**TK2.m7 fixtures committed in PR2.** Byte-exact copies live under the PR2-owned path **`worker/__fixtures__/tk2-m7/`**, laid out with their repo-relative paths. The minimum set: `.github/workflows/deploy-pages.yml` from main `9f7129d7`, plus TK2-scanned files from #10 head `2fdecd34`: `.github/workflows/ci.yml`, `vite.config.ts`, `client/src/lib/sanity.ts`, `client/src/vite-env.d.ts` and `client/src/const.ts`. #10's test files and docs are omitted, because TK2 excludes them anyway. Each file's md5 is captured when it is committed, recorded in the QA list, and **asserted by the test** before scanning; a mismatch → `SCAN SETUP FAIL: fixture md5 <file>`. TK2.m7 copies the directory into a `mkdtemp(os.tmpdir())` git repo and scans that copy. It no longer fetches or depends on `2fdecd34` existing. Expected output is unchanged: exactly one `SCAN FAIL: TK2 .github/workflows/deploy-pages.yml:40` (§0m).~~
   - ~~**Allowed-files:** the entry `worker/__fixtures__/tk2-m7/**` is added to the block in §0b.3.~~
   - **TK2 exclusion:** the exact path prefix `worker/__fixtures__/tk2-m7/` is added to TK2's excluded paths (alongside `**/*.test.ts`, `**/*.test.tsx` and `docs/**`). Nothing else under `worker/__fixtures__/` is excluded. The scanner builds the name at runtime (§0i), and the fixture directory is excluded, so neither test files nor fixtures trip TK2 on the real head.
   - **New row TK2.x (CI):** in a temp tree, a real-use plant `import.meta.env.N` at `worker/__fixtures__/tk2-m7x/a.ts` (a near-miss sibling) and at `worker/__fixtures__/a.ts` → each gives exactly one `SCAN FAIL: TK2 <file>:1`. The same plant inside `worker/__fixtures__/tk2-m7/` → no hit. This proves the exclusion is exact.
   - **Struck in 1.5.0:** item 1's plain-name fixtures text and its `tk2-m7/**` allowed-files entry are stale; §0o item 1 (`.fixture` suffix, six exact paths) governs. The TK2 exclusion prefix and row TK2.x stay in force.
2. **"Merged main"** is the main SHA named in Web Lead's Project handoff. No SHA is hardcoded in this spec.
3. **R-A evidence:** M-RS2 and the merged-main clean controls (TK2.m, TK1, TK1.g, TK1.r) are recorded as R-A evidence for that handoff SHA only; any other SHA needs a re-run.
4. Stale `.map` wording in §0e, §0f, §0g F4 and §0l (ii) is struck and marked superseded inline.
- **Separate follow-up PR (not in PR2):** widening TK2's file set (N2) and matching cast forms (N1); both stay review items here.
- **QA deltas:** new gate ID **TK2.x**; TK2.m7 re-pointed to the committed fixtures with an md5 assertion row; the fixture md5 table moves to the committed files; R-A evidence rows name the handoff SHA. No mutation change. Expected counts: `gate-ids` **226**, mutations **207**, box 11, post-deploy 11.
- **D3** freeze note kept, now naming 1.4.24 (post-freeze change per Web Lead's ruling).

## 0m. Rev 1.4.23: corrections to §0l (2026-10-19). Wins over §0l and earlier text on these three points only.
1. **TK2.m7's expected hit is `.github/workflows/deploy-pages.yml:40`** (the `secrets.VITE_SANITY_API_READ_TOKEN` line), not `:42` (QA box-verified). It is still exactly one `SCAN FAIL: TK2` line, rc 1.
2. **No pre-merge fixture.** #7 (`01f4a8ff`) and #10 (`2fdecd34`) conflict in `vite.config.ts`, so §0l's merged-head fixture does not exist. TK2.m and the TK1/TK1.g/TK1.r clean control run **only on the real merged main** after #7 and #10 have merged. That merged-main SHA is recorded as R-A evidence (valid for that SHA only). TK2.m7 is unaffected (main `9f7129d7` + #10 head, no #7).
3. **TK1 scans `dist` as shipped.** The production build emits no `.map` files. TK1 does not turn on sourcemaps; it scans every file in the build output as produced, and if a `.map` file appears it is scanned too. The claim that source maps are included is dropped everywhere for TK1 (§0e, §0f, §0g F4 and §0l (ii)).
- **D3** freeze note kept, now naming 1.4.23 (header).

## 0l. Rev 1.4.22: CQ pin check 5 (`metfix-pr2-cq-pin-check-5.md` md5 `2f5f10b1513c7f05ae564a5f9d0b717b`; QA list rev 1.10 `815afd11…`; CQ scanner `/workspace/scratch/tk2cq/`). Read first; wins over §0e–§0k on TK1, TK2 and M-RS2 where they differ. TK2's scope is unchanged (Web Lead: the non-blocking items add no TK2 scope).
- **B1. TK2.m fixture includes #7 (supersedes §0j's fixture definition and §0k's "zero hits" claim, which covered #10's patch lines only).** Merge order is #7, then #10. Fixture = a temp git repo built by checking out #7 head `01f4a8ff059aaf2e7b4c100d6b8cca0453f70810` (base `9f7129d7`) and merging #10 head `2fdecd342bcd9df2771ddf306b26c6495998d826` (base `9f7129d7`) into it with `git merge --no-ff`, plus PR2's scanner. Both PRs are open and unmerged (read 2026-10-19 through cursor-github). #7 deletes `.github/workflows/deploy-pages.yml`, and both PRs edit `.github/workflows/ci.yml` and `vite.config.ts`. If that merge conflicts, no pre-merge fixture is defined and TK2.m runs only on the real merged main. In every case, **once #7 and #10 have merged the fixture is rebuilt from real merged main, and the merged bytes win.** The QA list records the source SHAs (`9f7129d7`, `01f4a8ff`, `2fdecd34`, and the merged-main SHA when it exists) and a per-file md5 table. **No exception:** main's `deploy-pages.yml:42` (`N: ${{ secrets.N }}`) is a true positive, and #7 removes it.
  - New row **TK2.m7** (CI): the same fixture with #7 **not** applied (main `9f7129d7` + #10 head) → exactly one `SCAN FAIL: TK2 .github/workflows/deploy-pages.yml:42`, rc 1, nothing else. This proves the scanner sees the file. If the real `9f7129d7` + #10 tree carries other hits, the row's expected output is re-derived by a box run before round 1 and recorded; it is never widened silently.
- **B2. TK1 for a world where #10 is merged.** #10's always-on guard in `vite.config.ts` builds `env = { ...loadEnv(mode, envDir, ""), ...process.env }` and throws `Error("<N> must not be set; the browser client reads Sanity over the public CDN without a token.")` whenever `env.N` is non-empty. So any TK1 build with `N` set throws before it emits anything. TK1 is split in two:
  - **(i) Guard proof, new ID TK1.g (CI).** Programmatic `build()` with the repo config, `N` set to a per-run canary in `process.env` (snapshot and restore as in TK1.r) → the build must reject. The error message must equal exactly `<N> must not be set; the browser client reads Sanity over the public CDN without a token.` (with `N` assembled at runtime), and must not contain the canary. A successful build, or any other error, fails TK1.g. Matched by message content, not by line.
  - **(ii) Canary leak scan (TK1 proper).** Precondition: `N` is absent from `process.env` and from `loadEnv(mode, envDir, "")`, else `SCAN SETUP FAIL: N present`, so the build can't throw or pass vacuously. Set distinct per-run canaries under names the guard does not check: `SANITY_API_READ_TOKEN`, `SANITY_READ_TOKEN`, `VITE_SANITY_TOKEN` and `VITE_SANITY_READ_TOKEN`. Build into a temp outDir and scan every output file~~, including `.map` files,~~ *(superseded 1.4.23 §0m / 1.4.24 §0n: dist scanned as shipped; a `.map` is scanned only if one appears)* for each canary value and for the literal `N`. Any hit → `SCAN FAIL: TK1 <file>:<line>`. Clean head: ≥1 output file and zero hits. Vacuity: zero output files → fail; a canary missing from the env the build saw → fail.
  - **Rows, each with its expected red set. All are *reasoned, verify in round 1*:**
    - **M-TOK1 (reworked):** `client/src/lib/sanity.ts` reads `import.meta.env.N`, and `vite.config.ts` adds `define: { "import.meta.env.N": JSON.stringify(process.env.SANITY_API_READ_TOKEN) }`. That is a real exposure path that slips past the guard, because the guard checks `N` only. → red **{TK1, TK2}**: TK1 via (ii) (the `SANITY_API_READ_TOKEN` canary is inlined in the bundle); TK2 via form (a) in `sanity.ts` and form (d) in `define`. TK1.g stays green (the guard is intact).
    - **M-RS2 (vacuity guard removed, empty outDir passes; listed in §0g and §0f, adjusted here only):** killed by TK1's vacuity row, which runs under the (ii) setup (`N` unset, so the build can't throw) against a fixture entry that emits no files → red **{TK1}**. It is never reached through the guard throw.
    - **Test-file-import row (TK1, replaces QA's rev 1.10 wording):** `client/src/leak.test.ts` holds `export const t = import.meta.env.VITE_SANITY_TOKEN;`, and production `client/src/leak.ts` holds `import { t } from "./leak.test"; export const u = t;`, imported from the client entry. → (ii) finds the `VITE_SANITY_TOKEN` canary inlined in the built file → red **{TK1}**. TK2 is green: test files are excluded, and neither file holds `N`. TK1.r is green. A test file reading `N` itself can't leak a value while the guard is in place, because any non-empty `N` throws (TK1.g). The residual path is non-guarded names, which (ii) covers.
    - **M-TOK11 (new):** #10's guard removed from `vite.config.ts` → red **{TK1.g}** (the build succeeds); TK1 (ii) stays green.
    - **Clean control:** TK1, TK1.g and TK1.r all green on main-with-#7-and-#10 (the B1 fixture); verified by a box run before round 1.
- **N1, review item (no TK2 scope).** TS cast forms are not matched by TK2: `(import.meta.env as any).N`, `(import.meta.env as Env).N`, `const e = import.meta.env as any; e.N`. The reviewer checks for them. TK1 (ii) is the backstop for non-guarded names, and #10's guard plus TK1.g cover `N`.
- **N2, review item (no TK2 scope).** These directories and files are outside TK2's file set: `shared/**` (bundled into the client), `vite/**`, `sanity/**`, root `sanity.config.ts` / `sanity.cli.ts` and other root `*.config.ts` files (including `vitest.workers.config.ts`). The reviewer checks them. **Candidate follow-up for Web Lead:** widening TK2's file set to these paths in a later rev or PR.
- **N3:** Item 9 stays pending Ethan's direct answer (header G2, E-R9); unchanged.
- **QA deltas:** new gate IDs **TK1.g**, **TK2.m7**; TK1 rewritten as (ii); the TK1 test-file-import row and M-TOK1 rows rewritten; M-RS2 row re-pointed at the (ii) vacuity row; TK2.m fixture redefined with an SHA and md5 table; new mutation **M-TOK11** {TK1.g}. N1 and N2 go in the review list (no IDs). Expected counts: `gate-ids` **225** (223 + 2), mutations **207** (206 + 1), box 11, post-deploy 11.
- **D3** freeze note kept, now naming 1.4.22 (header).

## 0k. Rev 1.4.21: TK2 odd forms (2026-10-19). Read first; wins over §0j where they differ. Nothing outside TK2 changed.
- **Matching mechanics.** Each scanned file is read whole (CRLF → LF) and matched with multiline regexes. `\s` spans newlines, so whitespace or a newline around every `.`, `?.` and `[` is covered. Comments are **not** stripped, so a real use followed by `// …` or `# …` on the same line still fails. `<line>` in `SCAN FAIL: TK2 <file>:<line>` is the 1-based line holding the `N` token of the match. Hits are de-duplicated per (file, line), so a line matched by two forms prints exactly one SCAN FAIL. Notation: `D` = `\s*(?:\?\.|\.)\s*`; `ENV` = `(?:import D meta D env|process D env)`; `Q` = one of `"`, `'` or a backtick.
- **(a) widened, env reads:** `ENV D N\b` or `ENV \s*(?:\?\.)?\s*\[\s*Q N Q\s*\]`. Covers `import.meta?.env?.N`, `process.env?.N`, `process.env?.["N"]`, `import.meta.env [ 'N' ]` and `import` / `.meta` / `.env` / `.N` split across lines.
- **(a2) new, destructuring:** `\{[^{}]*\bN\b[^{}]*\}\s*=\s*ENV`, multiline (`{ N }`, `{ N: x }`, a multi-line pattern with other keys). Nested braces inside the pattern are a review item.
- **(a3) new, static alias:** `(const|let|var) <id> = ENV` where the right-hand side is **exactly** `ENV` (ending at `;` or end of line), then anywhere later in the same file `<id> D N\b` or `<id>[ "N" ]` (with optional `?.`). **Review items (not matchable statically):** an alias whose right-hand side is anything else (spread or merged objects such as #10's `{ ...loadEnv(…), ...process.env }`, a call, a conditional, re-assignment), an alias passed across functions or files, and the runtime-built names already listed in §0i/§0j.
- **(b) confirmed for YAML flow mappings:** `N["']?\s*(:|=(?!=))` matches `{N: x}` and `{ "N": x }` (the name is followed by `:` or `":`). New plants are listed below.
- **(c) widened:** `\b(?:secrets|vars)(?:D N\b|\s*\[\s*Q N Q\s*\])`, so `secrets['N']`, `secrets["N"]`, `vars['N']` and `vars["N"]` are covered alongside the dot forms.
- **New planted positives** (temp fixture trees; each gives exactly one `SCAN FAIL: TK2 <file>:<line>` at the stated line): `import.meta?.env?.N` (L1); `process.env?.N` (L1); `process.env?.["N"]` (L1); `import`↵`.meta`↵`.env`↵`.N` (L4); `import.meta.env [ 'N' ]` (L1); `const { N } = import.meta.env;` (L1); `const {`↵`A,`↵`N: x,`↵`} = process.env;` (L3); `const env = import.meta.env;`↵`foo(env.N);` (L2); `${{ secrets['N'] }}`; `${{ secrets["N"] }}`; `${{ vars['N'] }}`; `${{ vars["N"] }}`; YAML `env: {N: x}` and `env: { "N": x }`; `x = import.meta.env.N // note`; `.env` `N=1 # note`. Negatives (no hit): `if (k === "N") {}`; `const env = { ...loadEnv(m, d, ""), ...process.env };`↵`String(env.N ?? "")`; `throw new Error("N must not be set; …")`.
- **Clean control re-check (TK2.m).** I ran a prototype of these exact regexes (`/workspace/specs/metfix-pr2-tk2-prototype-1.4.21.py`, box only) over #10 head `2fdecd34`'s added and context lines in every scanned file: `.github/workflows/ci.yml`, `client/src/const.ts`, `client/src/lib/sanity.ts`, `client/src/vite-env.d.ts`, `vite.config.ts`, `vitest.workers.config.ts`. **Zero hits.** The `vite.config.ts` guard does not hit: `env` is bound to a spread object, not exactly `ENV` (a3), and `env.N` is not an `ENV` read (a). The error string does not hit either, because no `:` or `=` follows the name. **So no `vite.config.ts` content exception is added.** If #10's merged bytes change and any form hits a guard line, that needs a new rev; no exception is pre-authorised.
- **Mutations (new, each red {TK2}):** **M-TOK7** optional chaining and whitespace dropped (only a literal `.` with no spaces) → killed by the `?.` and multi-line plants; **M-TOK8** destructuring (a2) and static alias (a3) dropped → killed by the destructuring/alias plants; **M-TOK9** bracket forms of `secrets`/`vars` dropped → killed by the bracket plants; **M-TOK10** lines containing `//` or `#` skipped → killed by the same-line-comment plants. M-TOK1/2/3/5/6 unchanged; M-TOK3 is still {TK2.m}.
- **QA impact:** no IDs added or retired; TK2 gains the rows above. Expected counts: `gate-ids` **223**, mutations **206** (202 + M-TOK7–M-TOK10); box 11, post-deploy 11.
- **D3** freeze note kept, now naming 1.4.21 (header).

## 0j. Rev 1.4.20: TK2 real-use forms, extended (2026-10-19). Read first; wins over §0i and §0h's TK2 bullet. Nothing outside TK2 changed.
- **Why.** §0i's literal-anywhere rule is withdrawn. It turned TK2 red on main-with-#10: #10's client tests and `vite.config.ts` guard, its docs pair and PR2's own docs pair all contain the name. CQ also withdrew its worker/ test-file point (#10 changes no worker/ file), so §0i's second-exception question is closed with no exception. TK2 returns to **real-use matching**, with no literal-anywhere rule and no path-and-content exceptions.
- **File set** (as in 1.4.18): `git ls-files` over source, env files (`.env*`, `.dev.vars*`), `vite.config.*` and `.github/workflows/*`, excluding `**/*.test.ts`, `**/*.test.tsx` and `docs/**`. The scanner (`worker/repo-scan.test.ts`) still builds the name at runtime, so it holds no literal (kept from §0i). Own zero-files guard; git unavailable → `SCAN SETUP FAIL`. Message `SCAN FAIL: TK2 <file>:<line>`. Matching is case-sensitive. `N` below is the name `VITE_SANITY_API_READ_TOKEN`.
- **Forms that fail** (each needs a planted positive, see below):
  - **(a) Env reads:** `import.meta.env.N`, `import.meta.env["N"]` / `['N']`; `process.env.N`, `process.env["N"]` / `['N']`.
  - **(b) Assignments:** `N` followed by optional closing quote and optional whitespace, then `:` or `=`, i.e. `N["']?\s*[:=]`, anywhere in the file set. This covers env-file `N=…` / `export N=…`, YAML keys `N:`, object keys `N: …` / `"N": …`, and shell `N="…"`. A `==`/`===` comparison is not an assignment (the regex requires `[:=]` not followed by `=`, i.e. `N["']?\s*(:|=(?!=))`).
  - **(c) Workflow secret/var references:** `secrets.N`, `vars.N` in `.github/workflows/*`.
  - **(d) Vite `define` keys:** in `vite.config.*`, any key **or value** inside the object literal passed as `define` (brace-matched slice from `define:` to its closing `}`) that contains `N` (e.g. `"import.meta.env.N": JSON.stringify(…)`, `__SANITY_TOKEN__: JSON.stringify(process.env.N)`).
  - **(e) `envPrefix` exposing the token:** in `vite.config.*`, an `envPrefix` whose value (a string literal or an array of string literals) contains an entry that is a prefix of `N` **other than exactly `"VITE_"`**. That catches `""`, `"V"`, `"VITE_SANITY_"`, `"VITE_SANITY_API_READ_TOKEN"` and the like. A non-literal `envPrefix` value (variable, call, spread) also fails, because it can't be checked statically. Plain `"VITE_"` (Vite's default) is not a hit. Default exposure is covered by #10's build guard (the build throws when `N` is non-empty) and by TK1.
- **Not hits (stated so the clean control is exact):** #10's `ci.yml` grep line (`'N' dist/public`: no `:`/`=` after the name); #10's `vite.config.ts` guard lines (`String(env.N ?? "")` reads `env.`, not `import.meta.env.`/`process.env.`; the error string `"N must not be set; …"` has no `:`/`=` after the name); #10's test files (excluded by path); docs (excluded).
- **Review item (out of scope for the static scan):** a name built at runtime by concatenation, a template literal or a computed key (kept from §0i). TK1 is the runtime backstop.
- **Planted positives (rows of TK2, each in a temp fixture tree from `mkdtemp(os.tmpdir())`, removed in `finally`; each row asserts exactly one `SCAN FAIL: TK2 <file>:<line>` at the planted line):** (a) one row per env-read variant (dot, double-bracket, single-bracket × `import.meta.env`/`process.env`) in a `client/src/*.ts` file; (b) `.env` `N=x`, `.env.local` `export N=x`, `.dev.vars` `N = x`, workflow YAML key `N: x`, TS object key `N: "x"` and `"N": "x"`; plus a negative row `if (k === "N")` → no hit; (c) `${{ secrets.N }}` and `${{ vars.N }}` in a workflow; (d) `define: { "import.meta.env.N": JSON.stringify("x") }` and `define: { __T__: JSON.stringify(process.env.N) }` in `vite.config.ts`; (e) `envPrefix: ""`, `envPrefix: "VITE_SANITY_"`, `envPrefix: ["VITE_", "VITE_SANITY_API_"]`, `envPrefix: prefixes` (non-literal); plus negatives `envPrefix: "VITE_"` and `envPrefix: ["VITE_", "PUBLIC_"]` → no hit.
- **Clean control (TK2.m, kept; fixture defined).** It runs on a **fixture tree**: a temp git repo holding main `9f7129d7`'s tracked files with #10 head `2fdecd342bcd9df2771ddf306b26c6495998d826`'s 11 changed files overlaid byte-for-byte (blob bytes from #10's head, md5 per file recorded in the QA list), plus PR2's scanner. TK2 → zero hits, ≥1 file of each class scanned. At the B4 rebase, if #10's merged bytes differ from `2fdecd34`, the fixture is re-cut from merged main and the merged bytes win.
- **Mutations:** M-TOK3 kept: TK2 reverted to bare-name match → red {TK2.m} (the #10 `ci.yml` grep line and guard lines become hits). M-TOK1 {TK1, TK2} and M-TOK2 {TK2} unchanged. New **M-TOK5** (define-object scan dropped) → red {TK2}, via row (d); new **M-TOK6** (envPrefix check dropped) → red {TK2}, via row (e).
- **QA impact:** no IDs retired; TK2 rows rewritten as above; TK2.m gets the fixture definition; +2 mutations (M-TOK5, M-TOK6). Expected counts: `gate-ids` **223** (unchanged from 1.4.18), mutations **202**.
- **D3** freeze note kept, now naming 1.4.20 (header).

## 0i. Rev 1.4.19: TK2 literal scan (2026-10-19). Read first; wins over §0h's TK2 bullet and any earlier TK2 text. Nothing else changed.
- *(1.4.20, §0j: this section is superseded (literal-anywhere rule and its exception withdrawn; the open conflict is resolved by going back to real-use matching). Kept as history.)*
- **TK2 rule.** TK2 fails on **any occurrence** of the literal `VITE_SANITY_API_READ_TOKEN` in **any tracked file** (`git ls-files`, every path, **tests included**; no file-type or directory exclusions). Match: case-sensitive, plain substring (not a regex, no word boundaries). Message `SCAN FAIL: TK2 <file>:<line>`, one line per hit, all hits printed; own zero-files guard (zero tracked files scanned → fail); git unavailable → `SCAN SETUP FAIL`.
- **One exception, exact path and content.** In `.github/workflows/ci.yml` only, a line equal **byte-for-byte, as the whole line** (excluding only its LF terminator; leading indentation included) to the single grep line in #10's merged `ci.yml` is not a hit. The test holds that line as a constant captured from main after #10 merges (with its md5 recorded in the QA list). Any difference (whitespace, flags, path, an extra line holding the name, or the same line in another file) is a hit. No other exception exists.
- **No literal in the test file.** `worker/repo-scan.test.ts` builds the name at runtime (e.g. `["VITE", "SANITY", "API", "READ", "TOKEN"].join("_")`), and the exception constant is stored so it contains no contiguous literal either (e.g. assembled from parts at runtime). So the scanner scans itself and stays clean.
- **Fixtures.** Plant fixtures live in `mkdtemp(os.tmpdir())` trees, removed in `finally`, never in the repo. **TK2's clean control runs on a fixture tree** (a temp git repo whose tracked files contain no literal, plus the byte-exact #10 `ci.yml` fixture), not on the live repo.
- **Review item (out of scope for the static scan).** A name built at runtime through concatenation, a template literal or a computed key (e.g. `import.meta.env["VITE_" + "SANITY…"]`) is not caught by TK2. It is a **review item**: the CQ/QA reviewer checks client and worker code for any env key assembled at runtime that resolves to the token name. TK1 (canary in the built bundle) remains the runtime backstop.
- **Unchanged:** TK2.m (clean case on the byte-exact #10 merged `ci.yml` fixture) and M-TOK3 (→ red {TK2.m}) stay as written in §0h. With the literal rule, M-TOK3's "reverted to bare-name match" now means "exception dropped": the #10 grep line becomes a hit, so the red set is still exactly {TK2.m}. M-TOK1 {TK1, TK2} and M-TOK2 {TK2} unchanged.
- **Exception 1 line as read (not yet merged).** At #10 head `2fdecd342bcd9df2771ddf306b26c6495998d826` (PR open, not merged; read 2026-10-19 through cursor-github, read only) the `ci.yml` line is, between the backtick fences, with 10 leading spaces: `          if grep -rIlE --include='*.js' --include='*.html' --include='*.css' --include='*.map' 'VITE_SANITY_API_READ_TOKEN' dist/public; then`. The test constant must be re-captured from main after #10 merges; if it differs from this line, the merged bytes win.
- **Second exception (steering request: "worker/'s own test file in #10"): NOT ADDED, could not be verified.** #10 at `2fdecd34` changes **no file under `worker/`**. Its 11 changed files are `.github/workflows/ci.yml`, `client/src/const.ts`, `client/src/lib/sanity.config.test.ts`, `client/src/lib/sanity.fetch.test.ts`, `client/src/lib/sanity.ts`, `client/src/lib/sanity.vite-guard.test.ts`, `client/src/vite-env.d.ts`, the two files in `docs/metfix-sanity-read-token-fix/`, `vite.config.ts` and `vitest.workers.config.ts`. CQ pin check 4 B4's "worker/'s own test file" reads as PR2's own `worker/repo-scan.test.ts`, which §0i already handles by building the name at runtime. No worker exception, clean-control row or mutation is specified until Web Lead names the file.
- **OPEN CONFLICT (needs a Web Lead ruling before freeze).** In #10's head the literal also appears on these added lines, each of which makes TK2 red on main-with-#10 under the literal-anywhere rule:
  - `client/src/lib/sanity.config.test.ts`: `    vi.stubEnv("VITE_SANITY_API_READ_TOKEN", dummy);`
  - `client/src/lib/sanity.vite-guard.test.ts`: `const NAME = "VITE_SANITY_API_READ_TOKEN";` (K1.7 cites line 7)
  - `vite.config.ts`, 2 lines (production build guard, K1.7 cites L212/L215): `  const sanityReadToken = String(env.VITE_SANITY_API_READ_TOKEN ?? "").trim();` and `      "VITE_SANITY_API_READ_TOKEN must not be set; the browser client reads Sanity over the public CDN without a token.",`
  - both `docs/metfix-sanity-read-token-fix/` files (many lines);
  - and PR2's own docs pair `docs/metfix-pr2-comments-login/` (this spec copy contains the literal).
  Options for Web Lead: (a) add exact path-and-content exceptions for those #10 lines (the same form as exception 1) and exclude `docs/*/` spec and list copies; (b) revert to 1.4.18's real-use matching; (c) narrow TK2's file set. Until ruled, TK2.m (clean on main-with-#10) cannot pass as written.
- **D3** freeze note kept, now naming 1.4.19 (header).

## 0h. Rev 1.4.18: Web Lead ruling option (a) (2026-10-19) and CQ pin check 4 (`metfix-pr2-cq-pin-check-4.md` md5 `4e34120660b8e5a180d57dfd67208bb3`). Read first; wins over §0a–§0g and any later text it contradicts.
- **RS-A1 removed from `npm test` (Web Lead ruling 2026-10-19, option (a); closes CQ B2).** The S-G2 file-scope check no longer lives in `worker/repo-scan.test.ts`. It runs in the gate's shared scope step (gate spec 1.0.12 A9.12): only on `pull_request` events, diff vs merge-base(main), skipped on `push` to main by the workflow `if:` on the event; more than one docs pair → `SCAN SETUP FAIL`. PR2 does **not** edit ci.yml (D2/R-B stand); the gate PR merges first (R-A).
- **S-G2 becomes this spec's `allowed-files` block** (in §0b.3, format per gate A9.12.1). PR2's own docs pair `docs/metfix-pr2-comments-login/` is implicitly allowed. "The `*.test.ts` beside each" is written as `<module>*.test.ts` entries (covers `.workers.test.ts`). `.github/workflows/ci.yml` is not in the block, so a ci.yml edit fails as out of scope. The `wrangler.jsonc` qualifier (bindings/migration/`workers_dev:false`) stays a review item.
- **globalSetup removed.** PR2 adds **no** vitest `globalSetup` and no `vitest.config` change; §0g F1 and §0f RS-A1 (1)–(6) move into the gate's history machinery (gate A9.13). CQ B1, B3, N1, N2, N3 are closed there.
- **Retired QA IDs (superseded, re-homed in the gate list per gate §R5):** A1.2 (= RS-A1) → gate SC1/SC2/SC7; RS-A1s1 → HM1; RS-A1s1-stale → HM1-stale; RS-A1s2 → HM2; RS-A1s3 → HM3. **Retired mutations:** M-RS1 → GM68; M-RS3 → GM76; M-RS4 → GM77; M-RS5 → GM74; M-RS6 → GM75 (red {HM1-stale}; the M-RS6 erratum (CQ N5) is retired with the ID). PR0.3 (box) now checks every delivered path against the `allowed-files` block instead of "the A1.2 allowlist".
- **TK2 fix (CQ B4).** *(Superseded by §0i, 1.4.19: real-use matching dropped. Kept as history.)* TK2 matches **real uses only**, never the bare name: (a) `import.meta.env.VITE_SANITY_API_READ_TOKEN` or `import.meta.env["VITE_SANITY_API_READ_TOKEN"]`/`['…']`; (b) `process.env.VITE_SANITY_API_READ_TOKEN` (and bracket forms); (c) an env-file assignment `^\s*(export\s+)?VITE_SANITY_API_READ_TOKEN\s*=` in any tracked `.env*` / `.dev.vars*` file; (d) a YAML mapping key `^\s*VITE_SANITY_API_READ_TOKEN\s*:` or a `secrets.VITE_SANITY_API_READ_TOKEN` / `vars.VITE_SANITY_API_READ_TOKEN` expression in `.github/workflows/*`; (e) a `define` key or `envPrefix`/`loadEnv` reference naming it in `vite.config.*`. File set: `git ls-files` over source, env files, Vite config and `.github/workflows/*`, **excluding** `**/*.test.ts` and `**/*.test.tsx` (so `worker/repo-scan.test.ts` and its pattern literals are never scanned); plant fixtures live in a `mkdtemp(os.tmpdir())` copy, never in the repo. #10's ci.yml grep step (`grep -rIlE … 'VITE_SANITY_API_READ_TOKEN' dist/public`) matches none of (a)–(e), so main-with-#10 is clean. Message `SCAN FAIL: TK2 <file>:<line>`; own zero-files guard. New QA ID **TK2.m** (CI): clean-code case over a byte-exact fixture of #10's merged `.github/workflows/ci.yml` (captured from main after #10, md5 recorded in the list) plus the real head after merging main → no hit, ≥1 workflow file scanned. TK2's existing one-positive-per-location rows become one row per use pattern (a)–(e). New mutation **M-TOK3** (TK2 reverted to bare-name match) → red {TK2.m}. M-TOK1 {TK1, TK2} and M-TOK2 {TK2} unchanged (both plant real uses).
- **TK1 in-test build (CQ N4).** Snapshot `process.env` before the build and restore it in `finally` (or build in a child process); `outDir` and `cacheDir` from `mkdtemp(os.tmpdir())`, removed in `finally`; explicit test timeout **120 s**. New QA ID **TK1.r** (CI): after TK1, `process.env` deep-equals the snapshot (no canary key left), the repo porcelain is unchanged and the temp dirs are gone. New mutation **M-TOK4** (env restore removed) → red {TK1.r}.
- **Remaining scan tests in `npm test`:** TK1, TK2, RS-C5, RS-AU22, RS-T6 (each with its own zero-files guard). RS-A1 is no longer one of them.
- **Expected list deltas (QA recounts):** `gate-ids` 226 − 5 + 2 = **223**; mutations 203 − 5 + 2 = **200**; box 11, post-deploy 11 unchanged. CK-P1 stays in `box-ids` until the gate is on main.
- **D3** freeze note kept, now naming 1.4.18 (header).

## 0g. Rev 1.4.17: Web Lead ruling on RS-A1 freshness and QA list PR2 1.6 items (2026-10-19). Read first; wins over §0a–§0f and any later text it contradicts.
- *(1.4.18, §0h: F1, RS-A1s1/RS-A1s1-stale and M-RS5/M-RS6 below are superseded; the machinery and IDs moved to the gate scope step, gate 1.0.12 A9.13/§R5. Kept as history.)*
- **F1 freshness (Web Lead ruling 2026-10-19; supersedes item (3) "fetch skipped if `origin/main` is already present" in RS-A1).** The vitest `globalSetup` (once per run, never inside tests) runs `git ls-remote origin refs/heads/main` **on every run**, using the credentials `actions/checkout` persisted, and compares that SHA with the local `origin/main` SHA. Equal → no fetch. Different or absent → depth-limited `git fetch --depth=<N> origin main`, then re-compare. Hard **`SCAN SETUP FAIL`** (rc ≠ 0, never a skip) if: ls-remote fails; the SHAs still differ after the fetch; the fetch fails; or no merge-base is found. Never print credentials, a credentialed URL, or unredacted git stderr (stderr is redacted before any output). The R-A fallback stays on top.
- **RS-A1s1 (re-worded).** Asserts the local `origin/main` SHA **equals the ls-remote SHA** before the scope scan runs (not merely that the ref is present); merge-base found → RS-A1 runs. New case **RS-A1s1-stale**: a stale or planted local `origin/main` (e.g. `git update-ref refs/remotes/origin/main <older or unrelated SHA>`) → setup detects the mismatch, fetches, and the ref then equals the ls-remote SHA; if the planted ref survives (fetch blocked) → `SCAN SETUP FAIL`. RS-A1s2/RS-A1s3 unchanged (RS-A1s2 adds: ls-remote failure → `SCAN SETUP FAIL`).
- **s1-killing mutations.** **M-RS5** setup always fetches, ignoring the freshness compare (red {RS-A1s1}: RS-A1s1 asserts no fetch when SHAs match). **M-RS6** setup skips the fetch whenever `origin/main` exists, with no freshness check (red {RS-A1s1}; the RS-A1s1-stale planted-ref case belongs here).
- **Zero-files guard (all scan tests).** Every repo-scan test has **its own** zero-files / missing-dir guard (no shared guard), so a vacuity mutation on one test is red only on that test. M-RS2 (TK1 vacuity guard removed with empty build) is exact on {TK1}.
- **F2 M-KVF1 red set** is exactly **{AU5.k, AU5.4, AU5.6}** (AU5.4 at +23 h and AU5.6 at 89 days also hit an expired KV entry; supersedes "{AU5.k}" in §0d B3).
- **F4 TK1 message.** TK1 fails with **`SCAN FAIL: TK1 <file>:<line>`**, replacing `TOKEN LEAK: <name|canary> in <file>`, for ~~source maps and~~ minified code *(superseded 1.4.23 §0m / 1.4.24 §0n: dist scanned as shipped; a `.map` is scanned only if one appears)*; `<line>` is the 1-based line in the emitted file. TK1 now follows the common scan-test format.
- **F5 M22.** AU6.2 dropped from M22's red set (empty DO storage does not affect a silent refresh of a live session).
- **D3** freeze note kept, now naming 1.4.17 (header).

## 0f. Rev 1.4.15: Web Lead rulings R-A and R-B (2026-10-19). Read first; wins over §0a–§0e and any later text it contradicts.
- **R-A CK-P1 coverage (Web Lead ruling 2026-10-19).** **Default:** the gate infra PR merges to main first; PR2 brings in main (merge preferred, PR0/E1) before its final round, so CI's shared CK-P1 step runs on PR2's real head. **Fallback** (only if the gate PR has not landed): QA re-runs CK-P1 on the **exact merge-candidate SHA** and Web Lead signs off on that SHA. **A-PIN1 evidence is valid only for the SHA it records; any push after it voids the sign-off.** A-PIN1 (pre-r1) stays as the early check only.
- **R-B D2 wins (Web Lead ruling 2026-10-19).** **PR2 never edits `.github/workflows/ci.yml`.** Every CI grep/`rg`/step rule in this spec becomes a **vitest repo-scan test in PR2's own test files**, run by the existing CI test job (`npm test`); no new job, step or flag. New file **`worker/repo-scan.test.ts`** (added to the S-G2 allowlist as one of "the `*.test.ts`"; named here so it is explicit). Each scan test reads files with `node:fs` from the repo root, fails printing `SCAN FAIL: <rule> <file>:<line>` (TK1 included, per §0g F4), has a **vacuity guard** (empty file set / missing dir → fail), and needs **sabotage proof** (QA plants the forbidden pattern on a scratch branch → the test turns red). Mapping:
  - **TK1 (A-TOK1, dist/ bundle).** **Choice: a vitest test that runs the build itself** (programmatic Vite `build()` into a temp outDir with the canary set in `process.env` for that build only), then scans every output file ~~incl. source maps~~ *(superseded 1.4.23 §0m / 1.4.24 §0n: dist scanned as shipped; a `.map` is scanned only if one appears)*. Chosen over relying on the existing build job's `dist/` because it controls the canary and does not depend on CI step order, and needs no ci.yml edit. Vacuity: zero output files or canary not seen in the build env → fail.
  - **TK2 (A-TOK1b, tracked files).** `git ls-files` over source, env files, Vite config and `.github/workflows/*` → any `VITE_SANITY_API_READ_TOKEN` hit fails (after main is in, per E2). Fails with `SCAN SETUP FAIL` if git is unavailable.
  - **RS-C5 (C5, was CI step "No BFF origin in client or bundle").** `metfix-bff|wispy-mode-982d|workers\.dev` in `client/`, `shared/` and in TK1's build output → fail. The C5 third bullet (new-code-only `VITE_*(KEY|SECRET|TOKEN)` check) becomes a full scan of `client/` once main is in (E2), with no allowlist for the Sanity token.
  - **RS-AU22 (AU22/R20/S-G19, was CI grep).** Scoped `localStorage`/`sessionStorage`/`document.cookie` scan with the by-content S-G19 allowlist; `brokenscience\.org` in `client/` and the build output → fail.
  - **RS-T6 (T6, was CI grep).** No `dangerouslySetInnerHTML` under `the-daily-fix/`.
  - **RS-A1 (A1/S-G2, was "CI diff check").** `git diff --name-only <merge-base main>...HEAD` ⊆ S-G2 allowlist, and `.github/workflows/ci.yml` not in the diff. Main ref/merge base unavailable → `SCAN SETUP FAIL` (never pass). (1.4.16) **Ruling (Web Lead 2026-10-19, main's history for the file-scope scan; replaces the open question):** (1) the main ref is obtained **once in the vitest `globalSetup`**, never inside individual tests; (2) via a depth-limited `git fetch --depth=<N> origin main` using the credentials `actions/checkout` already persisted (do not assume the repo is public; never print a token or a credentialed remote URL; git stderr is redacted before any output); (3) ~~the fetch is skipped if `origin/main` is already present~~ (superseded 1.4.17, §0g F1: ls-remote freshness check every run); (4) a failed fetch, or no merge-base found, → hard `SCAN SETUP FAIL`, never a skip; (5) sabotage proof: with no remote configured, setup must fail; (6) the R-A fallback (QA run on the exact merge-candidate SHA with Web Lead sign-off) stays on top. Suggested QA IDs (CI, `gate-ids`): **RS-A1s1** setup control (fetch runs once in globalSetup; `origin/main` already present → no fetch; merge-base found → RS-A1 runs); **RS-A1s2** no remote configured → `SCAN SETUP FAIL`, rc ≠ 0, not skipped (also unreachable/failed fetch, and no merge-base on a disjoint history); **RS-A1s3** setup output and git stderr contain no token and no credentialed URL (plant `https://x-access-token:SECRET@…` remote → `SECRET` absent). Suggested mutations: **M-RS3** setup skips on fetch failure (red {RS-A1s2}); **M-RS4** setup prints the remote URL (red {RS-A1s3}).
  - **CK-CI1** is re-homed: its spec rev/md5 part is CK-P1 (gate script, R-A); cited-head == PR head stays a review/sign-off check at the R-A SHA; the AU22 grep is RS-AU22; the `workers_dev:false` assertion stays in `worker/build.config.test.ts`.
- **QA impact:** TK1/TK2 re-targeted to vitest tests (TK1 builds in-test); new CI IDs **RS-C5**, **RS-AU22**, **RS-T6**, **RS-A1** in `gate-ids` (QA may keep existing IDs if its list already covers C5/AU22/T6/A1, re-targeting them instead of adding), each with a plant case; suggested mutations **M-RS1** (RS-A1 ignores ci.yml; red {RS-A1}), **M-RS2** (TK1 vacuity guard removed with empty build; red {TK1}); (1.4.16) RS-A1 setup IDs **RS-A1s1–RS-A1s3** and **M-RS3**/**M-RS4** per RS-A1. Any QA ID that said "ci.yml step" is re-worded to "vitest repo-scan test". Close any CK-P1 local-only line per R-A.
- **D3** freeze note kept, now naming 1.4.15 (header).

## 0e. Rev 1.4.14: Web Lead ruling on the #10 token fix (2026-10-19, condition 1). Read first; wins over §0a–§0d and any later text it contradicts.
- **E1 (Web Lead ruling 2026-10-19, approved with conditions).** PR2 gets the Sanity token fix from #10 when it brings in main. Web Lead's wording was "when it rebases on main"; **merging main into the PR branch satisfies it** (the condition is that #10's fix is in PR2's history, not the method). PR0 is unchanged: merging main in is preferred over a rebase, and **any force-push to the PR branch needs Ethan's own OK in chat** (Web Lead or CEO relay does not count). R24 now reads "#10 lands first; PR2 brings in main (merge preferred)".
- **E2 (Web Lead ruling 2026-10-19).** PR2 must **not reintroduce `VITE_SANITY_API_READ_TOKEN` anywhere**: not in source (`client/`, `worker/`, `src/`, `scripts/`), env files (`.env*`, `.dev.vars*`, `wrangler.*`), Vite config (`vite.config.*`, `define`/`envPrefix`), or workflows (`.github/workflows/*`, which PR2 does not edit anyway per D2). The §C new-code-only grep exception for the Sanity token ends once main is in: after the merge, **any** hit of the name in the PR head's tracked files fails.
- **Acceptance item A-TOK1 (merge-gating, CI; 1.4.15 §0f: a vitest test that runs the build itself, no ci.yml edit).** A CI test builds the client with a **canary** value injected into the build env (`VITE_SANITY_API_READ_TOKEN=metfix-canary-<random per run>` plus the same canary under the secret's other plausible names, e.g. `SANITY_API_READ_TOKEN`), then greps every file under the built `dist/` (text ~~and source maps~~ *(superseded 1.4.23 §0m / 1.4.24 §0n: dist scanned as shipped; a `.map` is scanned only if one appears)*) for (a) the literal variable name `VITE_SANITY_API_READ_TOKEN` and (b) the canary value. Either hit → fail, printing `SCAN FAIL: TK1 <file>:<line>` (1.4.17 §0g F4; was `TOKEN LEAK: …`) and rc 1. Vacuity: the test fails if `dist/` has zero files or the canary was not actually set in the build env. A companion check (A-TOK1b) greps the PR head's tracked files (source, env files, Vite config, workflows) for the variable name and fails on any hit.
- **Suggested QA IDs:** **TK1** (dist/ bundle has neither the name nor the canary; vacuity cases: empty dist/ fails, canary unset fails); **TK2** (tracked-file grep across source, env files, vite config, workflows; one positive fixture per location). Both CI IDs in `gate-ids`.
- **Mutation M-TOK1:** reintroduce the variable (e.g. `import.meta.env.VITE_SANITY_API_READ_TOKEN` read in a client module, with `define`/env passing it through) → must turn **TK1** red (exact red set {TK1, TK2}, since TK2 also sees the name in source). **M-TOK2 (optional):** add `VITE_SANITY_API_READ_TOKEN` only to an env file → red set {TK2}.
- **QA impact:** header pins the 1.4.14 md5; add TK1, TK2 (gate-ids), M-TOK1, M-TOK2; R24 wording.

## 0d. Rev 1.4.13: CQ pin check 3 (`metfix-pr2-cq-pin-check-3.md` md5 `c2d8bc8c0f5a3915cb40a1c640ba7071`) and Web Lead rulings D1–D3 (2026-10-19). Read first; wins over §0a–§0c and any later text it contradicts.
- **B1 (blocker).** §8a "Mutual pin" bullet deleted (contradicted the one-way ruling).
- **B2 (blocker) → D1 (Web Lead ruling 2026-10-19).** Outside history, the spec names no QA rev or md5. The governing list is **"the QA list whose header pins this spec's md5"**; Web Lead's handoff names its rev and md5 and is authoritative. No later pin edit is promised. §8a cites Web Lead's ruling, not the PR3 check file.
- **D2 (Web Lead ruling 2026-10-19).** CK-P1 is the gate PR's one shared script + one ci.yml step looping over every `docs/*/` pair. **PR2 never edits `.github/workflows/ci.yml`** (removed from the S-G2 allowlist; R24's ci.yml fix comes from #10 via rebase/merge) and adds only its docs pair `docs/metfix-pr2-comments-login/`. **Pre-r1 acceptance item A-PIN1:** before round 1, PR2 passes the same CK-P1 check run locally against its own docs pair (spec md5 = QA header pin; header gate count = `gate-ids` count); QA logs it as box evidence.
- **D3.** Freeze note in header.
- **B3 (blocker).** S-G16 rewritten: **`SESSION` DO storage is the source of truth for whether a session exists.** User-acting routes (comment POST, leaderboard, logout) resolve the session from the DO and never consult KV; a KV `sess:*` miss never means signed out for writes. New acceptance row **AU5.k**: login, advance the fake clock 61 s (KV entry expired), DO session valid → comment POST **201** and leaderboard **200** via the DO, 0 KV reads on those paths. New mutation **M-KVF1** (user-acting route requires a KV hit, i.e. KV-first session check) → red set exactly {AU5.k}.
- **N1.** R5 now reads: `/me` reads KV, then on a miss rebuilds the 60 s entry from the `SESSION` DO; never BSI, never refresh (G10's DO-down 503 applies). §5 route table and AU21 aligned. Q5 ruling's "KV-only" wording is superseded by this.
- **N2.** A-T18: AAD = `SESSION` DO instance name (R7).
- **N3.** QA CKT1.1: `expectTypeOf<Env>()` also type-checks `SESSION` and `OAUTH_STATE` (DurableObjectNamespace).
- **N4.** §9 adds **E-R9**: Ethan confirms in his own words that CEO-relayed decisions count as his.
- **N5.** PR0: merging main in is preferred over a rebase; any force-push to the PR branch needs Ethan's own OK in chat.
- **QA impact:** header pins the 1.4.13 md5; CK-P1 re-scoped to the shared gate script run locally pre-r1 (A-PIN1), with no PR2 ci.yml step (drop the ci.yml-step case); add AU5.k and M-KVF1; reword M22 so KV is not framed as the session gate; CKT1.1 adds `SESSION`, `OAUTH_STATE`; R9 note cites E-R9.

## 0a. Rev 1.4.1: re-anchor and CQ pre-round-1 rulings (read first; wins over any later text it contradicts)

Source: CQ's notes `metfix-pr2-cq-pre-r1-notes.md` (md5 `1c7fc3e56a7a8b601f4cc778dac97252`, verified), as ruled by Web Lead (relayed). CQ's wording is used for each item; where Web Lead's ruling differs, the ruling wins and the conflict is listed in §0a.X. Code read read-only via GitHub at `3a721dcc`. Line numbers are at that commit.

### 0a.1 Code facts at `3a721dcc` (replace the stale `3470e50c` findings F1, F3, F4, F5)
- Diff vs main (12 files): `client/src/pages/the-daily-fix/{CommentThread.tsx, CommentThread.test.tsx, JoinModal.tsx, JoinModal.test.tsx, TheDailyFixPage.tsx, comments.ts, comments.test.ts, daily-fix.css, page.mount.test.tsx}`, `worker/index.ts` (+50), `worker/index.test.ts` (+78), `worker/upstream.ts` (+45). `data.ts`/`data.test.ts` are main's (A1 met).
- Route: `worker/index.ts:63` `path === "/api/daily-fix/comments" || path === "/api/daily-fix/comments/"` → `handleComments(request, env, fetchImpl, bsiBaseUrl)` (`:64`; no `cache` argument).
- `handleComments` `worker/index.ts:389-432`: non-GET/HEAD → 405 `Allow: GET, HEAD` (`:396-403`); date `isIsoDate` else 400 `bad_date` (`:406-409`); `type` only checked non-empty, else 400 `bad_type` (`:410-413`); upstream call `:415`; ok → `apiRawBody(outcome.bodyText, …)` raw passthrough (`:416-417`); not_found → 404 with `Cache-Control: public, max-age=60` (`:418-424`); everything else → 503 `Retry-After: 300`, `no-store` (`:425-431`). `apiOkHeaders` = `public, max-age=60` browser cache only (`:434-440`); `apiRawBody` (`:443-447`).
- `fetchDailyFixComments` `worker/upstream.ts:184-216`: no key → `nokey` (`:191`); URL `${base}/comments?date=…&type=${encodeURIComponent(type)}` (`:194`, client `type` forwarded); 404 → `not_found` (`:211`); any other non-ok (401/403/429/5xx) → `unavailable` (`:212`); raw text (`:213`).
- Client `comments.ts:4-7`: relative `/api/daily-fix/comments?date=<iso>&type=all` (C1 met). `mapThread` `:26-38` falls back to `Member` only for blank `display_name`; no `deleted` handling.
- `CommentThread.tsx` (3a721dcc): `name` state (`:24`) and name input never sent; `viewerDisplayName` prop (`:20`) never passed by `TheDailyFixPage.tsx` (`:347-349` passes only `load`, `pillar`); logged-in submit branch is empty (`:83` "Logged-in POST is not wired yet"). `JoinModal.tsx:128-133` Continue-with-Google handler is empty.

### 0a.2 Rulings (CQ item → acceptance)
- **R1 (CQ 1, blocking).** "The spec is anchored to stale code… Re-anchor to 3a721dcc as rev 1.4.1, with a 1.4 backup." Done: header, §0a.1, F3, §7. Backup `.rev1.4.md` kept.
  - **CHK-1 (CI).** A spec rev/md5 check plus a check that the head the spec cites (`3a721dcc` or its successor named in the PR body) matches the PR head.
- **R2 (CQ 2, blocking).** "The existing read path already breaks the spec at 3a721dcc." The existing code must be changed to meet:
  - **W1** exact path only: `/api/daily-fix/comments/` → JSON 404 (remove the `||` at `index.ts:63`).
  - **W3** `type` allowlist `belly|body|brain|all`, typed as a literal union `CommentType`; errors `invalid_date` / `invalid_type` (rename `bad_*`); the upstream URL uses the validated literal only.
  - **W6** **✔ Confirmed by Web Lead (1.4.2).** BSI 401 and 403 map separately (both still 503 `unavailable` to the browser, but distinct `outcome.kind` values `unauthorized` / `forbidden` in `CommentsUpstream`, each logged by kind); BSI 429 → 503 `unavailable` with `Retry-After: 60`; a 404 is `Cache-Control: no-store` and is never cached.
  - **W7/W8** the BSI body is mapped through a whitelist (no `apiRawBody` on this route): no `user.id`, no `liked`, `Member` per B4-W, `deleted == 1` rows dropped (W8).
  - **W9** Cache API caching at the edge (`caches.default`, injectable as `deps.cachesDefault` like the day route).
- **R3 (CQ 3, blocking).** Anonymous reads are always cached, and the cache key ignores Cookie and Authorization. Replaces W9's and L6's "Cookie/Authorization bypasses the cache": the read handler never reads Cookie or Authorization, the key is built only from the allowlisted params, and every read is answered anonymously. (Signed-in leaderboard reads under P11 are the one exception: they carry Bearer and are never cached.)
- **R4 (CQ 4, blocking).** (1.6.4: this is the **session ID**, not BSI refresh-token rotation, §0s.10.) "Keep the id stable across refreshes and rotate only on login or privilege change." Replaces §5.2 Rotation/S4 and AU6/AU7: refresh rewrites the same `sess:<sha256(id)>` entry; ID rotates only on login, Google sign-in and privilege change.
- **R5 (CQ 5, blocking; amended 1.4.13 N1).** `/me` reads KV, then on a miss rebuilds the 60 s entry from the `SESSION` DO; never a BSI call, never a refresh; with no cookie it returns `{signed_in:false}` without a KV read; refresh happens only on user-acting upstream calls. **Drop the browser-facing `/api/auth/refresh`** (route removed from §5.1; requests → JSON 404). **C6 (new).** The client makes one module-cached, single-flight `/me` per app load, shared by the header and CommentThread, refetched only after login or logout, never on route, pillar, focus or an interval. Mount test counts exactly 1.
- **R6 (CQ 6, blocking).** **✔ Confirmed by Web Lead (1.4.2).** CSRF is stateless: `csrf = base64url(HMAC-SHA256(CSRF_SECRET, "v1." + <__Host-mfx_pre value>))` for signed-out forms, and `HMAC(CSRF_SECRET, "v1.sid." + <sid>)` for signed-in POSTs; no KV write for anonymous requests; compared constant-time. **Spec defaults (flagged, Web Lead to confirm):** (a) `/me` does **not** return the token; AU21 stays `{signed_in, public_name}` and `/api/auth/csrf` is the only token source (removes P2's "and `/api/auth/me`"). (b) `/google/start` **mints** `__Host-mfx_pre` when missing (it is a top-level GET navigation and the state must bind to it); it never requires a CSRF header.
- **R7 (CQ 7, blocking).** AES-256-GCM via WebCrypto; a 32-byte base64 `SESSION_ENC_KEY` imported once per isolate; a fresh 12-byte random IV per write; AAD = the `SESSION` DO instance name (`sess:<sha256hex(id)>`; 1.4.7); format `v1.<kid>.<iv>.<ct>` (base64url parts); rotation where `SESSION_ENC_KEY_PREV` decrypts only (never encrypts; a PREV-decrypted read is re-encrypted with the current key on the next write). Tests: ENC-T1 two writes of the same value produce different ciphertexts; ENC-T2 key-rotation read (written under PREV `kid`, read after rotation, succeeds); ENC-T3 a ciphertext moved to another DO instance (AAD swap) fails; ENC-T4 a ciphertext under a different key fails. Failure → session treated as absent (signed out), never a 500.
- **R8 (CQ 8, blocking; fixed 1.4.2 per Web Lead).** Three login throttle layers, all in the Durable Object class `LOGIN_THROTTLE`; each returns 429 `{"error":"rate_limited"}` with `Retry-After` and **never sleeps on the server**; a rejected request makes no BSI call and no reCAPTCHA call.
  - **R8a Per identifier (O6).** DO instance `idFromName("id:" + sha256(lower(trim(identifier))))`: 5 free failures, then lockout 1 s, 2 s, 4 s … 60 s cap; `Retry-After` = ceil(remaining lockout s). A password reset clears it (Q24a, BSI-C9).
  - **R8b Per IP.** DO instance `idFromName("ip:" + sha256(CF-Connecting-IP))`: 20 login attempts per 60 s across identifiers (stuffing); `Retry-After` = ceil(s until the oldest attempt in the window expires).
  - **R8c Site-wide cap.** One global DO instance `idFromName("login:global")`, a single counter of upstream login calls across all identifiers and IPs: **25 per 60 s**, metfix.org's own site-wide breaker, kept far below BSI-C10's 600/min key ceiling so one flood can't use up that ceiling for all users (1.6.4; the old "BSI 30/60 s per-key limit (BSI-C1)" rationale is retired). Over → `Retry-After` = ceil(s until the window frees a slot). Checked last, after R8a/R8b pass, so throttled requests don't consume global slots.
  - Order **(1.4.3, R25, ✔ confirmed by Web Lead):** R8a → R8b → reCAPTCHA → R8c → BSI (**login superseded in 1.6.3: R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10; signup/comment unchanged**). Supersedes the 1.4.2 order and "Checked last" above means "checked after R8a, R8b and reCAPTCHA pass". The DO's storage is the counter (single-writer per instance, so atomic); no KV or in-isolate counter, no Rate Limiting binding for login.
  - ~~**BSI-C1 stays as the ask to BSI** (fix REMOTE_ADDR throttling / raise the per-key cap).~~ Struck in 1.6.4 (BSI-C1 retired; no BSI ask). Tests run all three layers against a mocked DO (CK-W7).
- **R9 (CQ 9).** **One PR** with login and posting (no #2/#2b/#2c split), per Web Lead's relayed ruling that Ethan ruled one PR. **Pending Ethan's direct confirmation to CQ** (CQ notes: "This needs Ethan's own ruling from his chat"). Google stays in #2, gated on BSI-C5/C5a and Ethan's E-A1 answer: until both, the Google button is not rendered and `/api/auth/google/*` return 404.
- **R10 (CQ 10).** The QA test list is pinned by md5 in §8a before round 1 (process; round 1 does not start without it).
- **R11 (CQ 11).** W2 vs WT4 on Allow: resolved as `Allow: GET, HEAD, POST` (POST is the §5 comment write); WT4 becomes PUT/PATCH/DELETE/OPTIONS → 405 `Allow: GET, HEAD, POST`. The §5.2 state record gains `flow: "google" | "wp"` (A-T12).
- **R12 (CQ 12).** **✔ Confirmed by Web Lead (1.4.2).** A browser GET to `/api/auth/callback` returns 400 (`{"error":"invalid_request"}`, no-store) and never trades a code; only the Worker's server-side bridge follow consumes it (the bridge follow is identified in-Worker, not by any request header the browser can set).
- **R13 (CQ 13).** AU12 adds an `azp` check (when present, `azp` == the web client ID). JWKS cached in the Cache API; on a `kid` miss refetch at most once every 5 minutes.
- **R14 (CQ 14).** KV can't make single-use state atomic, so a cross-colo replay within ~60 s is possible; PKCE mitigates it (A-T3, accepted residual). Document the stale signed-in UI after a refresh failure (the next user-acting call returns 401 `signed_out`; the client then clears its `/me` cache and shows signed out).
- **R15 (CQ 15).** **✔ Confirmed by Web Lead (1.4.2).** Reissue the cookie only on the >24 h rewrite, not on every `/me`. Add the BSI refresh-token life (BSI-C3 to state it) and an absolute session cap (90 days from `created`).
- **R16 (CQ 16).** **✔ Confirmed by Web Lead (1.4.2).** Username check gets its own bucket (20/60 s per IP) separate from the signup/POST 5/60 s bucket; the client checks on blur or debounced ≥500 ms.
- **R17 (CQ 17).** P7: purging only clears the local colo, so on a successful POST the client appends the new comment optimistically (from the Worker's mapped 201 body) instead of refetching. The purge stays as best effort.
- **R18 (CQ 18).** CSP: the Worker's HTML path only covers `/the-daily-fix*`; PR4 uses `_headers` in Report-Only. reCAPTCHA needs `frame-src` (`https://www.google.com/recaptcha/`, `https://recaptcha.google.com/recaptcha/`) and `connect-src` (`https://www.google.com/recaptcha/`) entries in addition to `script-src`, on every route that can open the auth modal or composer; its script loads only when the auth modal or composer opens (no reCAPTCHA request on a plain page load; mount test).
- **R19 (CQ 19).** `workers_dev: false` in `wrangler.jsonc`, asserted in `worker/build.config.test.ts`. Type check: `Env` requires `AUTH_SESSIONS: KVNamespace`, `LOGIN_THROTTLE: DurableObjectNamespace` (R8), `OAUTH_STATE: DurableObjectNamespace` (§0b.1) and `SESSION: DurableObjectNamespace` (§0c G1); tsc fails if any is removed.
- **R20 (CQ 20).** AU22's `sessionStorage` grep is scoped to auth code (`client/src/**/auth*`, `client/src/lib/session*`, `CommentThread.tsx`, `JoinModal.tsx`) with an explicit allowlist pinned **by content** in §0b G19 (re-read by Spec at `3a721dcc` in 1.4.3); any new hit fails CI.
- **R21 (CQ 21).** **✔ Confirmed by Web Lead (1.4.2).** Retry-After unified: 503 `unavailable` → `Retry-After: 300` on all routes (read and auth; replaces auth's 30); 429 → the limiter's remaining window (R8a/R8b/R8c DO value, or 60 for binding limits and for a BSI 429). AU16 restated as **"no branch on user existence"** (early returns for O6 and reCAPTCHA are allowed because they don't depend on whether the user exists).
- **R22 (CQ 22).** Client slop at 3a721dcc fixed: the unused `name` state and input are removed (signed-out composer has no name field; JoinModal is the signed-out path); `viewerDisplayName` is passed from the R5 `/me` cache; the `:83` empty branch is replaced by the real POST; the `JoinModal.tsx:128-133` Google handler starts `/api/auth/google/start` (or the button is absent under R9's gate). Lint: `noUnusedLocals` / `@typescript-eslint/no-unused-vars` and `@typescript-eslint/no-empty-function` as errors on `client/src/pages/the-daily-fix/**`.
- **R23 (CQ 23).** The comments fetch no longer waits on the day load (started in parallel), and `comments.ts` gets a module `Map` cache with an in-flight share keyed by ISO date; navigating back to a date makes 0 new requests.
- **R24 (CQ 24).** #2's ci.yml still passes `VITE_SANITY_API_READ_TOKEN`; #10 fixes it, so **#10 must land first** for ci.yml and #2 rebases onto it (A3 rebase rule applies).

### 0a.3 Checks (CQ "Checks that could catch these", as acceptance items)
- **CK-W1.** Worker unit: exact path (`/comments/`, `/commentsx` → 404) and the type allowlist (R2).
- **CK-W2.** Worker unit: response has no `user.id` or `liked`, and no deleted rows (R2).
- **CK-W3.** Worker unit: a second same-date GET makes 0 upstream calls, including when the request carries a Cookie (and Authorization) (R2, R3).
- ~~**CK-W4**~~ removed in 1.6.1 (rotation deferred, §0s.10).
- **CK-W5.** Worker unit: `/me` makes 0 BSI calls; with no cookie, 0 KV reads (R5).
- **CK-W6.** Worker unit: ENC-T1–T4 (R7).
- **CK-W7 (1.4.2).** Worker unit against a mocked `LOGIN_THROTTLE` DO: (a) R8a O6 table: 5 failures free, 6th → 429 with Retry-After 1, doubling to the 60 s cap; key case/whitespace variants of one identifier share one instance; (b) R8b: 21st attempt from one IP in 60 s across different identifiers → 429; another IP still allowed; (c) R8c: 26th upstream login in 60 s across distinct identifiers and IPs → 429, BSI mock called exactly 25 times; (d) a request rejected by R8a/R8b or the token shape check doesn't increment R8c (1.6.3 order: R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10); (e) every 429 has an integer Retry-After ≥ 1, makes 0 BSI and 0 reCAPTCHA calls, and no awaited delay (fake timers); (f) DO instance names are exactly `id:<sha256>`, `ip:<sha256>`, `login:global` (no raw identifier or IP).
- **CK-C1.** Client mount: exactly 1 `/me` and 1 comments GET per date across navigation (R5, R23).
- **CK-T1.** Types: `Env` requires `AUTH_SESSIONS: KVNamespace` (R19); a literal union for `type` (R2).
- **CK-L1.** Lint: `noUnusedLocals`/no-unused-vars and no-empty-function (R22).
- **CK-CI1** (re-homed 1.4.15, §0f R-B; no ci.yml step). CI: spec rev/md5 check plus cited-head == PR head (R1); the scoped AU22 grep (R20); a `workers_dev:false` assertion (R19).
- Not tooling (per CQ): R9 needs Ethan; R10 is process; ~~R8's BSI side needs the BSI cap decision (BSI-C1);~~ (struck 1.6.4: BSI-C10's limits are locked, §0s.11) the Worker side (R8c) is now fixed at 25/60 s.

### 0a.X Conflicts between CQ's notes and Web Lead's rulings (ruling wins)
1. **CQ 9 (split into #2/#2b/#2c) vs Web Lead (one PR, Ethan's ruling relayed).** Written as one PR; pending Ethan's direct confirmation to CQ.
2. **CQ 4 "or use one DO per session".** 1.4.6 (G1): **adopted.** Stable ID with rotation only on login/privilege change (R4) **and** one `SESSION` DO per session for refresh (§0c G1). No longer a conflict.
3. **CQ 8 "Keep the Worker's global cap under 30/min, or get BSI to raise it".** Web Lead (1.4.1, fixed 1.4.2): per-identifier and per-IP throttles both kept, plus one global DO counter at 25/60 s, ~~**and** BSI-C1 kept as the ask~~ (1.6.4: retired BSI-C1 ask struck; R8c is metfix.org's own site-wide breaker, kept far below BSI-C10's 600/min key ceiling; residual A-T38/A-T38r).
4. **CQ 6 asks only to "say whether" `/me` returns the token / `/google/start` mints the pre cookie.** Web Lead asked Spec to pick defaults and flag them: R6(a) no, R6(b) yes.
5. **CQ 12 "400 or a redirect".** Spec picked 400 (Web Lead's item 13 says "A 400").

## 0b. Rev 1.4.3: QA list rev 1.0 resolved (read first; wins over §0a and any later text it contradicts)

Source: QA list `metfix-pr2-comments-login-tests.md` rev 1.0 (md5 `2498c37c…`, verified), §5.7 verdicts, gaps S-G*, open questions Q1–Q24. Code re-read read-only at `3a721dcc` for G19. Nothing about BSI behaviour is assumed; unknowns are BSI questions (§9). Unchanged invariants: no API key or secret in the client; the browser never calls BSI; every BSI call is server-to-server from the Worker.

### 0b.1 §5.7 defaults (replace the §5.7 table rows)
- **N4 (QA stronger form).** One threshold constant per action (`login`, `signup`, `comment`), each **0.5, inclusive** (`score >= 0.5` passes; 0.49 rejects, 0.5 accepts). Lowering any threshold needs the PD5 prod score distribution recorded first.
- **N5 (QA stronger form).** A low score, wrong `action`, wrong `hostname` or `success:false` → **403**, body byte-identical on login, signup and comment: `{"error":"try_again"}`; the score is never returned or logged (only pass/fail). No v2 fallback. Each such failure **counts as one R8b attempt** for that IP (Q5) [1.6.0: for login, reCAPTCHA is verified by BSI and a BSI 403 `recaptcha_failed` counts as one R8b attempt, §0s.3]; it does not count toward R8a (not an identifier failure) and takes no R8c slot (R25).
- **N7 (server-derived).** The client sends only `date`, the component (`type ∈ belly|body|brain`) and `scaling_filter ∈ all|rx|scaled` (default `all`). The Worker reads the day payload for that date server-side (the existing day fetch / its cache) and takes `daily_workout_id`, `scoring_field`, `scoring_direction` and `order` from it. A client-supplied `daily_workout_id`, `scoring_field`, `scoring_direction` or `order` is **dropped and never forwarded** (L2 rule). A component whose day data has no `scoring_field` → 404 `{"error":"no_leaderboard"}`, 0 leaderboard calls; day data unavailable → 503 `unavailable`, `Retry-After: 300`. Supersedes L2's client `daily_workout_id`/`scoring_field` params. ⚠ The day payload field names are those in main's day fetch; if the day payload doesn't carry them, that is **Q-BSI-10**, and until answered the leaderboard returns 503.
- **N9 (Worker-fixed).** Upstream `limit=25`, `offset=0`, `leaderboard_mode=official` are constants in the Worker; client `limit`/`offset` are dropped. No paging UI. Supersedes L2's `limit`/`offset` params and L6's key parts.
- **N10 (server `is_self`).** The Worker compares each upstream row's `user_id` with the session's `bsi_user_id` **on the server** and emits `is_self: true` on that row only (all other rows `is_self: false`). `user_id` is never sent to the browser; no browser-supplied id (query, body, header) is read. If the session has no `bsi_user_id`, every row is `is_self:false`. Own row **outside** the top 25: appended once below a divider only if BSI offers a server-side own-rank read (**Q-BSI-10**, unknown); until BSI answers, nothing is appended (no second read is invented). Row key set: `rank, public_name, score_value, scaling_mode, logged_at, is_self`.
- **OAuth state store → Durable Object (G3).** New DO class `OAUTH_STATE` (binding beside `LOGIN_THROTTLE`; same migration step). Instance `idFromName("oauth:" + sha256hex(state))`; `put` on start; the callback calls one `take()` method that reads **and deletes in one DO request** (single-writer ⇒ atomic, so replay is impossible, not just mitigated); a 600 s alarm deletes unclaimed state; `take()` after 600 s returns empty. Record unchanged: `{flow, nonce, verifier, intent, return, pre_hash, created}`. KV `oauth:*` is removed. R14/A-T3's replay residual is **closed**; PD6 stays as a prod regression check, not as residual evidence. Cost: one extra DO class; ≈2 DO requests per Google sign-in. Sessions stay in KV (`sess:*`, R4/R7).

### 0b.2 R25: reCAPTCHA before the global cap (S-G17, Q4) — ✔ confirmed by Web Lead
- Login order: ~~**R8a → R8b → reCAPTCHA siteverify (server) → R8c → BSI-C1.**~~ **1.6.3: R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10 (BSI verifies reCAPTCHA), §0s.1/§0s.3.**
- R8c's purpose (1.6.4): at most **25 upstream BSI login calls per 60 s** (sliding), metfix.org's own site-wide breaker kept far below BSI-C10's 600/min key ceiling. R8c counts **BSI calls only**; a slot is taken atomically in the DO immediately before the BSI call, and only by requests that passed R8a, R8b and (login) the token shape check, or (signup/comment) Worker reCAPTCHA. Requests rejected before R8c take no slot.
- ~~siteverify before R8c (login)~~: not applicable since 1.6.0; login makes 0 siteverify calls (§0s.3).
- Residual (accepted, recorded): an attacker producing ≥25 passing reCAPTCHA scores per minute across ≥2 IPs can still saturate R8c. ~~Mitigation is BSI-C1~~ (1.6.4: superseded by A-T38/A-T38r; no BSI mitigation pending).
- Signup and comment POST orders are unchanged (P8 limit → reCAPTCHA → BSI).

### 0b.3 Gaps
- **S-G2 / Q1.** A1's Worker-file clause is replaced by an allowlist. The PR diff vs main may touch only: `worker/index.ts`, `worker/upstream.ts`, `worker/auth/**` (routes, session, CSRF, crypto, Google, reCAPTCHA), `worker/do/login-throttle.ts`, `worker/do/oauth-state.ts`, `worker/do/session.ts` (1.4.6), `worker/leaderboard.ts`, the `*.test.ts` beside each, `worker/build.config.test.ts`, `wrangler.jsonc` (DO bindings/migration, KV binding, `workers_dev:false`), `client/**`, `package.json`, `package-lock.json` (1.4.13, D2: `.github/workflows/ci.yml` removed; PR2 never edits it), and (1.4.6, G3, A1.2) `docs/metfix-pr2-comments-login/` holding exactly the in-repo spec copy and the QA list copy (both files, md5-checked by CK-P1). (1.4.15) `worker/repo-scan.test.ts` is explicitly allowed. Exact module names inside these dirs are the PR's choice; any other path fails A1 (**1.4.18, §0h: the gate's scope step against the block below**; was vitest repo-scan RS-A1, 1.4.15; before that a CI diff check).

```allowed-files
# PR2 comments + login, from S-G2 (1.4.18). Own docs pair docs/metfix-pr2-comments-login/ is implicit.
worker/index.ts
worker/index*.test.ts
worker/upstream.ts
worker/upstream*.test.ts
worker/auth/**
worker/do/login-throttle.ts
worker/do/login-throttle*.test.ts
worker/do/oauth-state.ts
worker/do/oauth-state*.test.ts
worker/do/session.ts
worker/do/session*.test.ts
worker/leaderboard.ts
worker/leaderboard*.test.ts
worker/comments.ts
worker/comments*.test.ts
worker/build.config.test.ts
worker/repo-scan.test.ts
worker/__fixtures__/tk2-m7/.github/workflows/ci.yml.fixture
worker/__fixtures__/tk2-m7/.github/workflows/deploy-pages.yml.fixture
worker/__fixtures__/tk2-m7/client/src/const.ts.fixture
worker/__fixtures__/tk2-m7/client/src/lib/sanity.ts.fixture
worker/__fixtures__/tk2-m7/client/src/vite-env.d.ts.fixture
worker/__fixtures__/tk2-m7/vite.config.ts.fixture
wrangler.jsonc
client/**
package.json
package-lock.json
```
- **S-G3.** Closed by the `OAUTH_STATE` DO (0b.1). Tests must drive the real DO class (Miniflare/`unstable_dev` or the DO class against an in-memory storage that implements the same `take()` transaction), with a concurrent-replay test: two simultaneous callbacks with one state → exactly one token exchange.
- **S-G5.** All leaderboard reads are signed in (P11) and never cached, so L6's Cache API text is **dead and removed**. T14's control becomes: (i) the client per-date `Map` cache (R23 pattern) with single-flight; (ii) a Worker limit **10 leaderboard reads per 60 s per `bsi_user_id`** (Rate Limiting binding, 429 `rate_limited`, `Retry-After: 60`, 0 BSI calls; **1.4.5:** checked after the session check and **before** the N7 day-data read and before any BSI call, so a limited request makes 0 day reads and 0 BSI calls); (iii) the day-data read for N7 uses the existing day cache. `Cache-Control: no-store` on every leaderboard response.
- **S-G6.** Closed by N10 `is_self` (0b.1).
- **S-G8 / Q7, Q8, Q11.** Fixed bodies (all `no-store`, JSON):
  - Leaderboard: 400 `{"error":"invalid_date"}`, 400 `{"error":"invalid_type"}`, 400 `{"error":"invalid_scaling_filter"}`, 400 `{"error":"invalid_request"}` (duplicate param), 401 `{"error":"signed_out"}`, 404 `{"error":"no_leaderboard"}`, 429/503 as R21.
  - Comment POST: 400 `{"error":"invalid_request"}` (bad JSON, missing/invalid field, content out of range); 401 `{"error":"signed_out"}`; 403 `{"error":"forbidden"}` (CSRF/Origin) / `{"error":"try_again"}` (reCAPTCHA); 413 `{"error":"payload_too_large"}`; 415 `{"error":"unsupported_media_type"}`; 429 `{"error":"rate_limited"}`.
  - Success: **201** `{"comment":{id, user:{display_name}, content, timestamp, parent_id, like_count:0, deleted:0, edited:0, replies:[]}}`, shaped by the W7 whitelist + B4-W from BSI's response. If BSI's 2xx body lacks `id`, `content` or `timestamp` → 502-class handling: 503 `unavailable` (the client then refetches instead of appending). BSI's POST response shape is **D-POST / Q-BSI-7**, not assumed. Client behaviour after a 503/malformed success (no auto-retry, one refetch): 0b.6 item 7 (S-G22).
  - **N12 / Q11:** BSI 403 on POST → 403 `{"error":"cannot_post"}` "You can't post comments right now." (same for any BSI 403 reason; never relayed). BSI 401 on POST → S4 refresh once, then 401 `signed_out`.
- **S-G9.** BSI sends only `display_name`, which can equal the nicename (F6), and the Worker can't detect that. **Fail closed until Q-BSI-1/D-NAME:** unless the BSI row carries an explicit safe public-name field (D-NAME, field name to be stated by BSI), the Worker renders **`Member`** for every comment author, leaderboard row and `/me` `public_name`. `[Anonymous]` (deleted==2) is kept. Tests: B4W.1/AU21/WT12 assert `Member` for a payload with only `display_name`.
- **S-G12 / Q10.** Double-submit: the client disables the submit control and holds a single in-flight POST per composer; a second click while in flight sends nothing (test counts 1 POST). Server-side dedupe isn't invented; whether BSI dedupes is **Q-BSI-8**. Leaderboard integrity (Q21) is BSI-only and out of scope (**Q-BSI-9**).
- **S-G16 / Q14, Q15 (rewritten 1.4.13, B3).** `SESSION` DO storage is the source of truth for whether a session exists. A cookie whose `SESSION` DO storage is empty (rotated away, expired, deleted) or whose stored tokens fail R7 decrypt, on any user-acting route (comment POST, leaderboard, logout) → **401 `{"error":"signed_out"}`**, `Set-Cookie: __Host-mfx_sid=; Max-Age=0`, 0 BSI calls (logout still 204). User-acting routes never consult KV; a KV `sess:*` miss never means signed out for writes (AU5.k, M-KVF1). S4: after one refresh and one retry, a second 401 → 401 `signed_out`, `SESSION` DO storage cleared and KV `/me` entry deleted, cookie cleared; never a second refresh.
- **S-G17.** Closed by R25 (0b.2).
- **S-G18 / Q3.** `LOGIN_THROTTLE`, `OAUTH_STATE` or (1.4.6) `SESSION` unbound, a DO call throwing, or timing out (1 s) → **fail closed**: 503 `{"error":"unavailable"}`, `Retry-After: 300`, 0 siteverify and 0 BSI calls (Google start/callback → `/?auth_error=unavailable`). Never skip a layer.
- **S-G19 / Q24.** Re-read at `3a721dcc` (raw file). Allowlist pinned **by content**; the vitest repo-scan RS-AU22 (1.4.15; was a CI grep) matches the exact trimmed line text plus file, and fails on any other hit or any change of these lines:
  - `client/src/const.ts:45` — `  sessionStorage.setItem(HOME_SCROLL_KEY, sectionId);` (in `requestHomeScroll`; `HOME_SCROLL_KEY = "metfix-home-scroll"` at `:42`).
  - `client/src/pages/Home.tsx:492` — `    const pending = sessionStorage.getItem(HOME_SCROLL_KEY);`
  - `client/src/pages/Home.tsx:494` — `      sessionStorage.removeItem(HOME_SCROLL_KEY);` **(new: CQ cited only :492; :494 is a second hit and must be allowlisted too.)**
  - All three use only `HOME_SCROLL_KEY` (scroll position, not auth). The allowlist entry also requires the key argument to be literally `HOME_SCROLL_KEY`. Note: these files are outside R20's scoped paths, so the allowlist matters only if the scope widens; it is kept so a widened grep stays green.

### 0b.4 QA open questions (strict defaults)
| Q | Decision |
|---|---|
| 1 | A1 path allowlist, 0b.3 S-G2. |
| 2 | Any duplicated query param on any route → 400 `{"error":"invalid_request"}`, 0 upstream. |
| 3 | Fail closed 503 `unavailable`, `Retry-After: 300` (S-G18). |
| 4 | reCAPTCHA moved before R8c (R25, confirmed). |
| 5 | Yes: counts as one R8b attempt; not R8a; no R8c slot. 1.6.0 login: BSI 403 `recaptcha_failed` = one R8b attempt, not R8a, one R8c slot used (§0s.3). |
| 6 | Server `is_self` from session `bsi_user_id`; no second read until Q-BSI-10. |
| 7 | 0b.3 S-G8. |
| 8 | 201 shape and 400/401/413/415 bodies, 0b.3 S-G8. |
| 9 | Unicode **code points** after trim, 1–2000; ≤ 8 KB body in bytes. BSI's own max is Q-BSI-4; if BSI's is lower, the lower one wins once stated. |
| 10 | Client in-flight lock; BSI dedupe is Q-BSI-8. |
| 11 | 403 `cannot_post` (N12). |
| 12 | HEAD on `/api/auth/csrf`, `/me`, `/username-check` → 405 `Allow: GET` (no state change on HEAD; `/csrf` never mints on HEAD). |
| 13 | Every sha256 in KV keys and DO names is **lowercase hex** (64 chars). |
| 14 | 401 `signed_out` + cookie cleared (S-G16). |
| 15 | Yes: 401 `signed_out`, session deleted, cookie cleared. |
| 16 | `aud` array accepted only if it has exactly one element equal to our client ID; any other array → reject. `azp`, if present, must equal it. |
| 17 | Yes: a successful login clears the R8a failure count and lockout for that identifier. R8b/R8c are not reset. |
| 18 | siteverify unreachable, timeout (3 s) or non-JSON → 503 `unavailable`, `Retry-After: 300`, 0 BSI; not counted toward R8b (infra failure, not the client's). 1.6.0: signup/comment only; login makes no siteverify call (§0s.3). |
| 19 | Sliding window for R8b and R8c. |
| 20 | Accepted residual: anyone can trigger R8a's ≤60 s lockout and BSI's 10/900 s per username for a victim (1.6.4: BSI-C10's per-username limit has no IP in its key, so this is global; A-T43, CEO accepted (relayed)). Recorded; a completed password reset clears it (BSI-C9). |
| 21 | Out of scope; BSI-only (Q-BSI-9). |
| 22 | Yes: AUTH-HOST (404 when `Host != metfix.org`) also covers `POST /api/daily-fix/comments` and `GET /api/daily-fix/leaderboard`. Anonymous comment GET is not host-gated. |
| 23 | Yes: when `/google/start` mints `__Host-mfx_pre`, the stored `pre_hash` is of the value set in that same response. |
| 24 | Pinned by content (S-G19). |

### 0b.6 Rev 1.4.4: judgment calls confirmed by Web Lead
All eight 1.4.3 judgment calls are **✔ confirmed by Web Lead (1.4.4)**:
1. S-G9: `Member` stays the default for every comment author, leaderboard row and `/me` `public_name` until BSI provides an explicit safe public-name field. **Q-BSI-1 is the top-priority BSI question** (§9), so that real names can ship in #2.
2. OAuth state in the `OAUTH_STATE` DO (0b.1).
3. No own-row append outside the top 25 until Q-BSI-10 (0b.1 N10).
4. reCAPTCHA failure counts toward R8b only; a siteverify outage counts toward nothing (0b.1 N5, Q5, Q18).
5. Leaderboard reads 10 per 60 s per `bsi_user_id` (S-G5).
6. A1 path allowlist as in 0b.3 S-G2.
7. (Bodies and the malformed-success rule: 0b.3 S-G8.) A comment POST answered with 503 (any cause), a 2xx missing `id`/`content`/`timestamp` (Worker → 503), **a network error, or a thrown/rejected fetch (1.4.5, S-G21)** is **never retried automatically** by the client, because the post may already have landed at BSI. The client makes no optimistic append, refetches the thread once (`GET /api/daily-fix/comments?date=<iso>&type=all`, bypassing the R23 Map cache for that date), and shows "We couldn't confirm your comment. Check the thread before posting again." The composer text is kept and the user may resubmit manually.
   - **CT-P1 (acceptance test, client).** With the fetch spy returning 503 for the POST (and, separately, a 201 body missing `id`): exactly **1** `POST /api/daily-fix/comments` is made, followed by exactly 1 comments GET for that date; spy call count for the POST URL+method = 1 after all timers are flushed (`vi.runAllTimers()`) and after awaiting settle.
   - **1.4.5:** if the refetch itself fails (any status other than 200, network error or throw), the client shows the same message, keeps the composer text, appends nothing, and makes no further request (no retry of the GET either).
  - **M-P1 (mutation).** Add an automatic retry of the POST on 503/malformed success (one immediate retry, or a delayed retry) → CT-P1 must turn **red** (POST count 2). Red set: {CT-P1}.
8. Fixed values: DO timeout 1 s, siteverify timeout 3 s, 404 `no_leaderboard`, BSI POST 403 → 403 `cannot_post`.

### 0b.7 Rev 1.4.5: QA list rev 1.1 clarifications
- **S-G20.** AU10.8 (concurrent replay) runs against the **real `OAUTH_STATE` DO class** under Miniflare or `unstable_dev`. A hand-written in-memory store is allowed only for the other state tests (supersedes 0b.3 S-G3's "or the DO class against an in-memory storage" for AU10.8).
- **S-G21.** 0b.6 item 7 covers network errors and thrown fetches (same no-retry, single-refetch rule).
- **S-G22.** S-G8 and 0b.6 item 7 cite each other.
- **Failed refetch:** same message, composer text kept, nothing appended (0b.6 item 7).
- **Leaderboard limit order:** session → 10/60 s per-user limit → day-data read → BSI (0b.3 S-G5).
- **Accepted residuals (recorded with QA):**
  1. Names: every name renders `Member` until Q-BSI-1 is answered. QA's real-name fixture is a **placeholder** until BSI names the safe public-name field.
  2. Login timing (AU16.2) stays box-only evidence, not a CI test.
  3. An attacker with 25+ passing reCAPTCHA scores per minute can fill the R8c global cap (accepted residual A-T38/A-T38r, 1.6.4; BSI-C1 retired).

### 0c. Rev 1.4.6: CQ pin check (`metfix-pr2-cq-pin-check.md`, md5 `9d315ff3…`, verified) + retarget

CQ's wording is used; Web Lead's rulings win.
- **G1 (CQ 4).** Refresh goes through **one `SESSION` Durable Object per session**, keyed by session id (`idFromName("sess:" + sha256hex(id))`). It serialises refresh and holds the current token pair. KV stays only as the read cache for `/me`. This closes the race even if BSI rotates refresh tokens (BSI-C3). §0a.X.2 contradiction removed; §5.2 rewritten; AU7.6 added; S-G18 outage rule covers `SESSION`; R19 Env types updated; A1 allowlist adds `worker/do/session.ts`. Logout clears the DO state and the KV entry; rotation (R4) creates a new instance and clears the old. **R7 (✔ confirmed by Web Lead, 1.4.7):** R7 is unchanged except that its AAD is the `SESSION` instance name `sess:<sha256hex(id)>` (same string as the former KV key) and the ciphertext lives in DO storage; AU5's KV TTL/rewrite rules apply to the `/me` cache entry, which holds no tokens.
- **G2 (CQ 9).** Header, §9 Q-WL-1 and QA §R R9 carry exactly: "Decided: one PR (Ethan Oct 13 and 15; re-asked Oct 19), relayed via MetFix CEO (Ethan's standing rule on CEO-relayed decisions, as relayed by Web Lead 2026-10-15; Web Lead restated 2026-10-19). Not yet confirmed by Ethan directly. CQ has asked Ethan directly; if he answers otherwise, this reopens." (QA's R9 row is changed in QA's re-cut, §8a.) **1.4.8:** provenance text updated per Web Lead 2026-10-19; QA's R9 row should quote the 1.4.8 text.
- **G3 (CQ 1, CK-CI1).** A1.2 allows `docs/metfix-pr2-comments-login/` for both files (spec copy and QA list copy).
- **G4.** #3 is independent: #2 and #3 both have base `main`; whichever merges second has main's later head as an ancestor. QA A2.1's stacking assertion is replaced in QA's re-cut.
- **G5.** AU16 body restated (early returns not based on user existence allowed).
- **G6.** §5.2 absolute cap 90 days (R15). **1.4.8 (Web Lead 2026-10-19): inclusive** — a session expires when `now - created >= 90d`. Boundary tests: 89d valid, 90d−1s valid, exactly 90d expired, 91d expired (AU5.6).
- **G8 (1.4.8, S-G24, Web Lead 2026-10-19).** The QA list's `gate-ids` block lists **CI IDs only**, as PR3 CQ7 and gate acceptance 1.0.6 A3.4. Box-only IDs (PR0.x etc.) go in a `box-ids` block and PD IDs in a `post-deploy-ids` block, each with a manual sign-off (QA evidence + Web Lead sign-off); M IDs in no block. This supersedes §8a/QA's "per gate-infra A3.4 incl. post-deploy IDs".
- **G9 (1.4.8, Web Lead 2026-10-19).** `SESSION` DO outage on logout (exception to S-G18 for logout only): logout still returns **204** and clears the cookie (`__Host-mfx_sid=; Max-Age=0`), deletes the KV `/me` entry best-effort; server revocation (DO clear and BSI-C4) is best-effort and the failure is logged with **no token data** (no token, ciphertext or session id; hashed id at most). The next `/me` is signed out when the KV delete succeeds. If the delete fails or propagates late, `/me` may show signed in for at most the 60 s KV TTL (every `/me` KV write uses `expirationTtl: 60`, G10, 1.4.11), display-only, while every write and refresh fails closed at once through the `SESSION` DO (1.4.10, Q5). Comment POST and leaderboard still 503 per S-G18.
- **Q5 ruling (1.4.10, QA Q5).** The accepted 60 s display-only residual (QA AU8.1) covers a failed or late KV `/me` delete; `/me` stays KV-only (R5) and gets **no** extra `SESSION` DO check. *(1.4.13 N1: R5 now reads KV, then the DO on a miss; the no-extra-check-on-a-hit ruling stands.)*
- **G10 (1.4.11, closes QA G9/Q5 gap).** Every KV `/me` cache write (`AUTH_SESSIONS.put`, key `sess:<sha256hex(id)>`) uses **`expirationTtl: 60`** (Cloudflare KV's minimum). The `SESSION` DO stays the source of truth for the 30-day idle and 90-day caps (alarm, §5.2). A `/me` KV miss rebuilds the entry from the `SESSION` DO and rewrites it with TTL 60 (**1.4.12:** DO down on a miss → exactly **503** `{"error":"unavailable"}` with `Retry-After: 300`, 0 BSI calls and 0 KV puts, per S-G18; never `{signed_in:false}`. The client shows the signed-out UI on that 503 and does not clear the cookie). A failed or late logout delete is therefore bounded to 60 s by expiry alone, with no retry dependency. The KV TTL is never 30 days or any value other than 60 s.
- **Red-set rulings (1.4.11, QA 1.3, accepted).** M-DO1 and M-DO3 = {AU5.y, AU5.3}; M-DO2 = {AU5.y, AU7.8, AU8.1, AU8.2, AU8.4}; M-Q5b = {AU7.8, AU8.4}. These replace the "each turns AU5.y red" wording in AU5.y.
- **G7.** A-T7: username check has its own 20/60 s bucket (R16).
- **Stale body text fixed:** §0 labelled historical; L2 and L6 rewritten (N7/N9, S-G5); T14; §5.2 state record (OAUTH_STATE DO, `created`); A-T3 closed; A-T14; §5.4 CSP split (R18); §5.2 S4 refresh only on user-acting calls, never `/me`.
- **PR0 (pre-round-1, ✔ confirmed and ordered by Web Lead).** PR #2's GitHub base is currently `cursor/the-daily-fix-8836` (draft, `mergeable_state: dirty`). Before round 1:
  - #1 merged to main on Oct 14, 10:30 PM PT; main `9f7129d7` is #1's merge commit (verified by Web Lead).
  - #2's base becomes **`main`**. Main is merged in (preferred, 1.4.13 N5), or #2 is rebased onto main, so that its diff against main shows **only #2's own work**.
  - Ethan's commits, including `3a721dcc`, are **preserved**: no squashing, no dropping (a rebase keeps each commit; the cited head moves to its rebased successor, named in the PR body per CHK-1).
  - **Force-push (1.4.13 N5):** any force-push to the PR branch needs Ethan's own OK in chat, given in his own words; Web Lead or CEO relay does not count.
  - **First deliverable:** the PR's file list against main, checked against the A1 allowlist (§0b.3 S-G2).
  - Web Lead orders this when sending #2 to the Project. Round 1 does not start until the base is `main` and the file list is delivered.

### 0b.5 New BSI questions (no BSI behaviour assumed)
- **Q-BSI-8.** Does the comment POST route dedupe identical submits, or accept an idempotency key?
- **Q-BSI-9.** Does BSI dedupe or verify leaderboard entries? (Out of scope for #2.)
- **Q-BSI-10.** (a) Do the day payload's components carry `daily_workout_id`, `scoring_field`, `scoring_direction`? (b) Is there a server-side way to read the signed-in user's own leaderboard row/rank?

## 1. Findings that change the brief

> 1.4.1: F1, F4 and F5 describe `3470e50c` and are historical; F3 is rewritten; current code facts are §0a.1.

- **F1.** The branch client calls the retiring BFF. Two places:
  - `client/src/pages/the-daily-fix/comments.ts:6`: `new URL("/daily-fix/comments", new URL(DAILY_FIX_BFF_URL).origin)`.
  - `data.ts:11`: `DAILY_FIX_BFF_URL = "https://metfix-bff.wispy-mode-982d.workers.dev/daily-fix"`. The day fetch uses the BFF too, not only comments.
- **F2. There is no BFF comments handler to port.**
  - metfix-bff on GitHub has exactly one commit, `587dc0a`. `src/index.ts:59` returns `404 not_found` for every path except `/daily-fix`, and it is GET/OPTIONS only.
  - The deployed `metfix-bff` script (read via the Cloudflare API) is the same code, with upstream `api.brokenscience.org`.
  - So today `/daily-fix/comments` on the BFF always returns 404, and #2 always renders "Comments are unavailable right now." in production.
  - The "port" therefore becomes: forward to BSI's own handler, `GET /wp-json/metfix/v1/daily-fix/comments` (`daily-fix-apis.php:155`, callback `dfix_api_get_comments` at `:1644`), using the `worker/upstream.ts` pattern. The client mapping in `comments.ts:29-66` stays as it is.
- **F3 (rewritten 1.4.1). The Worker route exists at `3a721dcc` but breaks the spec.** `worker/index.ts:63` routes `/api/daily-fix/comments` **and** `/api/daily-fix/comments/` to `handleComments` (`:389-432`), before the `/api/*` JSON 404 (`:66-68`). It forwards an unvalidated `type`, passes the raw BSI body through, caches 404s in the browser, collapses 401/403/429 into 503 `Retry-After: 300`, and has no Cache API use (§0a.1, R2).
- **F4. #2 is not on main's line.**
  - merge-base is `a8ba2665`, which is pre-#1. The branch has no `worker/`.
  - #1 already landed its own `client/src/pages/the-daily-fix/data.ts` on main, with `DAILY_FIX_BFF_URL = "/api/daily-fix"` (relative, main `data.ts:5`).
  - Under main's data.ts, `comments.ts:6` would **throw** (`new URL("/api/daily-fix")` has no base). This is a real merge break, not just a stale URL.
  - #2 must be rebased onto main (A1).
- **F5. ⚠ The branch has no login code.**
  - At `3470e50c` the comment UI is logged-out only. `CommentThread.tsx:58-62`: submit opens `JoinModal` and never POSTs.
  - There is no `/login`, reCAPTCHA, CSRF or `__Host-mfx_pre` code anywhere on the branch.
  - So the login items (O6, Q19a, Q24a, L-items) cannot be verified against code. They are carried as locked contract for the login phase (§3, §5), not as current behaviour.
- **F6. ⚠ B4 contradicts the code in two ways.**
  - `comments.ts:36-39` shows `user.display_name` whenever it is non-blank and only falls back to `Member` when it is empty. It cannot test "equals login or email", because the BSI payload (`dfix_format_comment`, `daily-fix-apis.php:1585-1614`) sends only `user.id` and `user.display_name`. It never sends login or email.
  - WordPress `display_name` defaults to the login/nicename. So today the nicename **can** be shown, which violates Q5a.
  - BSI also emits the literal strings `[Anonymous]` (deleted == 2) and `Unknown` (no user) as display_name, and the client shows them verbatim.
  - The fix point is B4-W in §4.
- **F7. ⚠ The key can act as a user.**
  - `dfix_get_user_id_from_request` (`daily-fix-apis.php:617-633`) falls back to `bsi_get_user_id_from_api_key`.
  - If the metfix.org Worker key were bound to a user_id, two things would follow:
    - Anonymous GETs would compute `liked` for that user.
    - A POST without a Bearer token would post **as the key's user**, not fail with 401 (`:1696-1699`).
  - This makes T1c ("the Worker key has no user_id") a hard requirement, not hygiene.
- **F8. Rate limit confirmed.** `dfix_require_api_key` → `bsi_require_api_key_or_bearer_oauth($r, 60, 60, 'dfx_rl_')` (`daily-fix-apis.php:610`). That is 60 requests per 60 s per key and route bucket.
- **F9. Comment content is plain text.**
  - On write, `sanitize_textarea_field` strips tags (`:1691`). On read, it goes through `stripslashes_deep`.
  - The client renders `{comment.content}` as a React text node (`CommentThread.tsx:50`), which is escaped.
  - Deleted and soft-deleted rows still come back with a `deleted` flag. The client ignores both the flag and `replies` (`comments.ts:29-42`), so a deleted (1) comment's content may render. See Q-BSI-3.

## 2. Scope

- **In scope:**
  - Rebase #2 onto main.
  - A same-origin Worker route for comment reads.
  - Client calls only same-origin `/api/*`.
  - Removal of every BFF origin.
  - Display-name rule B4.
  - Tests.
  - The CI grep (1.4.15: vitest repo-scan RS-C5, §0f; no ci.yml step).
- **Login and comment writes (§5):** in scope and merge-gating (consolidated PR). There is no feature flag. Writes depend on the BSI sign-in and posting PR.
- **Out of scope:**
  - Changes to BSI.
  - Retiring the metfix-bff Worker. A post-merge step, not a PR item: it retires only after #2's route is live on prod and verified. Ethan approves the deletion and revokes its key.
  - Sanity token work (its own PR).
  - A BOM fix: Web Lead verified `TheDailyFixPage.tsx` has none, so none is specced.

## 3. Locked 1.2.x items (carried; status against code)

| ID | Rule | Status at 3470e50c (historical; see §0a.1 for 3a721dcc) |
|---|---|---|
| B4 / Q5a | Display name: if empty, or equal to the login or email (case-insensitive, trimmed), show `Member`. Never show the nicename. | ⚠ Not met (F6). Fixed by B4-W. |
| O6 | Login: 5 free failed attempts. Then a delay that starts at 1 s and doubles up to a 60 s cap. | No login code (F5). Locked for §5. |
| Q19a | Logout sends a body containing `refresh_token` and **no** `Authorization` header. | No logout code. Locked. |
| Q24a | No per-key charge for the Worker key. A password reset clears the O6 delay. Pending BSI plan 1.1.3. | Open with BSI. Locked. |
| L1 | Login uses reCAPTCHA, a CSRF token held in the encrypted cookie, and the `__Host-mfx_pre` pre-session cookie. | No code. Locked. |
| G5, G6, G7 | Retired. Their text was lost in the rollback and is **not** reconstructed. The genuinely undecided items are now asked fresh as N1–N12 (§9). | Superseded by N-questions. |

## 4. Acceptance: read path (must pass to merge)

### A. Branch and merge
- **A1.** #2 is rebased onto main `9f7129d7` or later.
  - Its `the-daily-fix/data.ts`, `data.test.ts` and `TheDailyFixPage.tsx` conflicts resolve to **main's** day/archive behaviour (`/api/daily-fix`, `/api/daily-fix/archive`, SEO/head work from #1).
  - #2 keeps only its comment additions on top.
  - The PR diff vs main touches no Worker file other than those listed in W-items.
- **A2 (W5-R, Web Lead).** #2 and #3 both target main and are independent; no #3-on-#2 stacking. Whichever of #2/#3 merges second rebases onto main. The A1 conflict note goes in #2's description.
- **A3.** The Project resolves the A1 rebase (#2 onto main keeping main's `data.ts`) and, if #2 merges second, its rebase onto main after #3. CQ reviews that rebase.

### W. Worker route (`worker/index.ts`, `worker/upstream.ts`)
- **W1.** Route `/api/daily-fix/comments` (exists at `index.ts:63`; its `/comments/` variant must be removed, R2), exact path with no trailing-slash variant, placed beside the two existing routes and before the `/api/` 404 catch-all (`index.ts:62`). Every other `/api/*` stays 404.
- **W2.** Method allowlist: `GET`, `HEAD`, and `POST` (POST under §5 only). Anything else returns `405 {"error":"method_not_allowed"}` with `Allow: GET, HEAD, POST`, the same as `handleArchive` (`index.ts:522-526`). There is no OPTIONS/CORS handling, because the route is same-origin.
- **W3.** Query allowlist:
  - `date` must pass `isIsoDate`, otherwise `400 {"error":"invalid_date"}`.
  - `type` must be in `belly|body|brain|all`, otherwise `400 {"error":"invalid_type"}`.
  - Any other query parameter is ignored and **not** forwarded.
  - The upstream URL is built from scratch: `${BSI_DAILY_FIX_URL}/comments?date=…&type=…`.
- **W4.** New `fetchDailyFixComments` in `upstream.ts`, copying `fetchDailyFixDay`:
  - `assertBsiHost`.
  - No key → `{kind:"nokey"}` → 503.
  - `AbortSignal.timeout(3000)`.
  - Same timeout and throw classification.
- **W5.** Upstream request headers are exactly `Accept: application/json`, `X-API-Key: env.DAILY_FIX_API_KEY` and `User-Agent: UPSTREAM_USER_AGENT` (`metfixhome-worker/1.0`). Nothing from the incoming request is copied. See T2.
- **W6.** **✔ Confirmed by Web Lead (1.4.2).** Error mapping, Worker → client:

  | Upstream outcome | Worker response |
  |---|---|
  | 200 with valid JSON | 200 with the response body (W7) |
  | 400 | 400 `{"error":"invalid_request"}` |
  | 404 | 404 `{"error":"not_found"}`, `no-store`, never cached (R2) |
  | 401 / 403 (key problem; separate outcome kinds `unauthorized` / `forbidden`, R2) | 503 `{"error":"unavailable"}` (never leak "bad key") |
  | 429 | 503 `{"error":"unavailable"}` with `Retry-After: 60` |
  | 5xx, timeout, throw, bad JSON, no key | 503 `{"error":"unavailable"}` with `Retry-After: 300` |

  Every non-200 response carries `Cache-Control: no-store`. Upstream error bodies and headers are never passed through.
- **W7.** Response shaping, the port of BSI's shape:
  - The Worker returns `{comments:{belly,body,brain}, meta}` for `type=all`, or `{comments:[…], meta}` for a single type.
  - Each comment and reply is reduced to `id`, `user.display_name` (after B4-W), `content`, `timestamp`, `like_count`, `parent_id`, `deleted`, `edited` and `replies`.
  - `user.id` and `liked` are **dropped**: the reads are anonymous, and user ids should not be enumerable.
  - The response is `Content-Type: application/json; charset=utf-8`.
- **B4-W.** The Worker applies B4 before responding:
  - A `display_name` that is empty or whitespace, `Unknown`, or looks like an email (`/@/`) becomes `Member`. `[Anonymous]` is kept, because it is BSI's deliberate anonymize marker (confirm in Q-BSI-2).
  - Comparing with the login or nicename needs BSI to send a safe flag or a computed public name, because BSI doesn't send the login. This is **Q-BSI-1**. Until BSI answers, the email rule plus the client's `Member` fallback is the floor, and Q5a stays open.
- **W8.** Deleted rows:
  - `deleted == 1` (soft delete, BSI's `deleted` flag): the Worker **skips** the row and renders no placeholder. Its replies are dropped with it, unless BSI says thread replies need a placeholder (Q-BSI-2b). Test: WT9.
  - `deleted == 2`: shown as `[Anonymous]` with its content, unless BSI says otherwise.
- **W9.** Caching (T5):
  - The Worker may cache only anonymous GET `type=all` 200 responses in the Cache API, keyed `https://cache.metfix.internal/daily-fix/comments?date=…`. The key includes no query string other than `date`.
  - TTL is `s-maxage=60`.
  - The client response carries `Cache-Control: public, max-age=0, s-maxage=60`.
  - Error responses are never cached. **(1.4.1, R3)** Every read is anonymous and always cached; the cache key ignores Cookie and Authorization, and the handler never reads them.

### L. Leaderboards via the Worker (in scope for #2)
- **BSI route found** (local checkout `d3234a5`, 2026-10-13): `GET /wp-json/metfix/v1/daily-fix/workouts/{daily_workout_id}/leaderboard` (`daily-fix-apis.php:118-152`, callback `dfix_api_get_daily_fix_workout_leaderboard` at `:1329`).
  - Args: `date` (required, Y-m-d), `scoring_field` (required), `scoring_direction` (`higher_better|lower_better`), `order` (`asc|desc`), `scaling_filter` (`all|rx|scaled`), `limit` (default 100, clamped 1–500 at `:1385`), `offset`, `leaderboard_mode` (`official|all`).
  - Gate: `workout_require_auth` → `bsi_require_bearer_api_key_or_session($r, 'workout_rl_')` (`functions.php:4796-4799`).
  - **⚠ F10. Blocked for anonymous use:** the callback needs a user (`workout_get_user_id_from_request`, `functions.php:4805`; 401 at `:1336-1338` "User ID must be associated with API key or user must be logged in"). The metfix.org key has no user_id (T1c), so a logged-out read through the Worker always gets 401. A key with a user_id is **not** an allowed fix.
  - **⚠ F11. No public name:** rows carry `rank`, `user_id`, `score_value`, `scaling_mode`, `workout_log_id`, `workout_title`, `within_official_window`, `logged_at` (`:1407-1420`). There is no display name, so the page can't name anyone without a BSI change.
  - So a public leaderboard read is a **BSI dependency** (§5b, D-LB). Signed-in reads with the user's Bearer token work today, but still have no names.
- **L1.** Worker route `GET|HEAD /api/daily-fix/leaderboard`, exact path, before the `/api/` 404 catch-all. Other methods → 405 with `Allow: GET, HEAD`.
- **L2 (1.4.6, per §0b.1 N7/N9).** Client query allowlist: `date` (`isIsoDate`), `type` (`belly|body|brain`), `scaling_filter` (`all|rx|scaled`, default `all`). `daily_workout_id`, `scoring_field`, `scoring_direction` and `order` come from the day data on the server; `limit=25`, `offset=0`, `leaderboard_mode=official` are Worker constants. Any other param is dropped and never forwarded; a duplicated param → 400.
- **L3.** Upstream call uses the W4 pattern (`assertBsiHost`, 3 s timeout, no key → 503) and the W5 header set exactly. For a signed-in user it adds `Authorization: Bearer <user token>` only once D-LB says reads need it (N8); otherwise it never sends Authorization.
- **L4.** Errors as W6. BSI's 401 is mapped to 503 `{"error":"unavailable"}` (it means the D-LB route isn't there yet), never relayed.
- **L5.** Shaping: each row is reduced to `rank`, `public_name` (from BSI's public-name field, D-NAME, after B4-W; blank, `Unknown`, email-like, or missing → `Member`), `score_value`, `scaling_mode`, `logged_at`. **`user_id` and `workout_log_id` are dropped.** Top level keeps only `total`, `limit`, `offset`, `scoring_field`, `score_unit_id`, `scoring_direction`, `dfx_date`, `live_at`, `window_end`, `leaderboard`.
- **L6 (1.4.6, per §0b.3 S-G5).** No Cache API use: every leaderboard read is signed in (P11) and answered `no-store`. Exhaustion control: client per-date cache, 10/60 s per `bsi_user_id` limit before the day-data read and any BSI call.
- **L7.** Client: relative `/api/daily-fix/leaderboard?...` only; names render as text nodes; the `Member` fallback is repeated client-side. Until D-LB lands, the leaderboard UI shows "Leaderboard unavailable right now." on 503, never an error dump.

### C. Client
- **C1.** `comments.ts`:
  - `dailyFixCommentsRequestUrl(iso)` returns the **relative** string `/api/daily-fix/comments?date=<iso>&type=all`, with no `new URL(..., origin)`.
  - The import of `DAILY_FIX_BFF_URL` is removed from comments.ts.
- **C2.** Request: `GET` with only `Accept: application/json`, no credentials override, and no Authorization. This is unchanged from the current code.
- **C3.** `mapDailyFixComments` behaviour is unchanged (`comments.ts:49-66`) and accepts the W7 shape. Its author fallback `Member` stays as defence in depth.
- **C4.** The UI states are unchanged: loading, unavailable, "No comments yet." only after a real empty list, and the logged-out submit opens JoinModal with no POST (`CommentThread.tsx`).
- **C5.** No BFF origin is left anywhere. All three of these must find nothing on the PR head:
  - `rg -n "metfix-bff|wispy-mode-982d|workers\.dev" client shared` (excluding nothing).
  - The same grep over the built `dist/`.
  - `rg -n "VITE_[A-Z_]*(KEY|SECRET|TOKEN)" client` on new or changed lines, a new-code check only, because the Sanity token is a known pre-existing hit handled by its own PR.

  (1.4.15, §0f R-B) The vitest repo-scan test RS-C5 (was a CI step "No BFF origin in client or bundle") runs the first two, the bundle scan on TK1's in-test build, and fails on any match. The third is a full `client/` scan once main is in (E2).

## 5. Login, account creation and comment writes (merge-gating)

These items gate #2. **The browser never calls BSI**: every auth and write call goes browser → same-origin Worker (`https://metfix.org/api/auth/*`, `/api/daily-fix/*`) → BSI server-to-server. No BSI token, refresh token, API key, OAuth client secret or reCAPTCHA secret ever reaches the client, a URL, or a log line. A POST without a valid session returns 401 and never reaches BSI (P4).

### 5.0 OI-1 (CLOSED in 1.4): the JSON login route exists

Verified in BSI at `d3234a50` (local checkout `/workspace/bsi-rt`):
- (Historical, 1.4 code fact; BSI-C1 retired from PR2 in 1.6.0.) `includes/app-password-auth-rest.php:169-179` registers `POST /wp-json/bsi/v1/auth/login` (`register_rest_route('bsi/v1','/auth/login', CREATABLE)`; the path string is at `:172`). Loaded by `includes/bootstrap/bsi-bootstrap-rest.php:61`; listed in `docs/rest-route-inventory-bsi-v1.md:209`.
- Permission `bsi_app_auth_permission_login` (`:19-22`) = `bsi_require_api_key($r, 30, 60, 'bsi_app_auth_login_')`: X-API-Key required, 30 req / 60 s per key.
- Handler `bsi_app_auth_handle_login` (`:100-167`): JSON `{username, password, client_id}` (all required, else 400 `missing_fields`). `username` may be a login or an email (`bsi_app_auth_authenticate_user`, `:50-70`, email fallback at `:59-64`). Bad credentials → 401 `invalid_credentials` "Invalid username or password." (one message for both fields). Disabled/spam/deleted/role-blocked → 403 `login_disabled` (`:75-95`). On success it calls `bsi_oauth_post_token` with `grant_type=password` (`:135-139`) and returns the WP OAuth token response (access_token, refresh_token, …) plus `member_id` (`:156-166`). Upstream token failures → 500 `oauth_misconfigured` / 502 `oauth_upstream_error` / mapped token error.
- Failure throttle (`:27-45`, constants `:13-14`): 10 failures per 900 s per `md5(REMOTE_ADDR|lower(username))` → 429 `rate_limited`. ⚠ `bsi_app_auth_client_ip` (`app-social-auth-rest.php:25-29`) uses `REMOTE_ADDR`, which for Worker calls is the **Cloudflare egress IP**, so BSI's throttle effectively keys on username only for metfix.org traffic. The Worker therefore owns per-IP throttling (S-RL).
- Refresh: `POST /wp-json/metfix/v1/proxy/oauth/token` (`metfix-proxy-apis.php:260-269`, permission `metfix_proxy_require_api_key`), `grant_type=refresh_token` branch at `:197-207` requires `client_id` and `refresh_token` (else 400 `bsi_metfix_bad_request`). The server adds the secret.
- BSI Lead's "no JSON login route" was based on `app-social-auth-rest.php` only; the route lives in a separate file. **App Lead was right.**

**Ruling:** email/password login is **path A only**: JSON login proxied by the Worker. The OAuth authorize redirect (PKCE + state) is used **only** where Google or the bridge requires it (§5.3). No password ever goes through a WP OAuth authorize page in #2.

### 5.1 Worker routes (all under `/api/auth/`, exact paths, before the `/api/` 404 catch-all)

| Route | Method | Request (from browser) | Success | Notes |
|---|---|---|---|---|
| `/api/auth/csrf` | GET | none | 200 `{csrf}`; sets `__Host-mfx_pre` if absent | Pre-session CSRF bootstrap (L1). `no-store`. |
| `/api/auth/login` | POST | `{identifier, password, recaptcha}` | 200 `{signed_in:true, public_name}`; sets new `__Host-mfx_sid` | Calls BSI `/bsi/v1/auth/web-login` (BSI-C10, 1.6.0, §0s); never `/bsi/v1/auth/login`. |
| `/api/auth/logout` | POST | `{}` | 204; clears cookie | Revokes server-side (S6). |
| `/api/auth/signup` | POST | `{username, email, recaptcha}` | 202 `{status:"check_email"}` | Calls `/auth/register-direct`. No session is created; the user sets a password via WP's emailed link, then logs in (path A). The `bridge_url` BSI returns is **discarded server-side**, never sent to the browser (A-T13). |
| `/api/auth/username-check` | GET | `?username=` | 200 `{available:bool}` or `{valid:false}` | Calls `/auth/register/check-username`. Rate limited (S-RL). Signup-only; never says anything about emails. |
| `/api/auth/google/start` | GET | `?intent=login|register&return=<path>` | 302 to Google with `state`, `nonce`, PKCE `code_challenge` (S256) | Server stores `{state, nonce, verifier, intent, return}` keyed by state (S5). |
| `/api/auth/google/callback` | GET | `?code&state` (from Google) | 302 to `return` with new session | Worker trades the code with Google (its own client secret), verifies the ID token (S5.3), then calls BSI `/auth/social`. If BSI returns a `bridge_url`, the Worker follows the bridge server-side to obtain a WP code for `https://metfix.org/api/auth/callback`, then trades it (below). |
| `/api/auth/callback` | GET | `?code&state` (WP OAuth redirect) | 302 to `return` with new session | The pinned WP redirect URI. Validates state, then trades the code at `/metfix/v1/proxy/oauth/token` with `grant_type=authorization_code` and the pinned `redirect_uri` (no `code_verifier`; BSI-side PKCE deferred, §0s.10). |
| `/api/auth/me` | GET | none | 200 `{signed_in, public_name}` | Replaces 1.3.1's `/api/auth/session`. Never returns tokens, email, login, user id or the CSRF token (R6a). KV, then `SESSION` DO on a miss (R5, 1.4.13); no BSI call, no refresh; no cookie → `{signed_in:false}` with no KV read (R5). `no-store`. |

- 1.4.1: browser-facing `/api/auth/refresh` **dropped** (R5); refresh is internal only. `/api/auth/callback` answers a browser GET with 400 (R12).

- Any other method on these paths → 405 with the correct `Allow`. No CORS / OPTIONS handling (same-origin only).
- `return` is a **same-origin relative path** matching `^/(?!/)[A-Za-z0-9/_\-#?=&.]*$`, max 512 chars; anything else (absolute URL, `//host`, `\`, scheme) → `/`. It is stored server-side with the state, never read back from the callback query (A-T2).

### 5.2 Session model

- **Cookie:** `__Host-mfx_sid=<opaque id>`; `Path=/; Secure; HttpOnly; SameSite=Lax`; no `Domain`. The ID is 32 random bytes (`crypto.getRandomValues`), base64url. It carries **no** token and no user data. Pre-session cookie `__Host-mfx_pre` (same attributes, `Max-Age=1800`) holds only the CSRF binding for signed-out forms (L1).
- **Server store (1.4.6, G1):** the **`SESSION` DO** (one instance per session, `idFromName("sess:" + sha256hex(id))`) is the source of truth and holds `{bsi_access, bsi_refresh, access_exp, user_public_name, bsi_user_id, created, last_seen}`, tokens encrypted per R7 (AAD = the instance name). **Deletion alarm (1.4.9, CQ):** on every write the DO sets one alarm at `min(last_seen + 30d, created + 90d)`; the alarm handler calls `storage.deleteAll()`. Logout, a refresh failure or the 90-day cap clears storage at once (`deleteAll()` + `deleteAlarm()`), whichever comes first; no token pair survives the session. **Workers KV `AUTH_SESSIONS`** (`sess:<sha256hex(id)>`) is only the `/me` read cache: `{user_public_name, created, last_seen}`, no tokens, `expirationTtl` **60** s (G10, 1.4.11), written by the Worker after each DO change and on every `/me` miss (rebuilt from the `SESSION` DO). The raw ID is never stored or logged. OAuth transaction state is in the `OAUTH_STATE` DO (§0b.1), record `{flow, nonce, verifier, intent, return, pre_hash, created}`, 600 s alarm, taken atomically (read+delete in one DO request).
  - **Why DO + KV (1.4.6):** the DO serialises refresh and holds the current token pair, so concurrent refreshes from any isolate share one upstream call; KV keeps `/me` cheap. Known cost: after logout, `/me` in another colo may still show signed in for up to ~60 s (KV lag); every user-acting call goes through the DO and gets 401 `signed_out` immediately (A-T14).
- **Lifetime (N2, ruled by Web Lead):** 30 days **rolling**: each authenticated request more than 24 h after `last_seen` extends the `SESSION` DO alarm and cookie `Max-Age` to 30 days (the KV `/me` entry is always TTL 60 s, G10). Absolute cap (R15): **90 days from `created`, inclusive (expired when age >= 90d; 1.4.8)**, or earlier if BSI refuses a refresh (BSI-C3 to state the refresh-token life).
- **Rotation (1.4.1, R4):** a new session ID is issued (old KV key deleted) on login, Google sign-in and privilege change **only**; a refresh keeps the ID and rewrites the same entry. Any pre-existing `__Host-mfx_sid` sent with a login request is ignored and deleted (A-T1).
- **Silent refresh (S4):** when `access_exp − now < 60 s`, or BSI returns 401 on a user call, the Worker calls BSI-C3 once with the stored refresh token, stores what BSI returns (new `refresh_token` if present, else the current one kept; no rotation assumed, §0s.10) under the **same** session ID (R4), and retries the user call once. A refresh failure (400/401) clears the `SESSION` DO storage and the KV `/me` entry and returns 401 `{"error":"signed_out"}`; the client shows signed out. Refresh runs only inside the `SESSION` DO (1.4.6, G1): concurrent callers, from any isolate or colo, share one in-progress refresh and all receive the pair BSI returned; there is no KV re-read fallback. Refresh happens only on user-acting calls, never on `/me` (R5).
- **Logout and revocation (S6, Q19a):** clear the `SESSION` DO storage (`deleteAll()`, token pair gone) and delete the KV `/me` cache entry, set `__Host-mfx_sid=; Max-Age=0`, and call BSI-C4 with `{refresh_token}` and **no** Authorization header. BSI failure doesn't block local logout. A `SESSION` DO outage doesn't either (§0c G9: 204, cookie cleared, revocation best-effort and logged without token data; next `/me` signed out if the KV delete succeeded, else signed-in display for ≤60 s only, per G9/Q5). ⚠ No revoke route exists in BSI today (BSI-C4 is needed).

### 5.3 Google sign-in (OAuth with PKCE; only place authorize is used)

- Flow: `/api/auth/google/start` → Google authorize (`response_type=code`, `scope=openid email profile`, `state`, `nonce`, `code_challenge_method=S256`, `redirect_uri=https://metfix.org/api/auth/google/callback`) → `/api/auth/google/callback` → Worker trades code at Google's token endpoint with `GOOGLE_WEB_CLIENT_SECRET` (Worker secret; client ID is non-secret config) → verifies ID token → BSI `/auth/social`.
- **ID-token checks (the Worker verifies; BSI may verify again):** signature against Google JWKS (cached ≤1 h, `kid` match, RS256 only); `iss ∈ {https://accounts.google.com, accounts.google.com}`; `aud` == metfix.org web client ID exactly; `exp > now` (≤60 s skew) and `iat` not in the future; `nonce` == stored nonce; `email_verified === true` required for any email-based linking (E-A2). Any failure → 302 to `/?auth_error=google` (generic), no BSI call.
- **What goes to BSI:** `/auth/social` takes `{provider:"google", intent, access_token}` (`app-social-auth-rest.php:655-667`). Whether it accepts a Google **ID token** for a web client ID (vs a native access token) is BSI-C5.
- **Bridge:** `/auth/social` returns `{bridge_url}` (`:698`, `:730`) with a 60 s one-time token; `/auth/app-oauth-bridge` is public (`permission_callback __return_true`) and redirects via WP OAuth authorize to `redirect_uri` with a code. The Worker follows it **server-to-server only** (never 302s the browser to it), with `redirect_uri=https://metfix.org/api/auth/callback` and its own state/PKCE, and trades the code via BSI-C3. A bridge invalid/expired returns 403 `invalid_ott` (`:392-405`) → generic Google error.
- `intent`: `login` on a 404 `account_not_found` (`:709`) → show "No account yet: create one?" which restarts with `intent=register`. `register` on 409 `account_exists` (`:690`) → same generic "Sign in instead" (E-A2 decides linking).

### 5.4 CSRF, rate limits, reCAPTCHA, headers, errors

- **P2 CSRF (all POSTs incl. login/signup/logout/comments):** stateless HMAC per R6 (no server-side storage), returned only by `/api/auth/csrf` (R6a), echoed in `X-CSRF-Token`, compared constant-time. Plus `Origin` must equal `https://metfix.org` exactly, and `Sec-Fetch-Site` must be `same-origin` when present. Mismatch → 403 `{"error":"forbidden"}`. GET routes never change state (except `/csrf` creating the pre cookie, and OAuth callbacks guarded by state).
- **State / nonce / PKCE:** state = 32 random bytes, single use (deleted on first read, TTL 600 s), bound to the `__Host-mfx_pre` value that started the flow (a callback whose pre cookie differs → reject). Missing, unknown, expired, reused or mismatched state → 400 → redirect `/?auth_error=state`, no token exchange. PKCE S256 verifier 43–128 chars, never leaves the Worker.
- **S-RL rate limits (Workers Rate Limiting binding, counter fallback as P8):**
  - Writes (comment POST, signup): **5 per 60 s per IP** (username-check has its own bucket, R16) (`CF-Connecting-IP`; for comment POSTs keyed `${userId}:${ip}` as P8). Over → 429 `{"error":"rate_limited"}`, `Retry-After: 60`, no upstream call.
  - Login throttling (R8, 1.4.2): R8a per `sha256(lower(trim(identifier)))`, 5 free failures then 1 s, 2 s, 4 s … 60 s lockout cap; R8b 20 attempts per 60 s per `sha256(IP)` across identifiers (stuffing); R8c one global DO counter, 25 upstream logins per 60 s site-wide. All in the `LOGIN_THROTTLE` DO, 429 + Retry-After, no server sleep. A password reset clears the account delay (Q24a; needs BSI signal, BSI-C9). BSI's own 10/900 s per username still applies.
  - Google start/callback: 20 per 60 s per IP.
- **reCAPTCHA v3 (1.6.0: login token forwarded to BSI-C10 unverified, 0 Worker siteverify on login, §0s.3):** verified server-side on signup and comment POST before the BSI call (threshold/actions: Spec defaults table). Secret = Worker secret `RECAPTCHA_SECRET`. Action names `login`, `signup`, `comment`; the Worker checks `action` and `hostname == metfix.org`.
- **Headers on every `/api/auth/*` response:** `Cache-Control: no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`. Redirect responses (`/callback`) carry no tokens or codes in `Location`. CSP (R18: the Worker's HTML path for `/the-daily-fix*`; `_headers` in Report-Only elsewhere, PR4) adds `script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/` and `frame-ancestors 'none'`; no inline script (A-T15).
- **Upstream headers:** W5 set + `Content-Type: application/json`; `Authorization: Bearer` only on user-acting calls (comment POST, signed-in leaderboard read, social link). Never forwarded: client Cookie, Authorization, IP headers (T2). No exception (1.6.1, §0s.5).
- **Error mapping (Worker → browser; bodies are fixed strings):**

| BSI outcome | Browser |
|---|---|
| login 401 `invalid_credentials`, 403 `login_disabled`, 404 user | 401 `{"error":"invalid_login"}` "Email/username or password is incorrect." (identical for all three; A-T8) |
| login/any 429 `rate_limited` | 429 `{"error":"rate_limited"}` + BSI's `Retry-After` clamped by the Worker (integer seconds only, at most 600; missing, invalid, non-integer or HTTP-date → 60) (1.6.3), or the limiter's remaining window (R21) |
| login 400 `missing_fields` | 400 `{"error":"invalid_request"}` |
| signup success, or email/username already exists | 202 `{"status":"check_email"}` (same response; A-T8) |
| signup 400 `invalid_username` | 400 `{"error":"invalid_username"}` (format only) |
| refresh 400/401 | 401 `{"error":"signed_out"}`, session deleted |
| social 401 `invalid_social_token`, 403 `invalid_ott`, 404, 409 | redirect `/?auth_error=google` (generic) |
| 5xx, timeout (3 s; 5 s for token calls), bad JSON, no key | 503 `{"error":"unavailable"}`, `Retry-After: 300` (unified, R21) |
| reCAPTCHA low score / fail | 403 `{"error":"try_again"}` "Something went wrong. Please try again." |
| CSRF/Origin fail | 403 `{"error":"forbidden"}` |

- **Logging:** Worker logs never contain passwords, tokens, codes, state, nonce, verifier, session IDs, cookies, `bridge_url`, or full emails; identifiers are logged only as a 12-char sha256 prefix. Test asserts against a captured `console` (A-T5).

### 5.5 Comment writes (carried from 1.3.1)

- **P1.** Session via §5.2 (replaces 1.3.1's "encrypted cookie holds tokens": tokens are now server-side in the `SESSION` DO (1.4.9; KV is the token-free `/me` cache); the cookie is an opaque ID).
- **P3.** Body allowlist: JSON `{date, type ∈ belly|body|brain, content, parent_comment_id?}`; `content` trimmed 1–2000 chars (Q-BSI-4); body ≤ 8 KB else 413; `Content-Type: application/json` else 415; unknown fields dropped; body rebuilt.
- **P4.** Upstream write headers are W5 + `Content-Type` + `Authorization: Bearer <user token>`. No session → 401 by the Worker, no BSI call (F7).
- **P5.** Fixed upstream paths and methods; no client-supplied path, host or method.
- **P6.** Login rules O6/L1/Q24a/Q19a/B4 as §5.4 and §5.2.
- **P7.** Writes never cached; a successful write purges the W9 entry for that date (local colo only, best effort); the client appends the new comment optimistically (R17).
- **P8.** Write rate limit, as 1.3.1 (5/60 s per `${userId}:${ip}`), runs after session+CSRF, before reCAPTCHA and upstream.
- **P10 (1.5.0, D-4, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).** Post, reply, edit, delete and like, per §0p.4. ~~Post and reply only; no edit, delete or like.~~
- **P11 (1.5.0, D-5, decided, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).** Leaderboards are **hidden when signed out**; signed-in reads use the user's Bearer token (L3 sends `Authorization` for signed-in users only). D-LB's key-only route is therefore **not needed**; signed-out `/api/daily-fix/leaderboard` → 401 `{"error":"signed_out"}`, and the UI shows "Sign in to see the leaderboard."

### 5.6 Ethan admin steps (not questions; redirect URI ruled as admin steps, E-A3 removed)

Pinned callback URIs (exact strings, no wildcards):
- **WP OAuth redirect URI:** `https://metfix.org/api/auth/callback`
- **Google redirect URI:** `https://metfix.org/api/auth/google/callback`; **Google JS origin:** `https://metfix.org`

Host facts (checked 2026-10-19 19:2x PDT): main `9f7129d7` `wrangler.jsonc` has no `routes`/custom-domain entries (the domain is attached in the dashboard) and no `workers_dev:false`, so a `metfixhome.<account>.workers.dev` host may also serve the site. `https://www.metfix.org/` returns **301 → `https://metfix.org/`**, so www needs no URI. **Preview login is not supported**: `__Host-` cookies are host-bound, and the Origin check, reCAPTCHA hostname, and redirect URIs are pinned to `https://metfix.org`; a workers.dev or preview host gets 403 on auth POSTs and no OAuth URIs are registered for it. QA tests auth with Worker unit tests and on prod after deploy. A-item **AUTH-HOST**: the Worker rejects auth routes when `Host != metfix.org` (404).

Steps:
1. **BSI App API settings → OAuth bridge redirect URIs** (`includes/admin/app-api-settings-admin.php`, save handler calls `bsi_app_oauth_redirect_uris_save($lines)` at `:71`; stored as a wp_option, `includes/app-oauth-redirect-uris.php:5`): add the line `https://metfix.org/api/auth/callback`.
2. **WP OAuth Server → the metfix.org client** (new or existing per E-A1-adjacent BSI-C8): add redirect URI `https://metfix.org/api/auth/callback`; give Web Lead the `client_id` (non-secret) for Worker config.
3. **Google Cloud console** (1.5.0 D-1: the app's **existing** web client, no new client): authorized JS origin `https://metfix.org`; redirect URI `https://metfix.org/api/auth/google/callback`. Put the client secret into Worker secret `GOOGLE_WEB_CLIENT_SECRET` (`wrangler secret put`), never `VITE_*`.
4. **Worker secrets:** `DAILY_FIX_API_KEY` (no user_id, T1c), `SESSION_ENC_KEY`, `RECAPTCHA_SECRET`, `GOOGLE_WEB_CLIENT_SECRET`; KV namespace `AUTH_SESSIONS` bound.
5. **reCAPTCHA** v3 key domain list exactly `brokenscience.org`, `brokenstaging.wpengine.com`, `metfix.org` (1.5.0 D-3; no www, no previews; PD12).

### 5.7 Spec defaults for CQ/QA review

| Item | Default set by Spec (1.4) |
|---|---|
| N4 | reCAPTCHA v3 threshold **0.5**, the same for sign-in, sign-up and posting. |
| N5 | Low score → **403** with generic "Something went wrong. Please try again." No v2 fallback. |
| N7 | One leaderboard per Daily Fix workout component that has a `scoring_field`, using BSI's default `scoring_field`; an all/rx/scaled filter offered to the user, default **all**. |
| N9 | Top **25** rows, no paging. |
| N10 | The signed-in user's own row is highlighted; if outside the top 25 it is appended below a divider (from a second signed-in read with the user's rank, or BSI field if provided). |
| Session store | `SESSION` DO per session holds the AES-GCM-encrypted token pair (§5.2, R7) with a deletion alarm; Workers KV `AUTH_SESSIONS` is only the token-free `/me` cache. |
| Throttles | S-RL values in §5.4. |

## 5a. Acceptance list: auth (must pass to merge)

- **AU1.** Routes exactly as §5.1; others 405/404; no OPTIONS; auth routes 404 on any host other than `metfix.org` (AUTH-HOST).
- **AU2.** Login calls ~~BSI-C1~~ **BSI-C10 (1.6.0)** once with `{username: identifier, password, client_id, recaptcha_token}` + W5 headers (no IP header, §0s.2); on 200 it creates a new session (new ID, old cookie ignored and its KV entry deleted) and returns only `{signed_in, public_name}`.
- **AU3.** No response body, header, `Location`, HTML or JS bundle ever contains `access_token`, `refresh_token`, the API key, a client secret, the reCAPTCHA secret, an OAuth code, or a `bridge_url` (test greps every Worker response in the suite + `dist/`).
- **AU4.** Cookie is exactly `__Host-mfx_sid=…; Path=/; Secure; HttpOnly; SameSite=Lax` with `Max-Age=2592000`; no `Domain`.
- **AU5.** The token pair lives only in the `SESSION` DO (`idFromName("sess:" + sha256hex(id))`), encrypted per R7 (ENC-T1–T4). KV key `sess:<sha256(id)>` holds only the token-free `/me` cache (AU5.x); KV `/me` TTL always 60 s (G10); DO alarm 30 days idle, extended (and cookie reissued) only on the >24 h rewrite (R15); absolute cap per R15.
- **AU5.x (1.4.7, R7).** With a recording KV fake (captures every `put` key, value and options), drive the real routes through (a) password login, (b) a refresh triggered by a user-acting call, (c) a Google callback. Enumerate every KV key and value written. Assert that none contains token material: neither the test access-token nor refresh-token value (raw, base64 or base64url), no string starting `v1.` (R7 ciphertext prefix), and no JSON field whose name matches `/token|refresh|access/i` at any depth.
  - **M-KV1 (mutation).** Also write the token pair (plain or R7-encrypted) to the KV `sess:*` entry → **exactly AU5.x** turns red (red set {AU5.x}).
- **AU6.** Session ID rotates on login, Google sign-in and privilege change only, never on refresh (R4); a rotated-away ID then returns 401.
- **AU5.y (1.4.9, CQ).** Under Miniflare with the real `SESSION` DO: after (a) logout, (b) a refresh failure, (c) the alarm firing at 30 days idle, (d) the 90-day cap (age >= 90d), `storage.list()` is empty and no alarm remains; after a normal write exactly one alarm is set at `min(last_seen+30d, created+90d)`. Mutations: **M-DO1** drop the alarm; **M-DO2** logout skips `deleteAll()`; **M-DO3** alarm set at `created+90d` only. Exact red sets (1.4.11, accepted): M-DO1, M-DO3 = {AU5.y, AU5.3}; M-DO2 = {AU5.y, AU7.8, AU8.1, AU8.2, AU8.4}.
- **AU5.z (1.4.11, G10).** Recording KV fake across login, `/me` hit, `/me` miss (rebuild from `SESSION` DO), >24 h rewrite, refresh, Google callback and the 90-day boundary (1.6.4, case (e): a user-acting call triggering a refresh runs in two variants, BSI-C3 returning a new `refresh_token` and BSI-C3 returning none/the same one (non-rotating); both must force a `sess:*` put): every `put` to a `sess:*` key has `expirationTtl === 60` (no `expiration`, no missing TTL), with a vacuity check (≥1 put per flow). **M-TTL1:** `/me` put uses `expirationTtl: 2592000` (30 d) → red set exactly {AU5.3, AU5.4, AU5.z, AU7.8} (1.4.12). **M-TTL2:** `/me` miss returns signed out instead of rebuilding from the DO → red set exactly {AU5.4, AU5.z} (1.4.12).
- **AU7.** Silent refresh per S4 (via the `SESSION` DO): near-expiry or BSI 401 triggers exactly one BSI-C3 call, retries the user call once, stores BSI's returned pair; refresh failure deletes the session and returns 401 `signed_out`.
- **AU7.6 (restored 1.6.4, ruled by MetFix Web Lead, 2026-10-20 (CQ delta 1.6.2); refresh serialisation).** Real `SESSION` DO under Miniflare/`unstable_dev`; KV fake returns the previous value for a configured lag after each `put`; two isolates make 50× concurrent user-acting calls needing refresh. BSI-C3 mock is **non-rotating** (returns the same refresh token, or none) with a new access token `ACCESS2`. Expect: exactly **1** upstream BSI-C3 call, every caller uses `ACCESS2` and succeeds, the user stays signed in. No rotation premise. Mutations restored against it: **M42c** (non-serialised refresh) → red {AU7.6}; **M42e** (second caller gets the stale pair) → red {AU7.6}; M42 and M42d regain AU7.6 as a killer.
- **AU8.** Logout clears the `SESSION` DO storage (token pair deleted, alarm cancelled), deletes the KV `/me` cache entry, expires the cookie, and calls BSI-C4 with `{refresh_token}` and no Authorization (Q19a); returns 204 even if BSI fails or the `SESSION` DO is down (§0c G9; logged with no token data).
  - **AU7.8 (1.4.10, Q5).** KV delete succeeds → the next `/me` is `{signed_in:false}`. **Delete-failure case:** KV fake throws on (or delays) the `/me` delete → `/me` shows signed in for **at most 60 s** (fake clock; at 60 s+ signed out, bounded by the 60 s KV TTL per G10, not by a retry); comment POST, leaderboard and any refresh fail closed **immediately** (401 `signed_out`, or 503 under a `SESSION` outage, 0 BSI calls); captured logs contain no token, ciphertext or raw session id. Covered by residual AU8.1; no DO call from `/me` (CK-W5 still 0 BSI calls).
- **AU9.** CSRF per §5.4 on every POST; missing/wrong token, wrong Origin, or `Sec-Fetch-Site: cross-site` → 403 and no upstream call.
- **AU10.** OAuth state is single-use, 600 s, bound to `__Host-mfx_pre`; missing/unknown/reused/expired/mismatched → no token exchange.
- **AU11.** PKCE S256 on the Worker-to-Google leg; verifier never in a URL to the browser. (BSI/WP authorize leg PKCE deferred, §0s.10.)
- **AU12.** Google ID token checks (sig, iss, aud, azp, exp/iat, nonce, email_verified for linking; JWKS per R13) each fail closed with no BSI call.
- **AU13.** `return` validation per §5.1; `//evil`, `https://evil`, `/\evil`, `javascript:` → `/`.
- **AU14.** Signup returns the same 202 for new, existing-email and existing-username cases; the `bridge_url` is never relayed; no session is created.
- **AU15.** Username check returns only `{available}`/`{valid:false}`, is rate limited in its own bucket (R16; client blur/≥500 ms debounce), and needs a valid `__Host-mfx_pre` + CSRF header (makes bulk enumeration costlier).
- **AU16 (restated R21: no branch on user existence).** Login error responses are byte-identical for unknown user, wrong password and disabled account, and response timing does not branch on user existence beyond BSI's own. Early returns that don't depend on whether the user exists (R8a/R8b/R8c, reCAPTCHA, CSRF) are allowed (R21).
- **AU17 (1.4.2).** S-RL limits as §5.4 (mocked binding) and login throttles R8a per identifier, R8b per IP, R8c site-wide 25/60 s (mocked DO, CK-W7); every layer returns 429 with `Retry-After`, no server sleep, no BSI call.
- **AU18.** (1.6.0: signup and comment only; login per AU26.2.) reCAPTCHA verified server-side with action + hostname checks, threshold 0.5; failure → 403 `try_again`, no BSI call.
- **AU19.** Headers per §5.4 on all `/api/auth/*`; CSP as §5.4 on HTML.
- **AU20.** Logs: no secret, token, code, state, session ID, password or full email (captured-console test).
  - **AU20.1 (extended 1.6.4).** The captured-console test also runs web-login across every §0s.4 outcome (200, each 4xx code, 401 `forbidden`, 429, 5xx, timeout, bad JSON): neither the `recaptcha_token` value nor the password appears in any log line, and the `bsi_client_not_allowed` line contains neither `client_id` nor the API key. — **M-WL17**: log the upstream response/request body on BSI 5xx → red {AU20.1}.
- **AU21.** `/api/auth/me` returns only `{signed_in, public_name}` (B4 applied; no CSRF token, R6a), `no-store`; KV, then DO on a miss (R5), CK-W5.
- **AU22.** The client has no `localStorage`/`sessionStorage`/`document.cookie` use for auth (vitest repo-scan RS-AU22 scoped per R20; 1.4.15), and no call to any BSI origin (`rg -n "brokenscience\.org" client dist` finds nothing).
- **AU23 (1.5.0).** Edit/delete/like routes exist per §0p.4 (CW1.1–CW10.1); signed-out leaderboard → 401, UI "Sign in to see the leaderboard." (AU23.2). AU23.1 retired.
- **AU24.** OI-1 path A only: no Worker route proxies or redirects to the WP OAuth authorize page for passwords.

## 5b. BSI contracts needed (exact)

All calls are server-to-server from the Worker with `X-API-Key: <metfix.org key>` (no user_id, T1c), `Accept: application/json`, `User-Agent: metfixhome-worker/1.0`. ✅ = exists at `d3234a50` (shape to confirm by BSI Lead); 🆕 = needed.

- ~~**BSI-C1 Password login.**~~ Retired from PR2 in 1.6.0 (replaced by BSI-C10, §0s.7); its asks are struck (1.6.4). Historical text: `POST /wp-json/bsi/v1/auth/login`. Auth: X-API-Key (30/60 s per key). Request `{"username": "<login or email>", "password": "…", "client_id": "<metfix.org OAuth client id>"}`. Response 200 `{access_token, refresh_token, expires_in, token_type:"Bearer", scope?, member_id?}`. **Needed addition:** `public_name` (D-NAME) and `user_id` in the 200 body (BSI-C6 dropped in 1.5.3); plus strict boolean `can_moderate` (§0r.1, relayed from BSI Lead). Errors: 400 `missing_fields`; 401 `invalid_credentials`; 403 `login_disabled`; 429 `rate_limited`; 500 `oauth_misconfigured`; 502 `oauth_upstream_error`. **Needed fix:** the failure throttle must key on a client IP BSI trusts from the Worker (e.g. a signed `X-MFX-Client-IP` accepted only with the metfix.org key) or BSI confirms username-only keying is intended.
- **BSI-C2 ✅ Sign-up.** `POST /wp-json/bsi/v1/auth/register-direct`. Auth: per `bsi_app_auth_permission_register_direct` (BSI Lead to state). Request `{"username", "email", "client_id", "redirect_uri": "https://metfix.org/api/auth/callback", "state"?}`. Response 200/201 `{bridge_url?, …}` and WP emails a set-password link. Errors: 400 `invalid_username` / `missing_oauth_params` (redirect_uri not allowed), 409 on existing (BSI Lead to state code), 429, 500 `registration_failed`. **Needed:** confirm that the emailed set-password link lands the user on a page that tells them to sign in at metfix.org (or a `return` to `https://metfix.org/`).
- **BSI-C2a ✅ Username check.** `GET /wp-json/bsi/v1/auth/register/check-username?username=…`. Auth: `bsi_app_auth_permission_check_username`. Response 200 `{available: bool}` (BSI Lead to confirm the field). Errors 400 `invalid_username`, 429.
- **BSI-C3 ✅ Token exchange / refresh.** `POST /wp-json/metfix/v1/proxy/oauth/token`. Auth: `metfix_proxy_require_api_key`. Request (refresh) `{"grant_type":"refresh_token","client_id","refresh_token"}`; (code) `{"grant_type":"authorization_code","code","client_id","redirect_uri":"https://metfix.org/api/auth/callback"}` (exactly 4 keys, 1.6.3). Response 200 = WP OAuth token JSON `{access_token, refresh_token, expires_in, token_type}`. Errors: 400 `bsi_metfix_bad_request`; 400/401 OAuth errors (`invalid_grant`) relayed as-is. (Rotation and PKCE asks removed in 1.6.1, deferred, §0s.10.)
- **BSI-C4 🆕 Revoke.** `POST /wp-json/metfix/v1/proxy/oauth/revoke` (or an existing WP OAuth Server revoke route, named). Auth: X-API-Key; **no** Authorization header (Q19a). Request `{"client_id","refresh_token"}`. Response 200 or 204, also for an already-invalid token. Errors: 400 missing fields, 429.
- **BSI-C5 ✅/🆕 Google social.** `POST /wp-json/bsi/v1/auth/social`. Auth: `bsi_app_auth_permission_social`. Request `{"provider":"google","intent":"login"|"register","access_token":"<Google token>","client_id","redirect_uri":"https://metfix.org/api/auth/callback","state"}`. Response 200 `{bridge_url}` (60 s one-time). Errors: 400 `invalid_provider`/`invalid_intent`/`missing_oauth_params`; 401 `invalid_social_token`; 404 `account_not_found`; 409 `account_exists`; 429; 500 `registration_failed`. **Needed:** accept tokens whose `aud` is the metfix.org web client (E-A1), and state whether it expects a Google access token or ID token.
- **BSI-C5a ✅ Bridge.** `GET /wp-json/bsi/v1/auth/app-oauth-bridge?<one-time token>`. Auth: public; the one-time token is the credential. Response 302 via WP OAuth authorize to the allow-listed `redirect_uri` with `code` and `state`. Errors 403 `invalid_ott`. **Needed:** confirm the bridge works for a server-side (cookie-less) client and that the token is single-use.
- ~~**BSI-C6 🆕 Me.** `GET /wp-json/bsi/v1/auth/me`. Auth: X-API-Key + `Authorization: Bearer`. Response 200 `{user_id, public_name}` (D-NAME; never login/email). Errors 401. (Not needed if BSI-C1/C3 return these.)~~ **Dropped in 1.5.3 (ruled by MetFix Web Lead, 2026-10-20; relayed from BSI Lead: there is no me route).** `user_id`, `public_name` and `can_moderate` come on the BSI-C1/C3 responses (§0r.1).
- ~~**BSI-C7 PKCE.**~~ Removed in 1.6.1 (deferred; Ethan's deferral relayed via CEO and MetFix Web Lead, 2026-10-20; A-T41).
- **BSI-C8 Client (PR2 merge dependency, 1.6.4; stands in for BSI-side PKCE with the API-key-gated proxy, A-T41).** A WP OAuth Server client for metfix.org (confidential; secret stays in BSI's proxy), grants `password`, `authorization_code`, `refresh_token`; redirect `https://metfix.org/api/auth/callback`. Name its `client_id`.
- **BSI-C10 🆕 Web login (1.6.0).** `POST /wp-json/bsi/v1/auth/web-login`, contract §0s.2. **Missing; BSI Lead owns it; PR2 merge dependency** (§0s.7).
- **BSI-C9 🆕 Reset signal.** How the Worker learns a password reset happened, to clear O6 (Q24a), or BSI states the Worker delay simply expires.
- **D-POST, D-NAME, D-AUTHZ, D-RL:** carried from 1.3.1 unchanged. **D-LB: not needed** under the N8 default (P11); revived only if Ethan rules leaderboards public.
- **Social links:** not used in #2 unless E-A2 = explicit link (then `GET/POST/DELETE /bsi/v1/auth/social/link(s)`, Bearer-gated, contract to be pinned in 1.5).

## 6. Threat list

| # | Threat | Control |
|---|---|---|
| T1a | The key reaches the client. | The key exists only as Worker secret `DAILY_FIX_API_KEY`. There is no `VITE_*` key. The vitest repo-scan (C5/RS-C5, TK1) runs on the built output. The Worker test asserts the key never appears in any response body or header. |
| T1b | The key leaks through an error message. | W6 bodies are fixed strings, and upstream bodies are never relayed. |
| T1c | The key acts as a user (F7). | The metfix.org Worker key must have **no user_id** in BSI (Q-BSI-5 confirms). The Worker never sends a write without a Bearer token (P4). |
| T1d | Key reuse. | metfix.org's key ≠ the app key ≠ the posts key (#3, G-question). Each can be revoked on its own. |
| T2 | Header smuggling. | The upstream header set is fixed (W5/P4). Never forwarded: `Cookie`, `X-WP-Nonce`, `X-Forwarded-For`, `CF-Connecting-IP`, `True-Client-IP`, `Forwarded`, `Origin`, `Referer`, or the incoming `Authorization`. Tested by asserting the exact header key set. |
| T3 | Open proxy or SSRF. | Fixed host via `assertBsiHost`, fixed path, rebuilt query (W3), method allowlist (W2/P5). |
| T4 | Rate-limit exhaustion: BSI allows 60 requests per minute per key and route, so traffic on comments could starve the shared key. | W9 edge cache (60 s), so roughly 1 upstream call per date per minute per colo. An upstream 429 is mapped to 503 with Retry-After (W6). For writes: P8, a Workers Rate Limiting binding keyed per user plus IP, with an in-Worker counter only if the binding isn't on our plan. |
| T5 | Cache poisoning or private-data caching. | Only anonymous GET 200 responses are cached. The key is `date` only. Bodies are stripped of `liked` and `user.id` (W7). Authed and write responses are never cached (P7). |
| T6 | XSS in comment HTML. | BSI strips tags on write (F9). The Worker passes `content` as a JSON string. The client renders it only as a text node: no `dangerouslySetInnerHTML` anywhere under `the-daily-fix/` (vitest repo-scan RS-T6; 1.4.15). A test renders `<img src=x onerror=…>` content as literal text. |
| T7 | Identity leak (B4). | B4-W, Q5a. |
| T8 | CSRF or session theft on writes. | P1/P2. `__Host-` cookies. No token in JS-readable storage. |
| T9 | Brute-force login. | R8a (O6) per identifier and R8b per IP in the `LOGIN_THROTTLE` DO, plus reCAPTCHA v3 (1.6.0: verified by BSI-C10 on login, by the Worker on signup/comment); the secret is a Worker secret only, never `VITE_*`. |
| T10 | A soft-deleted comment's content shows publicly. | W8 skips `deleted == 1` rows in the Worker, no placeholder; WT9. |
| T11 | Comment spam or write flooding. | P8 rate limit per user plus IP; reCAPTCHA v3; WT10. |
| T13 | Leaderboard leaks user ids or log ids, or names users by login. | L5 drops `user_id`/`workout_log_id`; D-NAME plus `Member` fallback; WT12. |
| T14 | Leaderboard reads exhaust the shared key, or a user_id key is used to unblock F10. | L6 (1.4.6): per-user 10/60 s limit before any upstream call, client per-date cache; signed-in only (P11), so no key-only route; T1c forbids a user_id key. |
| T12 | Writes ship without the BSI sign-in or posting route, or post with only the key (F7). | BSI PR dependency (top note); P4 returns 401 with no session. |

### Auth threat list (1.4)

| # | Threat | Control |
|---|---|---|
| A-T1 | Session fixation. | Opaque ID minted by the Worker; any incoming `__Host-mfx_sid` is discarded at login/Google sign-in and a new ID issued (AU6; refresh keeps the ID, R4); `__Host-` prevents subdomain cookie injection. |
| A-T2 | Open redirect via `return`/`redirect_uri`. | `return` validated (AU13) and stored server-side with state; redirect URIs fixed constants, BSI and Google allow lists hold exact strings only (§5.6). |
| A-T3 | Missing or replayed OAuth state. | Single-use state in the `OAUTH_STATE` DO, read+delete atomic, 600 s, bound to `__Host-mfx_pre` (AU10, AU10.8). **Residual closed (1.4.3)**; PKCE kept. |
| A-T4 | Authorization code interception. | Google leg PKCE S256 (AU11); BSI leg PKCE deferred (A-T41); codes delivered only to `https://metfix.org/...` callbacks; codes exchanged once server-side; `Referrer-Policy: no-referrer`; callback 302 strips query. |
| A-T5 | Token leakage to client, logs or URLs. | Tokens only encrypted in `SESSION` DO storage, never in KV (§5.2, AU5.x); AU3 response/bundle grep; AU20 log test; no token or code in any `Location`. |
| A-T6 | CSRF on login, logout, signup, posting (incl. login CSRF). | AU9: stateless HMAC token (R6) + exact Origin + Sec-Fetch-Site; SameSite=Lax. |
| A-T7 | Account enumeration via username check. | Signup-only, returns only availability, its own 20/60 s per-IP bucket (R16), requires pre-cookie + CSRF (AU15); accepted residual: usernames are inherently checkable. |
| A-T8 | Enumeration via login/signup errors. | One generic login error for unknown/wrong/disabled (AU16); signup always 202 `check_email` (AU14). |
| A-T9 | Account-linking takeover (attacker's Google with victim's email). | 1.5.0 D-2 (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT): auto-link **only** on boolean `email_verified===true` in a Worker-verified ID token (aud/azp == the existing app web client, D-1); otherwise no link and no register. See A-T20–A-T22, AU12.v/u/e, BSI-SL1. ~~Until ruled, never auto-link.~~ |
| A-T10 | Credential stuffing. | R8a per identifier, R8b 20/60 s per IP, R8c one global DO counter at 25/60 s as metfix.org's own breaker far below BSI-C10's 600/min key ceiling, reCAPTCHA 0.5 (verified by BSI-C10 on login), BSI-C10 per-username limit (AU17, AU26.5, AU26.6; A-T38, A-T38r, A-T43). |
| A-T11 | Forged Google ID token / wrong audience. | Full ID-token verification (AU12). |
| A-T12 | Google/WP state confusion between flows. | State records carry `flow` (`google`|`wp`, §5.2, R11); a state from one callback is rejected at the other. |
| A-T13 | bridge_url replayed within its 60 s. | `bridge_url` never leaves the Worker (AU3, AU14); followed once server-side; BSI-C5a confirms single use; the resulting code needs the Worker's state (BSI-leg PKCE deferred, A-T41). |
| A-T14 | Logout not honoured everywhere (KV lag). | Logout deletes the `SESSION` DO state, so user-acting calls fail at once; only `/me` display may lag ≤60 s (KV cache); BSI-C4 revoke stops refresh. |
| A-T15 | XSS stealing the session. | HttpOnly cookie (no JS access); no tokens in JS (AU22); CSP without inline script (AU19); comments are text nodes (T6). Residual: XSS can still act as the user while the page is open; CSP + CSRF origin checks limit it. |
| A-T16 | Cookie scope too wide (www/preview/subdomains). | `__Host-` (no Domain, Path=/), Secure; www 301s to apex; auth disabled on non-`metfix.org` hosts (AUTH-HOST). |
| A-T17 | Compromised refresh token. | Refresh token never leaves the Worker/`SESSION` DO; encrypted at rest; no rotation assumed (deferred, A-T41); revoke on logout (BSI-C4); 30-day rolling session ends on refresh failure. |
| A-T18 | KV read by another binding/operator, or a ciphertext moved between keys. | AES-256-GCM per R7 (AAD = `SESSION` DO instance name (R7; 1.4.13 N2), `v1.<kid>.<iv>.<ct>`, PREV decrypt-only); KV key is a hash of the session ID; ENC-T1–T4. |
| A-T19 | Worker key misuse to act as a user via auth routes. | Key has no user_id (T1c); user-acting calls require Bearer (P4). |
| A-T20 | **Unverified Google email** used to link to (and take over) an existing account. | D-2: link only on boolean `email_verified===true` from a Worker-verified token (AU12.v, AU12.u); unverified → login-by-`sub` only, never register/link; BSI-SL1 makes BSI refuse the email-link too. |
| A-T21 | **Email change.** (a) A user's Google email changes after linking; (b) a Google account later changes its email to match a different existing WP account; (c) the WP account's email changes. | The link is keyed on Google `sub`, not email (BSI resolves `sub` first, `app-social-auth-rest.php:265-268`), so (a) and (b) keep resolving to the originally linked account and create no new link. Auto-link happens only on the first sign-in, when no `sub` mapping exists, with a verified email (D-2). (c) doesn't affect the `sub` mapping. Residual: an admin of a Google Workspace domain that owns the victim's email domain can mint verified tokens for it; this is accepted under D-2 (relayed) and noted for Ethan. |
| A-T22 | **Existing-account takeover attempt** (attacker's Google token, client-claimed victim email, forged/foreign-audience token, replayed callback). | Server-side verification only (AU12: sig, iss, aud == the existing app web client per D-1, azp, exp/iat, nonce); no linking on any client-claimed email/`login_hint` (AU12.e); state/nonce/PKCE single-use (AU10, AU11); session rotation (A-T1). |
| A-T23 | **IDOR on edit/delete** (changing another user's comment by id). | Ownership decided by BSI from the Bearer (`canModifyComment`); Worker sends no user/owner field (CW4.1), rebuilds the path from the URL id (CW5.2), maps 403 to a fixed 403 (CW5.1, CW5.2); never key-only (F7, T1c). |
| A-T24 | **IDOR on like** (liking as another user, or forcing a like state for someone else). | BSI attributes the like to the Bearer user; Worker never key-only (CW5.3); no user field forwarded (CW4.1). |
| A-T25 | **Like-spam / toggle flooding** (inflating counts, starving the shared BSI bucket). | CW6.1 30/60 s per user+IP, CW6.2 4 toggles/60 s per user+comment, before BSI; desired-state toggling (no blind toggle); BSI-CM5 per-user bucket; T4 shared-key note. |
| A-T26 | **Auth on preview hosts** (cookies/reCAPTCHA/OAuth on hosts we don't pin). | D-3: auth and writes 404 off `metfix.org` exact (AU25.1), client UI off (AU25.2), reCAPTCHA hostname exact (AU18.h); the key covers no previews (PD12). |

## 7. Tests that flip (by file and name) — rewritten 1.4.1 against `3a721dcc`

Line numbers are at `3a721dcc` (from the PR's diff vs main).
- `worker/index.test.ts`:
  - "comments proxy forwards GET to BSI and returns the raw body" (952): **FLIPS**. It must now assert the whitelisted W7 shape (no `user.id`, no `liked`, `Member`, no `deleted == 1` rows) and that a second same-date GET makes 0 upstream calls with and without Cookie (CK-W2, CK-W3).
  - "comments proxy rejects bad input and non-GET without calling upstream" (982): **FLIPS**. Error codes become `invalid_date` / `invalid_type`; a `type` outside `belly|body|brain|all` → 400 with 0 upstream calls; `/comments/` → 404; 405 carries `Allow: GET, HEAD, POST` (R11).
  - "comments proxy maps upstream failures and refuses a non-BSI host" (1002): **FLIPS**. 401 and 403 separate kinds (both 503), 429 → 503 `Retry-After: 60`, 404 `no-store` and not cached.
  - "/api/foo returns JSON 404" stays green.
- `client/src/pages/the-daily-fix/comments.test.ts`: "asks the same-origin Worker for ISO date + type=all, never YYMMDD" (14) and the mapping tests (24, 33, 75, 83, 91, 107) **stay**; add the R23 Map-cache/in-flight test.
- `client/src/pages/the-daily-fix/CommentThread.test.tsx`: "shows the name field only when logged out" (13) **FLIPS** (R22 removes the name field: it asserts no name field in either state); "lets the user change comment type from the current tab" (29) stays.
- `client/src/pages/the-daily-fix/JoinModal.test.tsx`: "shakes Join with Email…" (13) stays unless the email form becomes real login (then rewritten against §5.1); "shows the Google logo on Continue with Google" (36) stays while Google is shown and becomes conditional under R9's gate.
- `client/src/pages/the-daily-fix/page.mount.test.tsx` "Daily Fix comments" block (1618): "keeps the day loaded when comments return 404" (1654), "thrown comments fetch keeps the day…" (1672), "shows No comments yet only after a real empty list" (1706) stay; "logged-out submit opens the join modal and does not POST or store a session" (1714) **FLIPS** in part: the `"Your name"` input step goes (R22); the no-POST/no-session assertions stay for the signed-out case. Add CK-C1 (exactly 1 `/me`, 1 comments GET per date).

## 8. Test outline (new)

- **Worker (`worker/index.test.ts`, with `fetchImpl` and cache mocks):**
  - **WT1.** GET with a valid date returns 200 in the W7 shape. The upstream URL is exactly `https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments?date=2025-02-10&type=all`.
  - **WT2.** The upstream header key set equals `{accept, x-api-key, user-agent}`, and the UA is `metfixhome-worker/1.0`. The test sends the incoming request with Cookie, Authorization, X-WP-Nonce, X-Forwarded-For, CF-Connecting-IP and True-Client-IP, and asserts none of them is forwarded.
  - **WT3.** Bad date, bad type, or extra query parameters: 400, or the extra parameters are dropped and absent from the upstream URL.
  - **WT4 (1.4.1, R11).** PUT, PATCH, DELETE and OPTIONS each return 405 with `Allow: GET, HEAD, POST`, and there is zero upstream fetch. (POST is the §5 write.)
  - **WT5.** The W6 table, row by row, including 401→503, 429→503 with Retry-After 60, a 3 s timeout, and no key. The test asserts the key string never appears in the body or headers.
  - **WT6.** Cache:
    - A second GET for the same date makes no upstream call.
    - Errors are not cached.
    - A request with an `Authorization` or `Cookie` header is served from and stored in the same anonymous cache entry (R3, CK-W3).
  - **WT7.** B4-W: `""`, `"  "`, `"Unknown"` and `"a@b.co"` each become `Member`, and `"[Anonymous]"` is kept. `user.id` and `liked` are absent from the output. (Soft delete is WT9.)
  - **WT8.** The host guard: a `bsiBaseUrl` pointing at another host makes no fetch and returns 503.
  - **WT9.** Soft delete: an upstream payload with a `deleted == 1` comment and a `deleted == 1` reply returns neither (absent by `id`), contains no placeholder text such as "Comment removed", and keeps the other comments in order. A `deleted == 2` row stays as `[Anonymous]`.
  - **WT11.** Leaderboard upstream: URL is exactly `.../daily-fix/workouts/{id}/leaderboard` with only the L2 params plus `leaderboard_mode=official`; header key set is `{accept, x-api-key, user-agent}` (no Authorization when signed out); extra params dropped; bad params 400; POST → 405.
  - **WT12.** Leaderboard shaping: `user_id` and `workout_log_id` absent; `public_name` of `""`, `"  "`, `"Unknown"`, `"a@b.co"` or missing → `Member`; an upstream 401 → 503 `unavailable`; second identical anonymous GET makes no upstream call, including with a Cookie (R3).
  - **WT13.** Sign-in (1.6.0, AU26.2): the reCAPTCHA token is forwarded byte-exact to BSI-C10 and the siteverify mock records 0 calls; BSI 403 `recaptcha_failed` → 403 `try_again`; the response body never contains `access_token` or `refresh_token`; the session cookie is `__Host-`, HttpOnly, Secure.
  - **WT10.** Write rate limit: with a mocked binding, the 6th POST within 60 s for the same user+IP returns 429 with `Retry-After: 60` and makes no upstream or reCAPTCHA call. A different user on the same IP, or the same user on a different IP, is still allowed. The limiter key passed to the binding is exactly `${userId}:${ip}`. A fallback-counter variant runs the same cases when the binding is absent.
- **Client:**
  - **CT1.** The relative URL (from §7).
  - **CT2.** XSS: content `<img src=x onerror=alert(1)>` renders as text, and `container.querySelector("img")` is null.
  - **CT3.** An author of `""` or whitespace becomes `Member` (the client fallback stays as defence in depth).
- **CI:**
  - **CI1.** The C5 greps on `client`, `shared` and `dist/`.
  - **CI2.** No `dangerouslySetInnerHTML` under `client/src/pages/the-daily-fix/`.
- **Login (§5):** QA's full list (§8a) supersedes this outline (see §8a).
  - R8a/R8b/R8c throttle table (CK-W7).
  - Q19a logout request shape.
  - CSRF mismatch returns 403.
  - A body over 8 KB returns 413.
  - An unknown field is not forwarded.
  - Bearer is present only on the write call.
  - A write purges the cache.

## 8a. QA test list (pinned, R10)

- **Reference (1.4.13, D1, Web Lead ruling 2026-10-19):** the governing list is **the QA list whose header pins this spec's md5** (`/workspace/specs/metfix-pr2-comments-login-tests.md`; in-repo copy in `docs/metfix-pr2-comments-login/`). The spec carries no QA rev or md5; Web Lead's handoff names both and is authoritative. No later pin edit is promised. The QA re-cut covers §0d (AU5.k, M-KVF1, CKT1.1, CK-P1 scope).
- **CK-P1 (1.4.9; one-way 1.4.12; shared script per D2 in 1.4.13):** the gate PR's shared CK-P1 script recomputes the md5 of the in-repo spec copy (`docs/metfix-pr2-comments-login/`) and compares it to the spec-md5 pin in the in-repo QA-list copy only; on mismatch it fails with exactly `PIN MISMATCH: <file>`. It never reads a QA md5 from the spec. Count-compare: QA header gate count == `gate-ids` block count, else `PIN MISMATCH: <file>`. PR2 adds no ci.yml step. **A-PIN1 (pre-r1):** PR2 passes this check run locally against its own docs pair before round 1. **Merge coverage (1.4.15, R-A):** gate PR merges first and PR2 brings in main so CI runs CK-P1 on the real head; fallback QA re-run on the exact merge-candidate SHA with Web Lead sign-off; evidence valid only for its SHA; any later push voids it.
- History: 1.4.12 named QA rev 1.4 (superseded). Rev 1.3 (`37464be6…`, against 1.4.10), rev 1.0 (`2498c37c…`, against 1.4.2) and rev 1.1 (against 1.4.4/1.4.5) superseded on re-cut.
- §7–§8 are the Spec outline only.

## 9. Open questions

**Ethan-only (short)**
- **E-A1 (decided 1.5.0, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).** Reuse the app's existing web client (D-1). Was: Google client: reuse the app's existing web client ID (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) for metfix.org, or create a new metfix.org web client? (Spec leans new: separate secret, origin and revocation.)
- **E-A2 (decided 1.5.0, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).** Auto-link only on `email_verified=true` (D-2). Was: Google/email account linking: auto-link by verified email, explicit link while signed in, or never? (Until ruled: never auto-link.)
- **N11 (decided 1.5.0, D-3, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).**
- **N6 (decided 1.5.0, D-4, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).**
- **N8 (decided 1.5.0, D-5, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).**
- **E-R9.** E-R9 is reported closed by Web Lead quoting Ethan ("Decisions MetFix CEO Relays count as mine", 2026-10-20 8:27 AM PT); awaiting Ethan's direct confirmation in my chat. (Original ask, kept: confirm in your own words that decisions relayed by MetFix CEO count as yours.)
- *(E-A3 removed: the redirect URI is an Ethan admin step, §5.6.)*

**Open item**
- **OI-1. CLOSED in 1.4.** JSON login exists (§5.0).


**BSI Lead**
- **Q-BSI-1 (TOP PRIORITY, 1.4.4).** Real names ship in #2 only once this is answered; until then every name renders `Member` (0b.6 #1). Can GET comments return a safe public name, or a flag such as `name_is_login`, so that B4/Q5a can be enforced? BSI doesn't send the login or email.
- **Q-BSI-2b.** Do thread replies under a soft-deleted comment need a placeholder? Default: skip, no placeholder.
- **Q-BSI-7.** The sign-in and posting routes for #2: is a new BSI PR needed, or is the existing POST callback (`daily-fix-apis.php:1691-1699` at `d3234a5`) intended?
- **Q-BSI-2.** Is `[Anonymous]` (deleted == 2) meant to be shown publicly with its content? And does deleted == 1 still return the original content?
- **Q-BSI-3.** Confirm the current `main` matches the cited lines (local checkout `d3234a5`, 2026-10-13). Also confirm the comments route lives on `brokenscience.org` and not only `api.brokenscience.org`; the deployed BFF uses `api.`.
- **Q-BSI-4.** Max comment length on POST.
- **Q-BSI-5.** Confirm the metfix.org Worker key has no user_id.
- **Q-BSI-6.** Confirm the 60/60 bucket is per key per route (`dfx_rl_` prefix) and not shared with `/daily-fix` day reads. Also confirm plan 1.1.3 status for Q24a.

**Ethan**
- **Q-E3.** Approve deleting metfix-bff and revoking its key once #2's route is live on prod and verified (post-merge).

**Web Lead**
- **Q-WL-1.** Decided: one PR (Ethan Oct 13 and 15; re-asked Oct 19), relayed via MetFix CEO (Ethan's standing rule on CEO-relayed decisions, as relayed by Web Lead 2026-10-15; Web Lead restated 2026-10-19). Not yet confirmed by Ethan directly. CQ has asked Ethan directly; if he answers otherwise, this reopens.
- **Q-WL-2.** Resolved: binding per user plus IP, counter fallback only (P8).
- **Q-WL-3.** Resolved: post-merge; Ethan approves and revokes.
- **Q-WL-4.** Resolved: skip, no placeholder (pending Q-BSI-2b).
- **Q-WL-5.** Resolved: the Project (A3); CQ reviews.

**New open questions (N).** These are fresh questions, stated plainly. They are **not** recovered G5–G7 text.
- **N1.** Resolved 1.4: both (password path A + Google).
- **N2.** Resolved by Web Lead: 30 days rolling, silent refresh (§5.2).
- **N3.** Resolved 1.4: account creation is in scope (§5.1 signup).
- **N4.** Spec default 0.5 (§5.7).
- **N5.** Spec default 403, no v2 (§5.7).
- **N6.** Decided 1.5.0 (D-4, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).
- **N7.** Spec default (§5.7).
- **N8.** Decided 1.5.0 (D-5, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).
- **N9.** Spec default 25, no paging (§5.7).
- **N10.** Spec default (§5.7).
- **N11.** Decided 1.5.0 (D-3, relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT).
- **N12.** What does a banned or locked BSI user see when trying to post?

## 10. Changelog
- **1.6.4 (2026-10-20).** Base 1.6.3 (`2d15e1f5…`, kept unchanged at `.rev1.6.3.md`). ruled by MetFix Web Lead, 2026-10-20 (CQ delta 1.6.2); item 4 CEO accepted (relayed). New §0s.13 addressing CQ delta 1.6.2 (`fdb03c29…`): AU7.6 restored (non-rotating, 1 BSI call) with M42c/M42e; R8c 25/60 s re-rationalised as metfix.org's breaker below BSI's 600/min; retired BSI-C1/C7 asks struck; AU20.1 web-login no-log + M-WL17; A-T43 lockout residual; shared `parseRetryAfter`; AU26.8 runtime check + M-WL14b/c/d, injected fetch/base; A-T41 PKCE stand-in, BSI-C8 merge dependency; §0r.1/R4/R25 stale text; AU5.z(e) non-rotating; M95b; A-T38r adopted. gate-ids 263 → 264, mutations 257 → 264.
- **1.6.3 (2026-10-20).** Base 1.6.2 (`d0851206…`, kept unchanged at `.rev1.6.2.md`). Wording only, ruled by MetFix Web Lead, 2026-10-20 (QA 1.6.2 points): BSI-C3 code request exactly 4 keys; login order R8a → R8b (per IP) → token shape check (non-empty string, else 400, one R8b attempt) → R8c (site-wide) → BSI-C10 (CK-W7, §0s, §0b.2, R25, A-T38, AU26.5, AU26.6); Worker clamps `Retry-After` (integer ≤ 600, else 60) in AU26.3, AU26.7, CW13.1, CW13.3 (note), §0p.4, §0r.2, §0s.4, §0s.11, §5.4, A-T30. No ID, mutation or count change (gate 263, mutations 257).
- **1.6.2 (2026-10-20).** Base 1.6.1 (`e2fa3c44…`, kept unchanged at `.rev1.6.1.md`). BSI-C10 contract locked by BSI Lead in the MetFix Web Build room, 2026-10-20; ruled by MetFix Web Lead. New §0s.11: BSI-C10 reCAPTCHA details (v3, `login`, `metfix.org`, ≥ 0.5, no `remoteip`, failures → `recaptcha_failed`); two 429 sources mapped identically (AU26.7, M-WL13; residual A-T42); BSI check order recorded as BSI behaviour; bad `X-API-Key` = BSI 401 `forbidden` (`functions.php:4360-4362`) → 503, mapping branches on code not status (AU26.3 case, AU26.9, M-WL15, M-WL16); web-login 200 body is the contracted one, `/auth/login` unchanged (BSI Lead); single BSI client module `worker/upstream.ts` (AU26.8, M-WL14; already allowed, file set unchanged). gate-ids 260 → 263, mutations 253 → 257, files +0.
- **1.6.1 (2026-10-20).** Base 1.6.0 (`009a7b08…`, kept unchanged at `.rev1.6.0.md`). Ruled by MetFix Web Lead, 2026-10-20: `X-MFX-Client-IP` dropped (AU26.4, M-WL8–M-WL10, A-T35–A-T37, §0s.5 exception removed; never-forward-IP rule unchanged; BSI-C10 throttles per username and client); A-T38 per-IP R8b before R8c (AU26.6, M-WL12), many-IP fill accepted residual; token shape check and `client_not_allowed` → 503 accepted by Web Lead. Ethan's deferral relayed via CEO and MetFix Web Lead, 2026-10-20: BSI-C7, BSI-C3 rotation ask, AU7.6, CK-W4 removed; A-T41 accepted residual. gate-ids 262 → 260, mutations 255 → 253, files +0.
- **1.6.0 (2026-10-20).** Base 1.5.4 (`4520ca2b…`, kept unchanged at `.rev1.5.4.md`). Scope rev, ruled by MetFix Web Lead, 2026-10-20; Ethan's ruling relayed via CEO, scope: web-login ships in PR2. New §0s: every `/auth/login` (BSI-C1) path removed; login calls only BSI-C10 `POST /wp-json/bsi/v1/auth/web-login` (missing, BSI Lead, PR2 merge dependency); login reCAPTCHA forwarded byte-exact and verified by BSI, 0 Worker siteverify on login (N5, R8b, R25, Q5, Q18, AU2, AU18, AU18.h, T9, WT13 updated); per-client secret (BSI-C8) and dedicated `client_id` kept; contract and client-facing error mapping (§0s.4); `X-MFX-Client-IP` narrow exception, needs Ethan's direct OK (security rule exception). +5 CI IDs (AU26.1–AU26.5), +11 mutations (M-WL1–M-WL11), A-T35–A-T40; gate-ids 257 → 262, mutations 244 → 255, files +0. E-R9 unchanged.
- **1.5.3 (2026-10-20).** Base 1.5.2 (`02c7cfbf…`, kept unchanged at `.rev1.5.2.md`). New §0r: Web Lead rulings (2026-10-20) on CQ pin check 9: `can_moderate` from login/refresh only, `/me` 0 BSI calls on hit and miss (B1); BSI-C6 dropped; Retry-After 600 s cap on all five actions (N2); demotion residual accepted (N3); BSI-CM6 merge dependency with hidden-controls fallback (N4); Node 24 evidence (N5); no edit on deleted (409) and idempotent delete (204) (N6); `liked` optional at BSI. +3 CI IDs (CW13.3, CW16.1, CW16.2), +5 mutations (M-CW23–M-CW27), A-T31–A-T34. E-R9 unchanged.
- **1.5.1 (2026-10-20).** Base 1.5.0 (`48f165cc…`, kept unchanged at `.rev1.5.0.md`). New §0q: D-6 owners and moderators may edit or delete (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20); BSI server rules relayed as confirmed by BSI Lead; canModifyComment resolved (owner or moderator, relayed); BSI-CM6 added; A-T27–A-T30; +9 CI IDs, +9 mutations. E-R9 note kept; the `{er9_new}` placeholder in §0p replaced with §9's E-R9 text. Counts: gate 245→254, box 12, post-deploy 14, mutations 230→239.
- **1.5.2 (2026-10-20).** Base 1.5.1 (`5855492c…`). Wording only: §0q.1 defines a moderator as administrators plus Daily Fix admins (relayed from BSI). No ID or count change.
- **1.5.0 (2026-10-20).** Base 1.4.25 (`ebdcb56c…`, kept unchanged at `metfix-pr2-comments-login-acceptance.md`). Web Lead unfroze PR2 for a pre-round-1 scope rev. New §0p: D-1 to D-5 (relayed by MetFix Web Lead from Ethan via MetFix CEO, 2026-10-20 9:27 AM PT), new threat rows A-T20 to A-T26, BSI dependencies (§0p.7, read-only at BSI `d3234a50`), and a size impact. E-R9 reworded, not deleted. §0n item 1 struck. Allowed-files +`worker/comments.ts`, +`worker/comments*.test.ts`. Counts: gate 226→245, box 11→12, post-deploy 11→14, mutations 211→230.
- **1.5.4 (2026-10-20).** Base 1.5.3 (`c6d71882…`). Wording only (CQ pin-check-10 items 3 and 4): §0r.5 says a repeat-delete 204 is handled like a 200 `{deleted:true}` and does not clear the cache; §0r.4 says the hidden-controls fallback turns on when BSI omits `can_moderate`, with no separate flag. No ID or count change.
- **1.4.25 (2026-10-19).** Backup: `.rev1.4.24.md` (a2b0a852…). Post-freeze change allowed by Web Lead's ruling (b) on CQ pin check 7 (`7952f3c4…`). New §0o: fixtures stored as `<name>.fixture` (md5s of stored bytes, unchanged), stripped in the temp copy before the md5 assert and scan; allowed-files lists the six exact `.fixture` paths; exclusion stays root-anchored `worker/__fixtures__/tk2-m7/`. New acceptance: on the PR head, `tsc --listFilesOnly` shows no `__fixtures__` and `check:worker` passes, run not reasoned. Box proof on a read-only main `9f7129d7` clone: `.fixture` gives 0 lines / rc 0, plain names give rc 2 (11 TS errors). TK2.x anchoring row plus M-TOK15 (unanchored) {TK2.x}; counts corrected to 211 mutations; tampered-fixture row recorded as M-TOK14's killer. `.gitattributes` out. D3 freeze now names 1.4.25.
- **1.4.24 (2026-10-19).** Backup: `.rev1.4.23.md` (f59f6ea5…). Post-freeze change allowed by Web Lead's 2026-10-19 follow-up ruling. New §0n: TK2.m7 fixtures committed byte-exact under `worker/__fixtures__/tk2-m7/` (main `9f7129d7` deploy-pages.yml plus the minimum TK2-scanned #10 `2fdecd34` files), md5s asserted by the test, no dependency on `2fdecd34`; path added to allowed-files and, as an exact prefix, to TK2's exclusions; new TK2.x (a plant outside the directory still fails). Merged main = the main SHA in Web Lead's Project handoff (no hardcoded SHA); M-RS2 and the merged-main clean controls are R-A evidence for that SHA only. Stale `.map` wording struck in §0e, §0f, §0g F4 and §0l (ii). TK2 file set and cast forms deferred to a separate follow-up PR. Expected 226 gate-ids / 207 mutations. D3 freeze now names 1.4.24.
- **1.4.23 (2026-10-19).** Backup: `.rev1.4.22.md` (29454ba5…). New §0m: TK2.m7 expected hit is `deploy-pages.yml:40` (QA box-verified); #7 and #10 conflict in `vite.config.ts`, so there is no pre-merge fixture, and TK2.m and the TK1 clean control run only on real merged main, whose SHA is R-A evidence; TK1 scans `dist` as shipped, with no sourcemaps forced on (a `.map` that appears is scanned) and the maps-included claim dropped. No ID or count change. D3 freeze now names 1.4.23.
- **1.4.22 (2026-10-19).** Backup: `.rev1.4.21.md` (397df967…). New §0l from CQ pin check 5 (`2f5f10b1…`), QA list rev 1.10 and CQ's scanner. B1: TK2.m fixture = #7 head `01f4a8ff` merged with #10 head `2fdecd34`, rebuilt from real merged main once both merge (merged bytes win), source SHAs and md5 table recorded, no exception for `deploy-pages.yml:42` (a true positive #7 deletes); new TK2.m7 (fixture without #7 → exactly one hit at deploy-pages.yml:42). B2: TK1 split into (i) guard proof, new TK1.g (exact #10 guard message), and (ii) canary scan under non-guarded names with `N` unset; M-TOK1 reworked to a define-based exposure {TK1, TK2}; M-RS2 {TK1} via the (ii) vacuity row; test-file-import row via `VITE_SANITY_TOKEN` {TK1}; new M-TOK11 (guard removed) {TK1.g}; all reasoned, verify in round 1. N1 cast forms and N2 extra dirs are review items (N2 a candidate follow-up for Web Lead); no TK2 scope change. Expected 225 gate-ids / 207 mutations. D3 freeze now names 1.4.22.
- **1.4.21 (2026-10-19).** Backup: `.rev1.4.20.md` (9c66a10c…). New §0k, TK2 only: multiline whole-file matching, so whitespace and newlines around `.`/`?.`/`[` are covered; optional-chaining env reads; destructuring from `import.meta.env`/`process.env`; static alias `const x = <env>; x.N` (anything else is a review item); bracket `secrets[...]`/`vars[...]`; YAML flow mappings confirmed under (b); same-line comments don't suppress a hit; one SCAN FAIL per line. Planted positive for each new form. Clean control re-checked against #10 head `2fdecd34`: zero hits, so no vite.config.ts exception. New M-TOK7–M-TOK10, each red {TK2}. Expected 223 gate-ids / 206 mutations. D3 freeze now names 1.4.21.
- **1.4.20 (2026-10-19).** Backup: `.rev1.4.19.md` (8bcca476…). New §0j, TK2 only: §0i's literal-anywhere rule withdrawn (red on main-with-#10); CQ withdrew the worker/ test-file point, so no exception. Real-use matching restored and extended: env reads, `N:` / `N=` assignments (not `==`), workflow `secrets.`/`vars.`, Vite `define` keys and values, `envPrefix` exposing the token (any prefix of N except exactly `VITE_`, or non-literal); each form has a planted positive in a temp tree, plus negatives. TK2.m clean control on a fixture tree of main `9f7129d7` + #10 head `2fdecd34` bytes. Runtime-built names stay a review item. New M-TOK5 (define), M-TOK6 (envPrefix); M-TOK3 kept. D3 freeze now names 1.4.20.
- **1.4.19 (2026-10-19).** Backup: `.rev1.4.18.md` (0be07ed9…). New §0i, TK2 only: real-use pattern matching dropped; TK2 fails on any case-sensitive plain-substring occurrence of the token name in any tracked file incl. tests, with one exception: #10's merged `ci.yml` grep line, matched byte-for-byte as the whole line in that file only. Scanner builds the name at runtime (no literal in the test file); plant fixtures in temp dirs; clean control on a fixture tree. Runtime-built names (concatenation, template literal, computed key) are a review item. TK2.m and M-TOK3 kept. D3 freeze now names 1.4.19. (Same rev, after a steering request:) exception-1 line recorded as read at #10 head `2fdecd34`; the requested worker/ test-file exception was not added because #10 changes no worker/ file; open conflict recorded: #10's client tests, `vite.config.ts`, its docs pair and PR2's own docs pair all contain the literal, so a Web Lead ruling is needed.
- **1.4.18 (2026-10-19).** Backup: `.rev1.4.17.md` (c2973226…) and `backups/…pre-ruling-a.bak`. New §0h: Web Lead ruling option (a) (2026-10-19): RS-A1 removed from `npm test` and moved to the gate's pull_request-only scope step (gate 1.0.12 A9.12); S-G2 converted to an `allowed-files` block (§0b.3); globalSetup and history machinery removed from PR2 (now gate A9.13 with CQ pin check 4 B1/B3/N1–N3 fixes). Retired A1.2, RS-A1s1, RS-A1s1-stale, RS-A1s2, RS-A1s3, M-RS1, M-RS3–M-RS6 (re-homed as gate SC1/SC2/SC7, HM1, HM1-stale, HM2, HM3, GM68, GM74–GM77; M-RS6 erratum retired with it). TK2 fix (CQ B4): real-use patterns only, test files excluded; new TK2.m (clean on #10's merged ci.yml) + M-TOK3. TK1 hygiene (CQ N4): new TK1.r + M-TOK4. D3 freeze now names 1.4.18. Credit: Web Lead; CQ pin check 4.

- **1.4.17 (2026-10-19).** Backup: `.rev1.4.16.md` (09660371…). New §0g: Web Lead ruling (2026-10-19) supersedes the skip-if-present rule: globalSetup ls-remote freshness check every run, depth-limited fetch only on mismatch, hard `SCAN SETUP FAIL` on ls-remote failure / still-mismatched / no merge-base, no credential or unredacted stderr output. RS-A1s1 asserts local ref = ls-remote SHA, new stale/planted-ref case RS-A1s1-stale; M-RS5 (always fetch) and M-RS6 (skip without freshness check, owns planted-ref case), each red {RS-A1s1}. Per-test zero-files guard for every scan test; M-RS2 exact {TK1}. M-KVF1 red set {AU5.k, AU5.4, AU5.6}. TK1 message `SCAN FAIL: TK1 <file>:<line>` (1-based line in emitted file; source maps and minified code), replacing TOKEN LEAK (inline in §0f, A-TOK1). AU6.2 dropped from M22's red set. D3 freeze now names 1.4.17. Credit: Web Lead; QA list PR2 1.6.
- **1.4.16 (2026-10-19).** Backup: `.rev1.4.15.md` (81e7ccfe…). Web Lead ruling (2026-10-19) on main's history for RS-A1 replaces the open question: once-only vitest `globalSetup`, depth-limited `git fetch origin main` with checkout-persisted credentials (repo not assumed public; no token or credentialed URL printed; git stderr redacted), skipped if `origin/main` present, failed fetch / no merge-base → hard `SCAN SETUP FAIL`, no-remote sabotage proof, R-A fallback on top. Suggested QA IDs RS-A1s1–RS-A1s3, mutations M-RS3 (skip on fetch failure, red {RS-A1s2}) and M-RS4 (prints remote URL, red {RS-A1s3}). D3 freeze now names 1.4.16. Credit: Web Lead.
- **1.4.15 (2026-10-19).** Backup: `.rev1.4.14.md` (d1cee4c6…). New §0f from Web Lead rulings R-A/R-B (2026-10-19): R-A gate PR merges first + PR2 brings in main so CI runs CK-P1 on the real head, fallback QA re-run on exact merge-candidate SHA with Web Lead sign-off, A-PIN1 evidence SHA-bound, any push voids; R-B PR2 never edits ci.yml, all CI grep/step rules become vitest repo-scan tests in `worker/repo-scan.test.ts` with sabotage proof: TK1 (A-TOK1, builds in-test), TK2 (A-TOK1b), RS-C5, RS-AU22 (incl. S-G19), RS-T6, RS-A1 (S-G2 diff); CK-CI1 re-homed. Inline: A-TOK1, CK-CI1, S-G2, S-G19, C5, AU22, T1a, T6, §8a. Suggested M-RS1/M-RS2. D3 freeze now names 1.4.15. Credit: Web Lead, QA.
- **1.4.14 (2026-10-19).** Backup: `.rev1.4.13.md` (2f347455…). New §0e from Web Lead's ruling (2026-10-19, condition 1 on the three calls): E1 token fix from #10 arrives when PR2 brings in main; Web Lead said "rebases", merging main satisfies it; PR0 merge preference and Ethan-own-OK force-push rule kept. E2 no `VITE_SANITY_API_READ_TOKEN` in source, env files, vite config or workflows. New A-TOK1/A-TOK1b (dist/ grep for name + build-env canary; tracked-file grep), QA TK1/TK2, mutations M-TOK1/M-TOK2. D3 freeze note kept (now names 1.4.14). Credit: Web Lead.
- **1.4.13 (2026-10-19).** Backup: `.rev1.4.12.md` (e7f03aea…). CQ pin check 3 (`c2d8bc8c…`) folded in as §0d with Web Lead rulings D1–D3 (2026-10-19): B1 mutual-pin bullet removed; B2 D1 (no QA rev/md5 outside history, handoff authoritative); D2 shared CK-P1, ci.yml removed from S-G2 allowlist, A-PIN1 pre-r1 local check; D3 freeze note; B3 S-G16 → `SESSION` DO is source of truth, AU5.k + M-KVF1; N1 R5 KV-then-DO (route table, AU21, Q5 note); N2 A-T18 AAD = DO instance name; N3 CKT1.1 `SESSION`/`OAUTH_STATE`; N4 E-R9 in §9; N5 PR0 prefer merge, force-push needs Ethan's own OK. Credit: CQ, Web Lead.
- **1.4.12 (2026-10-19).** Backup: `.rev1.4.11.md` (14c62ab0…). One-way pin (option (b), ruled by Web Lead 2026-10-19; CQ P2): §8a references QA by rev only, no QA md5; CK-P1 checks only QA's spec-md5 pin (`PIN MISMATCH: <file>`) plus header gate-count compare; QA md5 goes in Web Lead's handoff. M-TTL1 red set {AU5.3, AU5.4, AU5.z, AU7.8}; M-TTL2 red set {AU5.4, AU5.z}. G10: DO down on a `/me` miss → exactly 503 `{"error":"unavailable"}`, `Retry-After: 300`, 0 BSI calls, 0 KV puts (S-G18), not `signed_in:false`; client shows signed-out UI without clearing the cookie. Nothing else changed.

- **1.4.11 (2026-10-19).** Backup: `.rev1.4.10.md` (3d763a7b…). Closes QA G9/Q5 gap (a thrown KV delete left the `/me` entry with a 30-day TTL): new §0c G10, every KV `/me` write uses `expirationTtl: 60`; `SESSION` DO remains the 30d idle / 90d source of truth; a `/me` miss rebuilds from the DO and rewrites with TTL 60. 30-day KV TTL text replaced in §0c G9, §5.2 server store and lifetime, AU5, AU7.8. New AU5.z, M-TTL1 (TTL 30 d → AU5.z + AU7.8(iv) red), M-TTL2. Accepted QA red sets recorded: M-DO1/M-DO3 = {AU5.y, AU5.3}; M-DO2 = {AU5.y, AU7.8, AU8.1, AU8.2, AU8.4}; M-Q5b = {AU7.8, AU8.4}. §8a: QA re-cut against 1.4.11 pending.

- **1.4.10 (2026-10-19).** Backup: `.rev1.4.9.md` (c81f5bfa…). Ruling on QA Q5: the 60 s display-only residual (AU8.1) covers a failed or late KV `/me` delete; no `SESSION` DO check on `/me`. §0c G9 reworded (signed out when the KV delete succeeds; else ≤60 s display-only, writes and refresh fail closed at once via `SESSION`); §5.2 S6 matched; AU7.8 asserts signed out on delete success plus a delete-failure case (≤60 s signed-in display, writes/refresh fail closed at once, no token data in logs). §8a: QA re-cut against 1.4.10 pending.

- **1.4.9 (2026-10-19).** Backup: `.rev1.4.8.md` (2d842c76…). From CQ (MetFix Web Code Quality, 2026-10-19): `SESSION` DO deletion alarm at `min(last_seen+30d, created+90d)`, storage cleared at expiry, 90d cap or logout, whichever first (§5.2; new AU5.y, M-DO1–3); stale tokens-in-KV text fixed (R7 AAD/ENC-T3, S-G16, §5.2 S4/S6, P1, session-store row, AU5, AU8, A-T5, A-T17); CK-P1 pin-compare CI check; §8a drops the 1.1 pin, QA re-cut against 1.4.9 pending.

- **1.4.8 (2026-10-19).** Backup: `.rev1.4.7.md` (5dc91956…). Web Lead rulings 2026-10-19: §0c G8 (S-G24) `gate-ids` block CI IDs only, box and PD IDs in separately tagged blocks with manual sign-off (matches PR3 CQ7, gate 1.0.6 A3.4); G6 90-day cap inclusive (age >= 90d expires; boundaries 89d, 90d−1s, 90d expired, 91d); G9 logout under `SESSION` outage → 204 + cookie cleared, revocation best-effort and logged without token data, next `/me` fails closed (§5.2 S6, AU8 updated); G2/R9 provenance in header, §0c G2 and Q-WL-1 now reads "relayed via MetFix CEO (… Web Lead 2026-10-15; Web Lead restated 2026-10-19). Not yet confirmed by Ethan directly." §8a: QA re-cut.

- **1.4.7 (2026-10-19).** Backup: `.rev1.4.6.md` (d71149bb…). R7 under the `SESSION` DO marked confirmed by Web Lead (AAD = DO instance name; ciphertext only in DO storage; KV holds only the token-free `/me` cache). New AU5.x (recording KV fake over login, refresh, Google callback: no token values, no `v1.` ciphertext, no token/refresh/access fields) and mutation M-KV1 (token pair written to KV; red set exactly {AU5.x}). §8a: QA re-cut targets 1.4.7.

- **1.4.6 (2026-10-19).** Backup: `.rev1.4.5.md` (36f4a1b2…). New §0c from CQ's pin check (9d315ff3…): G1 one `SESSION` DO per session for refresh (KV = `/me` read cache only), AU7.6 stale-KV + rotation test, S-G18 and R19 Env types cover `SESSION`, §0a.X.2 resolved; G2 PR-shape text in header and Q-WL-1; G3 A1.2 docs path; G4 #3 independent; G5 AU16 body; G6 90-day cap in §5.2; G7 A-T7 20/60 s. Stale text fixed: §0 historical, L2, L6, T14, §5.2 state record and S4, A-T3, A-T14, §5.4 CSP, CK-W4. New pre-round-1 item PR0 (Web Lead ordered): retarget #2's base from `cursor/the-daily-fix-8836` to main, rebase or merge main in, preserve Ethan's commits incl. `3a721dcc`, first deliverable the file list against main. §8a: QA re-cuts against 1.4.6; mutual md5 pin.

- **1.4.5 (2026-10-19).** Backup: `.rev1.4.4.md` (21ea4433…). New §0b.7 for QA list rev 1.1: S-G20 (AU10.8 on the real `OAUTH_STATE` DO under Miniflare/`unstable_dev`), S-G21 (item 7 covers network errors and thrown fetches), S-G22 (S-G8 ↔ item 7 cross-cites), failed refetch rule, leaderboard per-user limit before the day-data read and BSI, accepted residuals recorded (Q-BSI-1 names with placeholder fixture, AU16.2 timing box-only, R8c saturation until BSI-C1). §8a pins QA rev 1.1 (96c9c45f…, 232 IDs); no re-cut needed unless QA objects.

- **1.4.4 (2026-10-19).** Backup: `.rev1.4.3.md` (e65dc405…). New §0b.6: all eight 1.4.3 judgment calls confirmed by Web Lead. Call 1: `Member` default kept; Q-BSI-1 marked top-priority BSI question (§9). Call 7: client never auto-retries a comment POST after 503 or malformed success; it refetches once instead; new acceptance test CT-P1 (POST count exactly 1, then 1 refetch GET) and mutation M-P1 (adds a retry; must turn CT-P1 red). QA's list must also cover CT-P1/M-P1 in its 1.4.4 re-cut. Nothing else changed.

- **1.4.3 (2026-10-19).** Backup: `.rev1.4.2.md` (ccd6a333…). New §0b resolves QA list rev 1.0 (2498c37c): §5.7 verdicts (N4, N5, N7, N9, N10, OAuth state → DO), R25 order R8a → R8b → reCAPTCHA → R8c → BSI (confirmed by Web Lead), gaps S-G2/3/5/6/8/9/12/16/17/18/19, QA Q1–Q24. Edited to match: header, R8 order line, R20, §8a (QA list pinned, re-cut required). New BSI asks Q-BSI-8/9/10. Where §0b contradicts §1–§9 text, §0b wins.

- **1.4.2 (2026-10-19).** Backup: `.rev1.4.1.md` (9d7f1843…). Web Lead: R6, R12 (callback 400), R15, R16, R21 and W6 marked confirmed (flagged-default wording removed from R15/R16). R8 fixed: three `LOGIN_THROTTLE` DO layers, R8a per `sha256(lower(trim(identifier)))`, R8b per `sha256(IP)` 20/60 s, R8c one global DO instance `login:global` at 25/60 s site-wide (under BSI's 30/60 s per key); each 429 + Retry-After, no server sleep. Updated to match: R21, CK-W7, §0a.3 not-tooling line, §0a.X item 3, §5.4 login throttling, AU17, T9, A-T10, §8 outline. Nothing else changed.

- **1.4.1 (2026-10-19).** Backup: `.rev1.4.md` (b898f327…). (a) W5-R (Web Lead): all #3-on-#2 stacking dropped (header line, A2, A3); #2 and #3 both target main and are independent; whichever merges second rebases onto main; CQ reviews that rebase. (b) Re-anchored to #2 head `3a721dcc` (Ethan's 7:16 PM PT push). (c) New §0a: CQ pre-round-1 notes (`1c7fc3e5…`, CQ wording) R1–R24 and checks CK-*, as ruled by Web Lead; conflicts listed in §0a.X. Edited to match: header, F3 (rewritten), §3 header, W1, W6, W9, L6, §5.1 (refresh route dropped, /me, callback), §5.2 (state `flow`, rotation, refresh), P2, S-RL/O6, error table, P7, AU5, AU6, AU12, AU15, AU16, AU17, AU21, AU22, A-T1, A-T3, A-T6, A-T10, A-T12, A-T18, §7 (rewritten), WT4, WT6, WT12, §8a. R9: one PR per Web Lead's relayed ruling, pending Ethan's direct confirmation to CQ. Spec defaults flagged: R6(a) /me doesn't return CSRF, R6(b) /google/start mints `__Host-mfx_pre`, R15 90-day absolute cap, R16 20/60 s username bucket, R8 global cap 25/60 s, R21 503 → 300.

- **1.4 (2026-10-19).** Backup: `.rev1.3.1.md` (194c1bf1…). #2 now delivers real login and account creation (email/password + Google). New §5 (5.0–5.7): Worker auth routes, KV session model (opaque `__Host-mfx_sid`, encrypted server-side tokens, rotation, 30-day rolling with silent refresh per Web Lead's N2 ruling), Google OAuth+PKCE with ID-token checks, bridge followed server-side only, CSRF/state/nonce, S-RL limits, headers, error mapping, logout/revoke. New §5a AU1–AU24, §5b exact BSI contracts BSI-C1–C9 (D-LB not needed under N8 default), auth threats A-T1–A-T19, §8a QA list pending, §5.6 Ethan admin steps with pinned URIs (`https://metfix.org/api/auth/callback`, `https://metfix.org/api/auth/google/callback`; preview login unsupported), §5.7 Spec defaults (N4, N5, N7, N9, N10). **OI-1 CLOSED:** `POST /bsi/v1/auth/login` exists at `includes/app-password-auth-rest.php:169-179` (WP OAuth password grant); refresh at `metfix-proxy-apis.php:197-207`; login is path A only, authorize+PKCE only for Google/bridge. E-A3 removed (admin step). Ethan questions: E-A1, E-A2, N11, N6, N8. `/api/auth/session` renamed `/api/auth/me`; P1 changed from token-in-cookie to opaque ID.

- **1.3.1 (2026-10-19).** Backup: `.rev1.3.md` (a32061df…). One consolidated PR (split withdrawn): login required to comment, writes merge-gating, flag removed, W2 allows POST, BSI sign-in/posting PR dependency (Q-BSI-7). P8 + WT10: rate-limit binding keyed per user+IP, in-Worker counter fallback only. W8 + WT9 + T10: skip soft-deleted rows, no placeholder (Q-BSI-2b). A3: the Project rebases, CQ reviews. metfix-bff retirement is post-merge with Ethan's approval and key revoke. T11, T12 added; Q-WL-1–5 resolved.
  - Same rev, later edit: leaderboards in scope (§4 L1–L7, F10 key-only read blocked, F11 no public name; WT11–WT12; T13–T14). P9 sign-in routes and WT13. New §5b BSI dependency (D-AUTH, D-POST, D-LB, D-NAME, D-AUTHZ, D-RL). G5–G7 retired; replaced by new open questions N1–N12, not recovered text.

- **1.3 (2026-10-19), REBUILD.** 1.2.3 (md5 21046387…) was lost in the rollback and not found on the box or in #2. This file was rebuilt from #2's code at 3470e50c, main 9f7129d7 worker/, BSI daily-fix-apis.php at d3234a5, and the 1.2.x locked items relayed from memory. Its md5 differs from 1.2.3.
  - New: same-origin `/api/daily-fix/comments` Worker route (W1–W9). Client uses relative URLs only (C1–C5). A CI grep checks for BFF origins.
  - Findings F1–F9. Notable: there is no BFF comments handler to port (F2), the branch has no login code (F5), and the code contradicts B4 (F6).
  - Threat list T1–T9, tests that flip (§7), test outline (§8), and open questions (§9).
