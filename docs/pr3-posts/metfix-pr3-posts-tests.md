# QA test list: metfixhome PR #3, posts (list + detail via the Worker), rev 1.13 (pre-round-1)

- Author: MetFix Web QA. Box-only file; no repo changes.
- **Spec pin (one-way, §0g D1): acceptance rev 1.1.14, md5 `f481ede4d9a4e92f83b779a3847e3d9d`** (verified on the box 2026-10-21 ~8:35 AM PT, file `metfix-pr3-posts-acceptance.rev1.1.14.md`). The spec names no QA rev or md5; Web Lead's handoff names this list's rev and md5. **`gate-ids` count: 102** (checked by CK-P1). **Mutation catalogue 82 (reference)**; **targeted 10 (advisory)**; **gating mutations 0** (in no block). `box-ids` 4, `post-deploy-ids` 7.
- Rev 1.13, 2026-10-21 ~8:45 AM PT (QA). Pin unchanged (acceptance 1.1.14 `f481ede4…`). Rev 1.12 (`c42735d4e23c1a8bbe0ae72085de518f`) kept at `metfix-pr3-posts-tests.r1.12.md`. Applies Web Lead's ruling (targeted ≈10) and CQ notes `metfix-pr3-cq-notes-1.1.14.md` (`657b467e…`). Targeted 10 = CQ's 7 (PM8, PM12, PM22, PM35, PM41, CQ-M1, CQ-M2) + QA's PM23, PM16, PM32; the other 13 of 1.12's 18 are catalogue-only. New gate rows PC20 (exact fetch count per page/id change, abort on cleanup, no stale render; kills CQ-M1) and PW46 (exactly one upstream call across HTML head + API; kills CQ-M2). New catalogue rows CQ-M1, CQ-M2; PM61 (same patch as CQ-M1) red set gains PC20. No assertion weakened or removed. Counts: gate 102, box 4, post-deploy 7, catalogue 82, targeted 10 (advisory), gating 0.
- Rev 1.12, 2026-10-21 ~8:36 AM PT (QA). Re-pin to acceptance 1.1.14 (`f481ede4…`; diffed against 1.1.13 `c2197b5d…`: title rev, new §0l (real posts, no stub, relayed decision; requirement→item map; BSI re-verified read-only at `d2d78c8d`, posts code identical to `d3234a50`; open blockers Q-BSI-1/-2 restated), changelog line; no A-item, T-row or gate ID added, retired or renumbered). Applies Spec's request `qa-request-pr3-real-posts.md` (`fb3659e4…`). Stub check vs A25 FLIP/DELETE: PC1 already flipped (strengthened: mock payload must be A6-shaped, the rewritten `stubPostsPayloadFetch`; the old stub's "posts unavailable" copy must be absent); PC2 already deleted-form; PC3 already flipped (`/posts/1`); PC4 already in STAYS form (`/posts/some-slug` 404, no fetch). No row accepts stub content. Nothing weakened. Rev 1.11 (`3cc216cf2b44be4f8ac0eafb27c3f5f4`) kept at `metfix-pr3-posts-tests.r1.11.md`. Targeted stays QA's 18 (spec §0l says 8; superset incl. 7 of spec's 8, PM20 catalogue-only; flagged to Web Lead in 1.11). Counts: gate 100, box 4, post-deploy 7, catalogue 80, targeted 18 (advisory), gating 0.
- Rev 1.11, 2026-10-21 ~7:22 AM PT (QA). Re-pin to acceptance 1.1.13 (`c2197b5d…`; diffed against 1.1.12 `e5e386e3…`: new §0k (mutation cut-back), §5's "with a mutation per security rule" reworded, changelog line; no A-item, T-row, gate ID or non-mutation test changed). Rev 1.10 (`078c1e5b2e516eff0c5cdc354a52f76b`) kept at `metfix-pr3-posts-tests.r1.10.md`. Applies Spec's request `qa-request-mutation-cutback.md` (`93d98685…`). PM rows dropped in 1.10 restored unchanged as a reference catalogue with their drop reason as a status note; none deleted or renumbered. Targeted (advisory) = QA's 18 from 1.10. Spec's suggested 8: in QA's set PM12, PM22, PM32, PM35, PM41, PM8, PM9; not in it PM20. QA's set is larger than §0k's 8; flagged to Web Lead. Mutation results are **not** a per-round or merge gate; a surviving targeted mutant is a finding reported to MetFix Web Lead. No mutation per security rule is required. Counts: gate 100, box 4, post-deploy 7 (unchanged); catalogue 80 (spec 80); targeted 18 (spec 8); gating 0.
- Rev 1.10, 2026-10-21 ~7:20 AM PT (QA). Pin unchanged (acceptance 1.1.12 `e5e386e3…`). Rev 1.9 (`0cfe32f7bdf92a16b87fc1bcbedc300b`) kept at `metfix-pr3-posts-tests.r1.9.md`. Counts: gate 100, box 4, post-deploy 7 (unchanged), mutations 18. **Ethan's ruling, in Ethan's chat with MetFix Web QA Tests, 2026-10-21 (relayed to this edit by that chat): metfix.org mutation lists become small targeted sets.** Plant bugs only where a test's strength is really in doubt, aimed at changed or high-risk code; drop any mutant that doesn't model a realistic mistake; no full runs; mutation runs don't block every round. Gates unchanged: no gate, box or post-deploy row was changed or removed. Kept **18** mutants, each with a one-line reason in the new "Why kept" column. **Dropped (62), by reason.** (a) Test, tooling or CI-scan sabotage, not a realistic product mistake: PM42, PM76, PM76b, PM78, PM83, PM65, PM63, PM59, PM64, PM62. (b) Variant of a kept mutant on the same code path: PM20, PM46, PM26, PM27, PM47, PM48, PM55, PM72, PM73, PM73b, PM74, PM75, PM18, PM29, PM6, PM67, PM68, PM30, PM34, PM36, PM50, PM5, PM58, PM57, PM51. (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test): PM1, PM2, PM3, PM7, PM10, PM11, PM13, PM15, PM17, PM24, PM37, PM38, PM39, PM40, PM43, PM44, PM45, PM49, PM52, PM53, PM54, PM56, PM60, PM61, PM66, PM69, PM70. Dropped IDs are retired, not reused. Mutations run each alone against the test files holding the red set (no full run) and do not block every round.
- Rev 1.9, 2026-10-19 ~9:05 PM PT. Applies §0j (1.1.12, Web Lead option (a)): RS4 scope and history moved to the gate scope step (gate 1.0.12 A9.12/A9.13, gate list rev 1.10). Retired with pointers: PX5→SC1/SC2/SC3, RS4s1→HM1, RS4s1-stale→HM1-stale, RS4s2→HM2, RS4s3→HM3; PM77→GM68, PM79→GM76, PM80→GM77, PM81→GM74, PM82→GM75. New CI ID PX1.r and PM83 {PX1.r}. Rev 1.8 (`344a930e…`) kept at `metfix-pr3-posts-tests.r1.8.md`. Nothing weakened (no-loss table in the gate list).
- Rev 1.8, 2026-10-19 ~8:50 PM PT. Applies §0i (1.1.11): F1 ls-remote freshness every run; RS4s1 re-worded; new CI ID RS4s1-stale (staleness rows moved there from RS4s1, unchanged in strength); RS4s2 adds ls-remote failure; per-test zero-files guards; PM81/PM82 re-verified. Rev 1.7 (`901e97a8…`) kept at `metfix-pr3-posts-tests.r1.7.md`. Nothing weakened.
- (Rev 1.7 history) 2026-10-19 ~8:45 PM PT. Pinned 1.1.10 `c8d1566353bb145874f8fd4091c139aa`.
- (Rev 1.6 history) 2026-10-19 ~8:30 PM PT. Pinned 1.1.8 `4d65f2375e317b698f0953f8d6b552e3`.
- (Rev 1.5 history) Pinned acceptance rev 1.1.7, md5 `dd9464c52968791e17802126615a5166`; `gate-ids` 101.
- Rev 1.5, 2026-10-19 ~8:20 PM PT. Applies §0f: CK-P1 one-way + header gate-count compare (PM76 re-targeted), CK-N1 non-test scope (L1), PD7 page 1 and last page (N3a), PW23 total 11 row (S1), PW26 N4a rows, PM73/PM73b cited to §0f S2. Rev 1.4 (`1d1fd0f6…`) kept at `metfix-pr3-posts-tests.r1.4.md`. No assertion weakened.
- (Rev 1.4 history) Written against acceptance rev 1.1.6, md5 `cac3a4771a2380803eec47c4c385102a`. Applies §0e (CQ pin check): PW23 asserted against `PAGE_SIZE`; PW10/PW21/PW26 fixtures `meta.per_page: 10`; PW26 N4 row; new CI IDs PW10b, CK-P1, CK-N1; new PM73–PM75; new PD7; three tagged blocks per gate acceptance 1.0.6 A3.4/A3.4.1 (`gate-ids` CI only, `box-ids`, `post-deploy-ids`; PM IDs in no block). PM73's red set and PM2/PM3's red sets corrected to the exact sets (see §PM note). Rev 1.3 (`2beeb657…`) kept at `metfix-pr3-posts-tests.r1.3.md`. No assertion weakened.
- (Rev 1.3 history) Written against acceptance rev 1.1.5, md5 `2a346404c7bfe3bf2300b7442f61aa55`, applying §0d: `has_more` computed by the Worker from `meta.total` (G6), so PW21, PW23 and PW26 are re-cut, PM18 is re-targeted and PM71/PM72 are added. G9 stays fail-closed and images stay exactly `brokenscience.org` (unchanged from 1.2). PW10, PC5 and PC9 unchanged. Rev 1.2 (`270487b7…`, against 1.1.3) kept at `metfix-pr3-posts-tests.r1.2.md`. No assertion or mutation weakened.
- (Rev 1.2 history) Against acceptance 1.1.3 `36c378b4…`: CQ1-CQ24 applied; gate-ids block CI-only (CQ7).
- CQ22: §0b/§0c decisions are Spec defaults or Web Lead rulings, not Ethan's approvals; nothing in this list cites them as Ethan's. PD1 still needs Ethan's own words.
- #3 head read (read-only): `96c8eb88c6f6d29ed5743d8f7acc7c94596c4fab`; mount test names match spec A25 (`page.mount.test.tsx` L167, L196, L211). The PR must be retargeted onto main (D1) before any item can run.
- Gate format (gate acceptance 1.0.6 A3.4/A3.4.1/A3.4.2, CQ7): three blocks at the end. `gate-ids` holds **[CI] IDs only** (a non-CI ID there is `L1 FAIL: non-CI ID in gate block: <ID>`); `box-ids` holds the [BOX] IDs and `post-deploy-ids` the [POST] IDs, each closed by QA evidence (md5) plus Web Lead sign-off. PM mutations are in **no** block; they go into the sabotage manifest (`mutations[]` with `red[]` = the exact red sets below). Each block: exactly three backticks at column 0, its tag, one A3.2-valid ID per line, no duplicates within or across blocks.
- Rules: never weaken an assertion. A pass is test sign-off only; merge needs Ethan's go. No truthy / "renders ok" passes: every assertion names exact values, exact headers, exact call counts, and for denials asserts that **nothing** was fetched, stored, logged or rendered.

## Conventions
- Tags: **[CI]** runs in `npm test` / `npm run test:workers` / a ci.yml step; **[BOX]** QA box evidence (scratch branch, mutations, local `wrangler dev`); **[POST]** post-deploy, never a merge gate.
- Fixtures: secrets `BSI_POSTS_API_KEY=test-posts-key`, `DAILY_FIX_API_KEY=test-secret-key` (distinct, A22/A23). An upstream fetch mock records every call (URL string, method, every header, redirect, signal); a Cache API fake records every `match`/`put`/`delete` with key URL and body bytes; `console.*` is spied in every Worker test and must record zero calls containing the key, `X-API-Key`, any upstream body bytes, or any locked-fixture text.
- "Nothing on denial" (ND) means, together: upstream mock call count 0 (where the item says no upstream call), Cache `put` count 0, no key/upstream text in body/headers/console.
- Locked fixture `LOCK` = an item whose `content`, `excerpt`, `title` and `video` carry unique sentinels (`LOCKED-BODY-7f3`, `LOCKED-EXC-7f3`, `LOCKED-VID-7f3`); D8 tests assert the sentinels appear in no response body, header, cache `put` body or console call.
- Mutation proofs [BOX] (targeted rows only, advisory, 1.11): QA applies each patch on a scratch branch, runs only the named files, and requires **exactly** the named red set (no fewer, no more), then reverts (git status before == after). These become the PR's `docs/<feature>/mutations/` patches when the gate exists.

## How QA verifies locally
- V0 `git worktree add /workspace/qa-pr3/wt <head>` from a clone; `npm ci --legacy-peer-deps`; `npm test`, `npm run build:cf && npm run test:workers`; record counts; `git worktree remove` after; the source clone's `git status --porcelain --ignored --untracked-files=all` is identical before and after.
- V1 Per item: run the named test file with `-t "<ID>"`, record rc and the matched assertion lines in §R1.
- V2 Mutations: one scratch branch per M-ID, patch, run named files, compare the red set to the listed one, `git checkout -- . && git clean -fd`, verify porcelain.

## Worker API [CI unless marked]
### Routing (A1, D3)
- PW1 `GET /api/posts` and `GET /api/posts/` → identical status/body/headers; both reach the posts handler (upstream URL as PW10).
- PW2 Bad paths and bad ids (A3, CQ2): `/api/posts/1/comments`, `/api/posts/abc`, `/api/posts/0`, `/api/posts/2147483648`, `/api/posts/01`, `/api/posts/1/`, `/api/posts//1`, `/api/postsx`, `/api/posts/1.json` → the **catch-all 404 byte for byte**: status, the full header map (no `Cache-Control`) and body bytes exactly equal to the response for `/api/zzz` from the same Worker build; upstream calls 0, cache puts 0.
- PW3 POST, PUT, PATCH, DELETE, OPTIONS on `/api/posts` and `/api/posts/1` → 405, `Allow: GET, HEAD` exactly; upstream 0; puts 0; body never contains upstream text.
- PW4 HEAD `/api/posts` and `/api/posts/1`, cold and warm cache → same status and headers as GET (header-map equal), body length 0. On a cold cache HEAD makes exactly one upstream fetch and one cache put on a cacheable 200 (G8); a following GET is a hit (upstream count stays 1). HEAD on a 400/404/503 path → same status/headers as GET, no body, no put.
- PW5 Daily Fix routes unchanged: `/api/daily-fix`, `/api/daily-fix/archive` responses byte-equal to main's for the same mocks (regression; dispatch order).
### List params (A2, D11)
- PW6 Table, each row its own case: absent → page 1; `1` → offset 0; `2` → offset 12; `50` → offset 588 (exact upstream URL, PW10).
- PW7 Bad page table, checked on the **raw** query string (Q1) → **400**, body exactly `{"error":"bad_page"}`, `Cache-Control: no-store`, upstream 0, puts 0: `0`, `-1`, `1.5`, `abc`, `51`, `999`, `` (empty), `01`, `+1`, `%31`, `%20 1`, ` 1`, `1 `, `1e1`, `0x1`, `2147483648`, `page=1&page=2`, `page` with no `=`, `page[]=1` (CQ3).
- PW8 Extra params ignored and never forwarded: `?page=2&limit=100&preview=false&per_page=100&offset=5&_fields=content&search=x&context=edit` → upstream URL byte-equal to the page-2 URL in PW10.
- PW9 Page-name prefix rule (Q2 as amended by CQ3/§0c.X1): any param whose name starts case-insensitively with `page` and isn't exactly `page` → 400 `bad_page`, no-store, upstream 0, puts 0, each alone and together with a valid `page=2`: `Page`, `PAGE`, `pAgE`, `pageX`, `page_`, `pages`, `page[]`, `page[0]`, `page.x`, `PAGEs`. Names that only contain `page` later (`xpage`, `homepage`, `_page`) are unrelated → ignored (PW8 URL).
### Upstream request (A4, D2, A5)
- PW10 Exact URL deep-equal, string compare, with upstream fixtures carrying BSI's real `meta.per_page: 10` (1.1.6 N1): page N → `https://brokenscience.org/wp-json/bsi/v1/posts?limit=12&offset=<(N-1)*12>&preview=true` (the test asserts the literal string `limit=12`, and separately that `12 === PAGE_SIZE` imported from `shared/posts/`, so a changed constant also fails here) (param order fixed as written; no `per_page`, no trailing `&`). Detail → `https://brokenscience.org/wp-json/bsi/v1/posts/<id>` with no query string.
- PW10b (1.1.6 N1) `per_page` is never taken from upstream: for page 1, 2 and 50, with upstream `meta.per_page` set to `10`, `100` and missing (each its own case), the response body's `per_page` is exactly `PAGE_SIZE` (12), the upstream URL is byte-equal to PW10's for that page (`limit=12`, offset `(N-1)*12`), and the body key set is exactly `{posts,page,per_page,has_more}`. Control row: `meta.per_page: 12` gives the identical body and URL (proves the cases differ only in the fixture).
- PW11 Exact header set: the `Headers` object has exactly 3 entries, `accept: application/json`, `x-api-key: test-posts-key`, `user-agent: metfixhome-worker/1.0`. Incoming request carries `Authorization: Bearer abc`, `Cookie: __Host-mfx_sid=s; wordpress_logged_in_x=y`, `X-WP-Nonce`, `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `True-Client-IP`, `Forwarded`, `Referer`, `Origin`, `X-API-Key: attacker` → none appears upstream; `x-api-key` is still exactly the posts dummy.
- PW12 `method: "GET"`, `redirect: "manual"`; `AbortSignal.timeout` is called exactly once per upstream fetch with `3000` (spy, CQ15), and that signal is the one passed to fetch.
- PW13 `assertBsiHost` runs on every posts upstream URL (spy called once per fetch with the exact URL). The constant-host mutation (`evil.example`) is a scratch-branch mutation only (PM65), never a test hook (CQ15, PX9).
- PW14 No key (A5, Q3): `BSI_POSTS_API_KEY` undefined, `""`, `"   "`, `"\t\n"` — each with `DAILY_FIX_API_KEY=test-secret-key` set → 503 `{"error":"unavailable"}`, `Retry-After: 300`, `no-store`; upstream calls 0; never a request with `test-secret-key`. A key with surrounding spaces (`" test-posts-key "`) is sent **byte-exact, untrimmed** (Q3: never trimmed).
- PW15 Dual-secret isolation (A23): both dummies set; a posts call carries only `test-posts-key`; a Daily Fix call carries only `test-secret-key`; static: `rg -n "DAILY_FIX_API_KEY" worker/posts.ts shared/posts` → 0 lines and `rg -n "BSI_POSTS_API_KEY"` outside posts code (and `.dev.vars.example`, tests) → 0 lines.
- PW16 Key never in output, log redaction (G3a, CQ16): across every PW/PH case, no response body or header contains `test-posts-key`/`test-secret-key`; **all** console calls (any caller) contain no key, title, `LOCK` sentinel or upstream body bytes; console calls made **from posts handlers** (attributed via a spy installed around the posts module) are exactly a fixed string matching `^posts:[a-z_]+$` plus at most one number.
### Status mapping (A8)
- PW17 Upstream 404 `post_not_found` and 404 `rest_no_route` on detail → 404 body exactly `{"error":"not_found"}`, `Cache-Control: public, max-age=60`; puts 0.
- PW18 Matrix → 503 `{"error":"unavailable"}`, `Retry-After: 300`, `Cache-Control: no-store`, puts 0, upstream body/code/message absent from the response: 400 `rest_invalid_param`, 401 `forbidden`, 401 `unauthorized`, 403, 429 `rate_limited` (with and without `X-RateLimit-*`), 418, 500, 502, 503 (with BSI `Retry-After: 5` → still exactly `300`), 301 and 302 (Location `https://evil.example/`: no second fetch), timeout, fetch throw, 200 with invalid JSON, 200 with `text/html`, 200 with JSON `null`, `[]`, `"x"`.
- PW19 Upstream 404 on the **list** (Q4) → 503 `{"error":"unavailable"}`, `Retry-After: 300`, `no-store`, puts 0. (404 → 404 is detail-only, PW17.)
- PW20 `X-RateLimit-*`, `Set-Cookie`, `Server`, `X-Powered-By`, `Link` from upstream never appear in the response (all statuses).
### List mapping (A6, D7)
- PW21 Happy path exact deep-equal: 3 unlocked fixtures with `meta: {total: 3, per_page: 10, has_more: false, …}` → body exactly `{posts:[…3 mapped…], page:1, per_page:12, has_more:false}` with key order irrelevant but key **set** exact; each Post key set exactly `{id,title,excerpt,date,image,author,category}`. (`total: 3` keeps the fixture away from every PW23 boundary, so only PW23 owns `has_more`.)
- PW22 Never forwarded: fixtures carry `video`, `content`, `content_types`, `access_levels`, `content_access_display`, `comment_count`, `author.id`, `featured_image_srcset`, `permalink`, `meta.total`, `meta.count` with sentinels → none of the sentinels in the body.
- PW23 `has_more` computed by the Worker (§0d G6): `Number.isInteger(meta.total) && meta.total >= 0 && page*PAGE_SIZE < meta.total && page < 50` (1.1.6 N1); `meta.has_more` and `meta.per_page` are ignored. Every fixture carries `meta.per_page: 10`. Expected values are computed in the test from the imported `PAGE_SIZE` **and** pinned as literals (the table below assumes `PAGE_SIZE === 12`; the test asserts that first). Rows (each its own case, other fields valid): total 24 & page 1 → `true`; total 24 & page 2 → `false`; total 25 & page 2 → `true`; total 12 & page 1 → `false`; total 13 & page 1 → `true`; total 0 & page 1 → `false`; total 10000 & page 49 → `true`; total 10000 & page 50 → `false`; **`meta.has_more: true` with total 12 & page 1 → `false`** (BSI's flag ignored); `meta.has_more: false` with total 25 & page 1 → `true`; `meta.has_more` missing with total 25 & page 1 → `true`. **per_page discriminators (PM73):** total 24 & page 2 with `meta.per_page: 10` → `false` (10-based would say `true`); **total 11 & page 1 → `false`** (§0f S1: `1*12 < 11` is false; a page size of 10 would give `10 < 11` → true, so this row tells 10 from 12; the old total 15 row gave true for both); total 12 & page 1 with `meta.per_page: 10` → `false`. **Coercion and sign (PM74, PM75):** `"24"` and `"0"` (strings), `true`, `false`, `null`, `[]`, `[24]`, `""` → 503 (a `Number()` coercion would accept them); `-1`, `-12`, `-0.5` → 503 (dropping `>= 0` turns `-1`/`-12` into 200 `has_more:false`). Invalid total → **503** `{"error":"unavailable"}`, `Retry-After: 300`, `no-store`, puts 0: `meta.total` missing, `null`, `-1`, `"24"`, `1.5`, `true`, `[]`, `{}`; NaN/Infinity can't appear in JSON, so they are covered by a mapper unit test that feeds the parsed object directly (`NaN`, `Infinity` → unmappable → 503 at the handler).
- PW24 Drops (each its own case; others kept): non-object item (`null`, `1`, `"x"`, `[]`); id `0`, `-1`, `"5"`, `1.5`, missing; title not string, empty after trim, 201 chars after trim (200 kept); date unparseable, missing; plus every D8 failure (PW30).
- PW25 Field transforms: title trimmed; excerpt `<p>Hi <b>x</b></p>` → `Hi x`; entities decoded **exactly once after tag-stripping** (CQ17): `&lt;script&gt;` → literal `<script>` (rendered as text, PS8), `&amp;lt;` → `&lt;` (not `<`), `&amp;amp;` → `&amp;`; excerpt of 501 code points (incl. an astral char at position 500) → exactly the first 500 code points, no ellipsis, no word trimming, item kept (Q5); `date` → `new Date(x).toISOString()` exactly (`2026-10-19T10:00:00+02:00` → `2026-10-19T08:00:00.000Z`) (G4); `author` `{name:"A"}` → `"A"`, missing → null; `category` = first of `categories` `{name,slug}`, empty → null.
- PW26 Unmappable → 503: `posts` not array, `meta` not object, body not object, `meta.total` missing (with `posts: []` too). Upstream `posts: []`, `meta.total: 0`, `meta.per_page: 10` → 200 `{posts:[],page:N,per_page:12,has_more:false}` exactly (offset beyond total, C§4). **N4/N4a rows (1.1.7 §0f N4a: `has_more` can be true or false on an empty last page; each row's value is fixed by the A6 formula, so QA asserts it exactly):** (i) page 2, upstream `meta.total: 13`, `meta.per_page: 10`, `posts` holding one item that D8 drops (locked) → 200, body exactly `{posts:[],page:2,per_page:12,has_more:false}` (`24 < 13` false); (ii) page 1, `meta.total: 13`, `posts` holding 12 items all dropped by D8 → 200, body exactly `{posts:[],page:1,per_page:12,has_more:true}` (`12 < 13` true). Neither is 503 or 404; the dropped items' `LOCK` sentinels are in no body, put or console call.
- PW27 Duplicate ids in one upstream page (Q6): ids `[5, 7, 5, 9, 7]` with distinct titles → output ids exactly `[5, 7, 9]` and the titles of the **first** occurrences.
- PW44 Order preserved (G5): upstream ids `[9, 3, 12, 1, 7]` (dates deliberately not sorted) with one dropped (locked) and one duplicate → output order exactly the upstream order of the survivors, no sort by date or id.
### Detail mapping (A7, A6a)
- PW28 Happy path: body exactly `{post:{…Post keys…, content, permalink}}`; `content` is the sanitizer's output (PS-fixtures), not upstream raw.
- PW29 Permalink table (A6a, Q7, Q8), detail only, forwarded value = normalized `URL.href` of the checked URL: `https://brokenscience.org/x` → `https://brokenscience.org/x`; `https://brokenscience.org` → `https://brokenscience.org/`; `https://BROKENSCIENCE.ORG/x` → `https://brokenscience.org/x`; → null: `http://brokenscience.org/x`, `https://www.brokenscience.org/x`, `https://a.brokenscience.org/x`, `https://brokenscience.org:443/x` (explicit port, decided on the raw string), `https://brokenscience.org:8443/x`, `https://u:p@brokenscience.org/x`, `https://brokenscience.org.evil.com/x`, `https://evil.com/?brokenscience.org`, `https://brokenscience.org./x` (trailing dot), `javascript:alert(1)`, `data:text/html,x`, `//brokenscience.org/x`, `/x`, `""`, missing, non-string. The list never emits `permalink` (PW22).
- PW30 D8 table (A9) — keep only when ALL hold; each row a separate case, list → item dropped, detail → 404 byte- and header-identical to PW17's 404: `access_levels` missing / `null` / `{}` / `["x"]` / `[""]`; `content_access_display` missing / `null` / array / string; `has_content_access` `true` / `"false"` / missing; `is_exclusive` `true` / `"false"` / missing / `0`; `access` `"preview"` / `"none"` / `"Full"` / missing / `null`; expired exclusive still flagged (`access:"full"`, `is_exclusive:true`) → dropped; expired with `access_levels:["x"]` → dropped (D8/A9 1.1.1: hidden while flagged locked; Q-BSI-5). **Expired exclusive reported unlocked** (`is_exclusive:false`, `access_levels:[]`, `access:"full"`, `has_content_access:false`, plus leftover exclusive-only fields such as `access_group_labels:["Members"]`, `show_same`, `has_preview:true`) → **kept**, exact mapped item in list and 200 on detail (OQ-P2, Ethan). Control: the plain all-unlocked shape → kept. Every dropped row uses the `LOCK` sentinels: none in body, cache puts, console.
- PW31 Filter before cache: for a locked detail and a list containing one locked item, the Cache `put` bodies (bytes) contain no `LOCK` sentinel and no locked id; the locked detail's `put` count is 0 (404 never stored).
- PW32 Enumeration (T13, CQ2): locked id (A9 filter) and upstream-404 id → status 404, body `{"error":"not_found"}`, `Cache-Control: public, max-age=60`, and the two responses' header maps and bodies exactly equal to each other. A nonexistent id that fails A3 instead gets the catch-all 404 (PW2); QA asserts the two classes are each internally identical, not equal to each other.
- PW33 Detail `content` empty after sanitization → 200 with `content: ""` (exact).
- PW34 Detail upstream `{}` / `{post:null}` / `{post:[]}` → 503.
### Images (A10)
- PW35 `featured_image` (DR6 allowlist): kept only if https, no credentials, no port, hostname exactly `brokenscience.org`, emitted as normalized href: `https://brokenscience.org/wp-content/uploads/a.jpg` → kept; → null: `https://cdn.brokenscience.org/a.jpg` (**null until Q-BSI-8** adds a CDN host by a later rev), `http://brokenscience.org/a.jpg`, `https://u:p@brokenscience.org/a.jpg`, `javascript:…`, `data:image/png;base64,…`, `//brokenscience.org/a.jpg`, `"not a url"`, `""`, non-string. Lookalikes in PW43.
- PW43 Image host lookalikes (DR6), each for `featured_image`, content `img src` and a `srcset` candidate → null / `img` dropped / `srcset` dropped: `https://brokenscience.org.evil.com/a.jpg`, `https://evilbrokenscience.org/a.jpg`, `https://brokenscience.org@evil.com/a.jpg` (userinfo), `https://evil.com@brokenscience.org/a.jpg` (credentials present → rejected), `https://xn--brokenscence-xyz.org/a.jpg` and a Unicode homoglyph host (`https://brokensciеnce.org/` with Cyrillic е; normalised punycode ≠ `brokenscience.org`), `https://brokenscience.org./a.jpg` (trailing dot), `https://brokenscience.org:443/a.jpg` and `:8443` (port, raw-string check), `https://www.brokenscience.org/a.jpg`. Case: `https://BrokenScience.ORG/a.jpg` → kept, emitted lowercase normalized.
### Cache (A11, A12)
- PW36 Keys exactly `https://metfix.org/__cache/posts/list?page=<N>` and `https://metfix.org/__cache/posts/<id>`; never the request URL (request with `?page=2&x=1` → key has no `x`). Absent page → key `?page=1` (same entry as `?page=1`).
- PW37 Stored value = mapped body bytes; stored headers carry `s-maxage=300` (list) / `s-maxage=600` (detail); client response headers equal `apiOkHeaders()` exactly (`application/json; charset=utf-8`, `public, max-age=60`, `nosniff`).
- PW38 Second identical request → upstream calls stay 1 (hit), body byte-equal.
- PW39 400, 404, 503, 405 → put count 0 (every status in PW7/PW17/PW18/PW3).
- PW40 (CQ4) A cache entry that fails the mapped-shape validator (`PostListBody` / `PostDetailBody` guard in `shared/posts/`: A6/A7 types and exact key set) is refetched (upstream count 1) and never served: invalid JSON, a missing key, an extra key, a wrong type, `posts` not an array. The same guard is imported by the mapper (write) and the cache read path: an import test asserts both reference the identical exported function.
- PW41 API path: the cache put goes through `ctx.waitUntil` (spy called with the put promise) and the response doesn't wait on it. **HTML path on a miss (CQ10): `cache.put` is awaited before the response is returned** — when the HTML response resolves, `cache.match` for that key already returns the entry, and `ctx.waitUntil` is not used for it.
- PW45 Concurrent misses (CQ10): (a) five simultaneous `GET /api/posts?page=1` on a cold cache, with the upstream mock resolving out of order; (b) HTML `/posts/5` and `/api/posts/5` in the same tick; (c) concurrent requests where the upstream returns 503 for the first and 200 for the rest; (d) concurrent detail requests where one upstream response is locked. Expected: each response is correct for its own upstream result; the cache ends holding only a valid mapped 200 body (or nothing); **no 503/404/400 body is ever stored**, no `LOCK` sentinel or locked id appears in any `put` body; the number of upstream calls is recorded (no coalescing required, CQ11), and in (b) a request started after the HTML response resolved is a hit.
### Size and time (A13, A4)
- PW46 (CQ-M2, 1.13) One upstream call across HTML head + API for the same request (A11/A17, CQ B3), cold cache, upstream mock counting calls by exact URL: (a) `GET /posts/5` (Accept text/html) then `GET /api/posts/5` → upstream calls to `/wp-json/bsi/v1/posts/5` exactly 1 after the HTML response and still exactly 1 after the API response; the API body is byte-equal to the cached entry the HTML path stored at key `https://metfix.org/__cache/posts/5`; (b) the reverse order, same exact counts; (c) `GET /posts?page=2` then `GET /api/posts?page=2` → exactly 1 list upstream call total, key `https://metfix.org/__cache/posts/list?page=2`; (d) HTML on a warm cache → upstream calls 0. Total upstream calls of any URL per case equal exactly the stated number (no extra list fetch to build a detail or list head). Fails if either path calls upstream on its own or uses a different key.
- PW42 Size cap (Q9): the **whole upstream body** is counted in UTF-8 bytes while streaming, list and detail: 1,048,576 bytes → 200; 1,048,577 → 503 `unavailable`, no-store, puts 0; a body with multi-byte chars crossing the limit by bytes but not by characters → 503; the read is aborted (the mock stream's cancel is called; bytes past the limit are never read).

### Pins and constants (1.1.6 §0e) [CI]
- CK-P1 [BOX] (§0f P2 + G1, one-way; §0g D2/A-PIN1) The gate infra PR's shared script (`scripts/gate-ck-p1.mjs`), run by QA locally before round 1 against PR3's docs pair (`docs/pr3-posts/` spec copy + QA list copy); PR3 adds no ci.yml step. It reads the spec-md5 pin from the QA-list copy, recomputes the spec copy's md5, and counts the IDs in the QA list's `gate-ids` block against the header's stated `gate-ids` count; exit 0 only when both match; it never reads a QA md5 from the spec. Cases, each a run of the real script on temp copies: (a) pin and count match → exit 0, no `PIN MISMATCH` line, and the script echoes the 32-hex pin, the recomputed md5 (equal) and both counts (vacuity: proves it read them); (b) one byte appended to the spec copy → exit ≠0, output exactly `PIN MISMATCH: <spec copy path>`; (c) the QA list's spec pin changed by one hex digit → exit ≠0, `PIN MISMATCH: <spec copy path>`; (d) one ID added to (and separately one removed from) `gate-ids` with the header unchanged → exit ≠0, exactly `PIN MISMATCH: <QA list path>`; (e) header count changed with the block unchanged → same; (f) the pin line or the header count line removed → exit ≠0 (missing = mismatch, never a skip); (g) a byte changed in the QA list outside the pin/count/block (e.g. a test description) → exit 0 (one-way: QA edits don't need a spec change); (h) a QA md5 inserted into the spec copy → ignored, result unchanged from (a). (The 1.5 case (i), the ci.yml-step check, moved to the gate list per §0g.) **Evidence (A-PIN1):** script md5, the gate-PR commit it came from, the PR3 head SHA, full output of (a)–(h) and rc per case, recorded in §R1 with the box-evidence md5, Web Lead sign-off.
- CK-N1 (N1, §0f L1 scope; a vitest repo-scan test in `worker/posts.repo-scan.test.ts` per §0h, failing with `SCAN FAIL: literal-12 <file>:<line>`) Literal-12 lint over non-test source only: `worker/posts*.ts` (excluding `*.test.ts`), `shared/posts/**` (excluding tests), `client/src/pages/posts/**` (excluding `*.test.tsx`); it matches a standalone numeric literal `12` only. On the PR head: exit 0 and the only hit candidate is the `PAGE_SIZE` declaration. Planted on a temp copy, each → exit ≠0 naming the file: `limit=12` in a Worker URL template, `page * 12` in the client page, `const per = 12` in shared, a `12` carrying an allowlist/disable comment (not accepted). **Allowed (exit 0):** `expect(body.per_page).toBe(12)` in a `*.test.ts` and a `*.test.tsx`; `120`, `0x12`, `2026-12-01`, `'12px'` in source (not a standalone `12`). **Vacuity:** the run reports ≥1 scanned non-test file per glob (an empty glob fails), and a planted `12` in a non-test file under each glob is caught (proves the exclusion didn't swallow source).

## Sanitization [CI]
Fixtures run through the Worker pass (PS) and, separately, through `SafeHtml`/DOMPurify (PC), each with an exact expected output string (Worker) or an exact DOM assertion (client).
- PS1 Allowed tags kept exactly (`p, h2, h3, h4, ul, ol, li, blockquote, strong, em, b, i, a, img, figure, figcaption, br, hr, code, pre`); `h1`, `h5`, `div`, `span`, `table`, `u`, `sup` unwrapped (text kept, tag gone).
- PS2 Removed with content: `script, style, iframe, object, embed, form, input, button, svg, math, link, meta, base, noscript, template` — each fixture carries a sentinel inside; the sentinel is absent from the output.
- PS3 Attributes (Q10): only `a[href, title]` and `img[src, srcset, alt, width, height]` survive, plus the added `img[loading="lazy", referrerpolicy="no-referrer"]` and `a[rel, target]`; stripped: every `on*` (case variants), `style`, `srcdoc`, `formaction`, `class`, `id`, `data-*`, `xlink:href`, `lang`, `dir`, `title` on non-`a` tags.
- PS4 `a[href]` (G2, Q8, Q11): relative and fragment hrefs resolve against `https://brokenscience.org/` and are emitted as normalized href (`/rel` → `https://brokenscience.org/rel`, `rel` → `https://brokenscience.org/rel`, `#x` → `https://brokenscience.org/#x`); kept after resolve: `https:`, `http:`, `mailto:`; removed (attribute gone, text kept): `javascript:alert(1)`, `JaVaScRiPt:`, ` javascript:`, `java\tscript:`, `&#106;avascript:`, `data:`, `vbscript:`, `file:`. External = resolved origin ≠ `https://metfix.org` → `target="_blank"` and `rel="noopener noreferrer nofollow"` exactly; `mailto:` → no `target`, `rel` still set; an absolute `https://metfix.org/x` link → no `target`.
- PS5 `img` (DR6, Q12, A10): every `img src` and each `srcset` candidate is resolved against `https://brokenscience.org/` and must be https, no credentials, no port, host exactly `brokenscience.org`. Bad `src` (http, data, javascript, credentials, other host, `cdn.brokenscience.org`) → the **whole `img` element** is dropped; any bad `srcset` candidate → the **whole `srcset`** attribute is dropped, the `img` kept if `src` is good; relative `/wp-content/a.jpg` → `https://brokenscience.org/wp-content/a.jpg`. Every kept `img` has `loading="lazy"` and `referrerpolicy="no-referrer"` exactly.
- PS6 Comments removed (`<!-- x -->`, conditional comments); CDATA; nested-unwrap mXSS fixtures (`<noscript><p title="</noscript><img src=x onerror=alert(1)>">`, `<svg><style><img src=x onerror=…>`, `<math><mtext><table><mglyph><style><img …>`) → no `onerror`/`script` in the output of either pass.
- PS7 Output is stable: sanitizing the Worker output again is a no-op (idempotence, string-equal).
- PS8 Title/excerpt as text (A15): fixture title `<img src=x onerror=alert(1)>` renders as literal text (`textContent` equals the string; `querySelector('img')` within the card is null).
- PS9 One allowlist (CQ14): the tag and attribute lists are exported once from `shared/posts/sanitizeConfig.ts`; an import test asserts the HTMLRewriter pass and the DOMPurify config both reference the same exported objects (identity, not deep-equal copies), and that no other file under `worker/` or `client/src/` defines a tag list containing `figcaption`.

## SPA, head and HTML statuses [CI: Workers runtime tests]
- PH1 `wrangler.jsonc` `run_worker_first` equals main's array plus exactly `"/posts"` and `"/posts/*"` (deep-equal); `worker/build.config.test.ts` diff touches only that (A16).
- PH2 Non-GET/HEAD to `/posts`, and GET `/posts` with `Accept: application/json`, → `env.ASSETS.fetch` called once with the original request; posts upstream 0.
- PH3 `/posts` and `/posts?page=2` (Accept text/html) → 200; head exactly: `<title>Posts — MetFix</title>` for every page (CQ6), description exactly `Articles from Broken Science.` (G7), one `meta[name=robots]` = `noindex, follow`, **zero** `link[rel=canonical]`, `og:type` `website`, og:image `https://metfix.org/social-preview.jpg`. Header map (CQ18): the ASSETS response headers passed through, with `Cache-Control` deleted when it contains `s-maxage` (as Daily Fix HTML); asserted for an ASSETS fixture with and without `s-maxage`.
- PH4 Invalid page on HTML (`/posts?page=abc`, `51`, `0`) → 200 with the page-1 list head (exact), never 400; upstream URL = page-1 URL.
- PH5 Detail with valid permalink → 200; head: one robots `index, follow`; exactly one canonical with `href` = permalink; `og:url` = permalink; `og:type` `article`; title `{title} — MetFix` (U+2014); description = excerpt with whitespace collapsed and trimmed, cut to ≤160 code points (CQ6). Same CQ18 header-map rule as PH3.
- PH6 Detail without valid permalink → robots `noindex, follow`, zero canonical, `og:url` = `https://metfix.org/posts/<id>`.
- PH7 Escaping: title `"><script>x</script>` and permalink-less excerpt with `"` `<` `&` → head attributes escaped (`&quot;` `&lt;` `&amp;`); the final HTML has no injected element (DOM parse: `script` count equals the template's).
- PH8 og:image = the item's allowlisted image (PS5/PW35 rule), else exactly `https://metfix.org/social-preview.jpg` (Q13); a `cdn.brokenscience.org` image → fallback.
- PH9 Upstream 404 / locked / invalid id (`/posts/abc`, `/posts/0`, `/posts/2147483648`) → `htmlNotFound` (404, `generic_noindex`), byte-equal for all three classes; upstream 0 for invalid ids.
- PH10 Upstream failure → `htmlServiceUnavailable` 503, `Retry-After: 300`, `no-store`; ASSETS failure → plain 503.
- PH11 `/posts/123/` → 301 `Location: /posts/123`; `/posts/` → 301 `Location: /posts`; `/posts/?page=2` → 301 `Location: /posts?page=2` (query kept, Q14); `/api/posts/` unchanged (PW1).
- PH12 HTML detail shares the API cache entry (A17): one upstream call serves both `/posts/5` HTML and `/api/posts/5` (in either order).
- PH13 Exactly one robots tag and ≤1 canonical in the final HTML for every PH case (count, not presence).
- PH14 Locked detail via HTML → 404 and no `LOCK` sentinel anywhere in the HTML (incl. head meta description).
- PH15 One shared head builder (CQ6): `buildPostsHead(input): PostsHead` in `shared/posts/head.ts` is the only producer of posts head values: (a) a spy on the exported builder is called by the Worker for list and detail HTML and by `usePageMeta` for list and detail, and the Worker head values equal the builder output exactly; (b) static: no other file under `worker/` or `client/src/` contains the strings `— MetFix` with posts context, `Articles from Broken Science.` or `social-preview.jpg` for posts except via the builder; (c) builder unit test: a description of 200 code points with an astral character at code point 160 is cut to exactly 160 code points at a boundary (no broken surrogate), no ellipsis, whitespace collapsed first.

## Client [CI: mount tests]
- PC1 (A25 flip) `/posts`: exactly one fetch, URL exactly `/api/posts?page=1`, `Accept: application/json`, a signal; mocked titles render as exact text; the mock payload is A6-shaped (the rewritten `stubPostsPayloadFetch`), and the stub's "posts unavailable" copy appears nowhere in the rendered DOM (no stub content accepted); not home / Daily Fix / 404 (existing markers).
- PC2 (A25) `FORBIDDEN_SAMPLE_TITLES` "never render" assertion deleted; the Substack-href and `brokenscience.org`-fetch assertions stay byte-identical; `link[rel=canonical]` is null on the list.
- PC3 (A25 split) `/posts/1` → one fetch `/api/posts/1`, renders title/date/author/image/content; with a 404 mock → "Error 404" and `location.pathname` stays `/posts/1`.
- PC4 (A25, CQ13) `/posts/some-slug`, `/posts/0`, `/posts/2147483648`, `/posts/01` → NotFound, fetch count 0; the client imports the A3 id regex and max from `shared/posts/` (import identity test). Daily Fix `/250210` test unchanged and passing.
- PC5 Paging: page 1 with `has_more:true` → "Older" links to `?page=2`, no "Newer"; page 2 → both; page 50 with `has_more:true` from a bad server → no "Older" (client caps at 50) and no fetch of page 51 ever (fetch log).
- PC6 One fetch per page change (CQ12): the effect depends only on the parsed `page`/`id`, not on `location`/`search` (changing an unrelated query param or the hash causes 0 fetches); navigating 1→2→1 → exactly 3 fetches (no module-level cache); unmount during a pending fetch → abort called, no state update after unmount (console.error spy 0).
- PC7 Loading state `role="status"` present before resolve, gone after.
- PC8 Error state for 503, 400, network reject: text "Posts couldn't be loaded" + a retry button; **no** card, no mocked/fake titles in the DOM; retry triggers exactly one new fetch.
- PC9 Empty: page 1 `posts:[]`, `has_more:false` → "No posts yet"; page 3 `posts:[]`, `has_more:false` → a link to page 1, no "No posts yet"; page 2 `posts:[]`, `has_more:true` (all filtered, G1) → exactly "No posts on this page." **and** the "Older" link to `?page=3`.
- PC10 Detail 503 → error + retry, no content.
- PC11 Permalink link (A20, DR9) present only when non-null: href = permalink, `rel` exactly `noopener noreferrer`, `target="_blank"`; null → no link element at all.
- PC12 `SafeHtml` is the only HTML sink in `pages/posts/**`: static `rg -n "dangerouslySetInnerHTML" client/src/pages/posts` → 0 lines; `rg` in `SafeHtml.tsx` → exactly 1, fed by DOMPurify output.
- PC13 DOMPurify fixtures (same as PS1-PS6) through `SafeHtml` directly, with the Worker pass bypassed → no `script`, no `on*`, no `javascript:` href, no non-https img src in the DOM.
- PC14 All fetch URLs in every client test start with `/api/posts` (global fetch spy asserts per test); no absolute URL; clicking the permalink link causes no fetch.
- PC15 `usePageMeta` values after hydration equal the server head values for list (incl. description `Articles from Broken Science.`), detail-with-permalink and detail-without (robots, canonical presence/href, og:url, og:image, title) — exact strings.
- PC16 `dompurify` pinned to an exact version in package.json (no `^`/`~`) and present in the lockfile; no other dependency changes (diff of package.json deps).
- PC17 Invalid `?page=` on the client (Q16): `/posts?page=abc`, `?page=0`, `?page=51`, `?page=01` → exactly one fetch `/api/posts?page=1` (the invalid value never sent), page-1 cards render, no error state, `history.replaceState` called once with `/posts` (location.search becomes empty).
- PC18 StrictMode (CQ12c): rendered under `<React.StrictMode>`, `/posts` and `/posts/5` each produce exactly 2 fetch calls, the first one's signal is aborted before it resolves, exactly 1 response is applied (one data render; the aborted response's titles never appear), and the discriminated-union state goes loading → data exactly once; no console.error. Without StrictMode: exactly 1 fetch (PC1/PC3).
- PC20 (CQ-M1, 1.13) Exact fetch count and abort on change (A19/A20, CQ B2), no StrictMode, fetch mock with manually resolved promises: (a) `/posts` → exactly 1 fetch `/api/posts?page=1`; three unrelated re-renders (parent state bump) → still exactly 1; navigating to `?page=2` → exactly 2 total, the 2nd URL exactly `/api/posts?page=2`, and the 1st call's signal `aborted === true` at the moment the 2nd fetch starts; (b) resolve page 1 **after** page 2 resolved → page-2 titles render, page-1 titles never appear in the DOM at any later tick, state transitions to data exactly once per applied response, console.error 0; (c) `/posts/5` → `/posts/6` → exactly 2 fetches (`/api/posts/5`, `/api/posts/6`), the first signal aborted, a late `/posts/5` response never renders; (d) unmount while a fetch is in flight → its signal aborted, resolving it afterwards produces no state update (no React act/unmounted warning, console.error 0) and no further fetch. Fails if any extra fetch, missing abort, or stale render occurs.
- PC19 Cards (CQ24): list cards render through one shared `PostCard` component with `key={post.id}` (React key warning spy 0; reordering the payload reorders DOM nodes by id); no inline `style=` attribute in any rendered posts DOM node.

## Security / CI [CI]
**Repo-scan rule (§0h R-B; every PX1/PX5/PX7/PX9/CK-N1 case).** Each is a vitest test in `worker/posts.repo-scan.test.ts`, run by `npm test` (no ci.yml step). Each (1) reads files with `node:fs` from the repo root; (2) on a hit fails with exactly `SCAN FAIL: <rule> <file>:<line>` (one line per hit, `<line>` 1-based); (3) **fails when zero files are scanned** or the target dir is missing, with **its own** guard in that test (no shared guard, §0i); (4) has a **planted-pattern proof**: QA plants the violation on a scratch branch at a known file and line, and the test fails naming exactly that `<file>:<line>`; (5) has a **clean control**: the unplanted head passes with ≥1 file scanned (count logged).
- PX1 (= RS1; A22 re-worded, §0h) Bundle scan built in-test: the test runs Vite's programmatic `build()` into a temp outDir (no dependency on CI step order or #10's B2 step, which stays untouched), then scans every file under it for `BSI_POSTS_API_KEY`, `bsi/v1/posts`, `wp-json`, `test-posts-key`, `DAILY_FIX_API_KEY`, `X-API-Key`, `test-secret-key`. Plant each pattern (once per pattern) in a client source string → `SCAN FAIL: <pattern-rule> <built file>:<line>`; clean build → pass with ≥1 built file; zero built files (empty outDir fixture) → fail (vacuity).
- PX1.r (§0j, CQ N4) After PX1's in-test build: `git status --porcelain --ignored -uall` byte-identical to the pre-test snapshot; the `mkdtemp` outDir and cacheDir both no longer exist; nothing written under the repo (incl. `dist/`); test timeout 120 s. Planted: outDir in the repo → FAIL naming the path.
- PX2 No `VITE_` variable added (`git diff main -- '*.ts' '*.tsx' '*.json' | rg 'VITE_'` → no new lines); no key literal other than the two dummies (`rg -n "test-posts-key|test-secret-key"` only in tests/fixtures).
- PX3 `.dev.vars.example` diff is exactly one added line `BSI_POSTS_API_KEY=` (empty).
- PX4 (A24) No sitemap: no `/sitemap-posts.xml` route (request → not a sitemap: SPA/404 per main), sitemap index response byte-equal to main's, `run_worker_first` has nothing beyond PH1.
- ~~PX5~~ (= RS4) **Retired 1.9 (§0j)** → gate SC1 (clean, merge-base), SC2 (out-of-scope incl. ci.yml row), SC3 (empty diff); A29 is now PR3's `allowed-files` block, checked by the gate scope step.
- ~~RS4s1~~ **Retired 1.9** → gate HM1.
- ~~RS4s1-stale~~ **Retired 1.9** → gate HM1-stale.
- ~~RS4s2~~ **Retired 1.9** → gate HM2.
- ~~RS4s3~~ **Retired 1.9** → gate HM3 (success path: QA row in gate HM3, see gate disagreement).
- PX6 CI run at the PR head green; counts recorded; delta vs main explained per A25-A28.
- PX7 (= RS2; G3(b)) Log rule over `worker/posts*.ts` and `shared/posts/**` (non-test): every `console.*` call's arguments are one plain string literal `"posts:<kind>"` plus at most one numeric identifier; template literal, concatenation, object or extra argument → `SCAN FAIL: posts-log <file>:<line>`. Plants: a template literal and an extra argument (each at a known line).
- PX8 (CQ14) `dompurify` is not in the entry chunk: after `build:cf`, parse the Vite manifest; the entry chunk and its static imports contain no `dompurify` module id, and `dompurify` appears only in the posts detail route chunk (asserted like `assert:liquidglass-chunk`).
- PX9 (= RS3; CQ15) Static: no `Test-only` marker and no host-override parameter (`bsiBaseUrl`, `baseUrl`, `host`, `origin`-style param) in `worker/posts*.ts` (non-test) → `SCAN FAIL: host-override <file>:<line>` (plant each at a known line). Runtime: the posts handler called with deps carrying `bsiBaseUrl: "https://evil.example"`, `baseUrl`, `host`, and env `BSI_HOST=evil.example` → every upstream URL still starts with `https://brokenscience.org/wp-json/bsi/v1/posts`.
- PX10 Lint (CQ12, CQ24) on `client/src/pages/posts/**` as errors: `react-hooks/exhaustive-deps`, `react/no-array-index-key`, `react/jsx-key`, and a rule forbidding inline `style` props; a planted violation of each fails `npm run lint` (or the CI lint step) on a scratch branch.

## Box-only [BOX]
- PB1 `wrangler dev --local` after `build:cf` with a stub BSI (local server returning the fixtures, the Worker host constant redirected only in a scratch branch): HAR of `/posts` and `/posts/5` shows browser requests only to the dev origin; no request to `brokenscience.org` from the browser.
- PB2 Cache behaviour on a custom domain or `wrangler dev` (CQ11: the Cache API does nothing on `*.workers.dev` previews): hit/miss/TTL observed through the upstream stub's hit counter, not `cf-cache-status`.
- PB3 Kill/interrupt: none needed for this PR (no repo writes by tests); QA confirms with a before/after porcelain snapshot around `npm test` and `test:workers`.

## Post-deploy [POST] (never merge gates)
- PD1 Ethan's by-eye key check (A23/A30): key label `metfix-web-posts`, no `user_id`, differs from the app and Daily Fix keys — **Ethan in his own words; a relay doesn't count.**
- PD2 Prod `/posts` renders real posts; every browser request same-origin (HAR).
- PD3 A known exclusive/locked id → 404 on `/posts/<id>` and `/api/posts/<id>` (Q-BSI-7 for an id).
- PD4 A known public id → robots `index, follow`, canonical = its brokenscience.org permalink.
- PD5 With no secret set (if deployed before A30 steps) → `/api/posts` 503 exactly per PW14.
- PD7 (1.1.6 N3, 1.1.7 N3a) After deploy, two BSI list responses made with the posts key by Ethan or Web Lead (the key is never pasted to QA): page 1 (`limit=12&offset=0&preview=true`) and the last page (`offset=(ceil(total/PAGE_SIZE)-1)*PAGE_SIZE`, capped at page 50, with `total` from the page-1 response). In each, `meta.total` is a JSON **number token** (raw-bytes regex `"total":\s*(0|[1-9][0-9]*)[,}]`; not a string, not `null`), `Number.isInteger` true, ≥ 0, and equal across the two responses. QA's live `GET https://metfix.org/api/posts?page=1` and `?page=<last>` are 200 (not the PW23 503), and the last page has `has_more:false`. Evidence: the raw `meta` objects only, md5 recorded.
- PD6 A known expired exclusive (window ended, BSI reports it unlocked) renders on `/posts/<id>` with 200; a still-active exclusive → 404 (OQ-P2; depends on Q-BSI-5).

## Mutation catalogue [BOX] (reference; exact red sets) with advisory targeted set
Mutation results are **not** a per-round or merge gate; a surviving targeted mutant is a finding reported to MetFix Web Lead. Only rows marked **targeted (advisory)** are run; catalogue rows only when QA judges a test's strength in doubt.
| ID | Mutation (scratch) | Exact red set | Status (1.11) |
|---|---|---|---|
| PM1 | Read `limit`/`preview` from the request query into the upstream URL | PW8 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM2 | Send `per_page=12` instead of `limit=12` | PW1, PW6, PW8, PW10, PW10b | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM3 | Drop `preview=true` from the list URL | PW1, PW6, PW8, PW10, PW10b | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM4 | Accept page 51 (cap 50 → 51) | PW7 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM5 | Page regex allows leading zero (`^[0-9]+$` with >0 check) | PW7 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM6 | 400 path stores in cache | PW39 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM7 | 400 path missing `no-store` | PW7 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM8 | Copy incoming headers into the upstream request | PW11 | **targeted (advisory, 1.13)**: copying incoming headers upstream; cookie/IP leak (CQ core) |
| PM9 | Add `Authorization: Bearer` when the incoming request has one | PW11 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM10 | `redirect: "follow"` | PW18 (3xx rows), PW12 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM11 | Remove `AbortSignal.timeout(3000)` | PW12, PW18 (timeout row) | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM12 | Fallback `env.BSI_POSTS_API_KEY ?? env.DAILY_FIX_API_KEY` | PW14, PW15 | **targeted (advisory, 1.13)**: falling back to the Daily Fix key; wrong-secret use (CQ core) |
| PM13 | Whitespace key treated as present | PW14 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM14 | Echo upstream error message into the 503 body | PW18 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM15 | Map upstream 429 → 429 | PW18 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM16 | Raw passthrough of upstream item (spread) | PW21, PW22 | **targeted (advisory, 1.13)**: QA pick: spreading the upstream object is the most likely shortcut in a mapper and leaks every unlisted BSI field (access meta, raw content) at once |
| PM17 | Forward `video` | PW22 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM18 | `has_more` formula without the `page < 50` clause | PW23 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM19 | D8: drop the `access_levels` empty-array check | PW30 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM20 | D8: drop the `is_exclusive === false` check | PW30 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM21 | D8: `access !== "none"` instead of `=== "full"` | PW30 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM22 | D8: treat missing `content_access_display` as unlocked | PW30 | **targeted (advisory, 1.13)**: D8 paywall fails open on a missing field (CQ core) |
| PM23 | D8 applied after the cache put | PW31 | **targeted (advisory, 1.13)**: QA pick: D8 after the cache put stores locked content, then every later hit serves it to every visitor; ordering slip is easy, impact is a cached paywall leak |
| PM24 | Locked detail → 403 instead of 404 | PW30, PW32, PH14 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM25 | Permalink: `endsWith("brokenscience.org")` | PW29 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM26 | Permalink: allow `http:` | PW29 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM27 | Image: allow `http:` | PW35, PS5 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM28 | Cache key = request URL | PW36 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM29 | Cache 404/503 | PW39 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM30 | Serve corrupt entry without validation | PW40 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM31 | Sanitizer: keep `on*` attributes | PS3, PS6 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM32 | Sanitizer: allow `javascript:` href (scheme check removed) | PS4 | **targeted (advisory, 1.13)**: QA pick: dropping the href scheme check is a realistic sanitizer-config slip and yields clickable `javascript:` XSS that PM35 (no sanitizer at all) does not cover |
| PM33 | Sanitizer: unwrap instead of remove `script`/`style` | PS2 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM34 | Sanitizer: drop the `rel` rewrite | PS4 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM35 | Client: `SafeHtml` renders the raw string (DOMPurify bypassed) | PC12, PC13 | **targeted (advisory, 1.13)**: SafeHtml without DOMPurify; stored XSS from upstream HTML (CQ core) |
| PM36 | Client: title via `dangerouslySetInnerHTML` | PS8, PC12 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM37 | Head: drop `escapeAttr` on title | PH7 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM38 | Head: canonical emitted for the list | PH3, PH13 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM39 | Head: canonical emitted when permalink is null | PH6 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM40 | HTML: invalid page → 400 | PH4 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM41 | Client fetches absolute `https://brokenscience.org/wp-json/...` | PC14, PX1 | **targeted (advisory, 1.13)**: client calls BSI directly; key/CORS exposure (CQ core) |
| PM42 | RS1's pattern list drops `BSI_POSTS_API_KEY` | PX1 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM43 | Content cap removed | PW42 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM44 | Missing-id 404 differs from locked 404 (e.g. `no-store` on one) | PW32 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM45 | Client requests page 51 when `has_more` | PC5 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM46 | D8 hides any item carrying exclusive-related fields (`access_group_labels` non-empty or `has_preview`) even when unlocked | PW30 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM47 | Image host check `endsWith("brokenscience.org")` | PW43 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM48 | Image host check `includes("brokenscience.org")` | PW43 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM49 | Sort list items by date desc after mapping | PW44 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM50 | Drop `referrerpolicy="no-referrer"` from content images | PS5 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM51 | Page param name compared case-insensitively and accepted | PW9 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM52 | Excerpt truncation by UTF-16 units (`slice(0,500)`) | PW25 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM53 | Duplicate ids keep the last occurrence | PW27 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM54 | Size cap on `content` only, not the whole body | PW42 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM55 | Permalink port check on `URL.port` (drops the `:443` case) | PW29 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM56 | A20 link `rel="noopener"` only | PC11 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM57 | Page-name check case-insensitive equality only (misses `pageX`, `pages`, `page_`) | PW9 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM58 | Accept `page[]=1` as page 1 | PW7, PW9 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM59 | Divergent head copy in `worker/head.ts` (not via `buildPostsHead`) | PH15 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM60 | Custom JSON 404 with `Cache-Control` for bad ids instead of the catch-all | PW2 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM61 | No AbortController cleanup in the posts effect | PC18, PC20 | catalogue (not targeted); same patch as CQ-M1 (1.13), which is the targeted copy; red set gains PC20 (1.13) |
| PM62 | Static `import DOMPurify` in an entry-chunk module | PX8 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM63 | Posts handler honours a `bsiBaseUrl` dep | PX9 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM64 | Separate tag list copy in the DOMPurify config | PS9 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM65 | Constant BSI host changed to `evil.example` (scratch only) | PW13 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM66 | HTML miss uses `ctx.waitUntil` for the put instead of awaiting it | PW41 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM67 | Store the upstream 503 body in the cache on a concurrent miss | PW45 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM68 | Cache read path skips the shape guard | PW40 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM69 | Excerpt entities decoded twice | PW25 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM70 | HTML response keeps an `s-maxage` Cache-Control | PH3, PH5 | catalogue (not targeted); dropped from the targeted set 1.10: (c) Lower-risk behaviour where the gate row's assertion is direct and not in doubt (PR3 not yet built; revisit if round 1 shows a weak test) |
| PM71 | `has_more` off by one: `page*12 <= meta.total` | PW23 | catalogue (not targeted); dropped from the targeted set 1.13 (Web Lead ruling: ~10, CQ core + QA's strongest 3) |
| PM72 | `has_more` from `meta.has_more` instead of `meta.total` | PW23 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM73 | Response `per_page` and the `has_more` formula use upstream `meta.per_page` instead of `PAGE_SIZE` (upstream URL unchanged) | PW10b, PW21, PW23, PW26 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM73b | List URL built with `limit=${meta?.per_page ?? 10}`-style default 10 instead of `PAGE_SIZE` (limit/offset from 10) | PW1, PW6, PW8, PW10, PW10b | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM74 | `Number.isInteger(Number(meta.total)) && Number(meta.total) >= 0` (coercion added) | PW23 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM75 | Drop the `meta.total >= 0` clause | PW23 | catalogue (not targeted); dropped from the targeted set 1.10: (b) Variant of a kept mutant on the same code path |
| PM76 | CK-P1 skips the header gate-count compare (pin compare only) | CK-P1 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM78 | RS1 vacuity guard removed (empty outDir passes) | PX1 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| PM83 | In-test build outDir set to `dist/public` in the repo, no cleanup | PX1.r | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
| CQ-M1 | (CQ, 1.13) PostsPage list and detail effects: remove the `AbortController` cleanup (no `controller.abort()` on unmount or param change; response applied whenever it resolves) | PC18, PC20 | **targeted (advisory, 1.13)**: missing abort lets a stale page/id response overwrite the current one; very common React bug |
| CQ-M2 | (CQ, 1.13) Worker HTML `/posts/{id}` and `/posts?page=N` head build calls upstream directly, bypassing the shared cached `getPost`/`getList` helper (API path unchanged) | PH12, PW41, PW45, PW46 | **targeted (advisory, 1.13)**: HTML bypassing the cache doubles BSI calls per page load against the 60/60 s key bucket |
| PM76b | CK-P1 pin compare always reports a match (§0g N3) | CK-P1 | catalogue (not targeted); dropped from the targeted set 1.10: (a) Test, tooling or CI-scan sabotage, not a realistic product mistake |
**PM note (1.9).** PM77, PM79, PM80, PM81, PM82 retired → gate GM68, GM76, GM77, GM74, GM75. PM83 = {PX1.r} exactly: PX1 still builds and scans the dist (a repo outDir is still a non-empty outDir), PX7/PX9/CK-N1 do not read `dist/` and ignore gitignored paths, so only PX1.r's porcelain/temp-dir assertion goes red.
Each PM's red set is exact: a mutation that also turns another ID red is a test-design defect QA fixes before round 1 (split the test), not an accepted wider set.

## Acceptance and threat coverage map
| Item | IDs |
|---|---|
| A1 | PW1-PW5 | 
| A2 | PW6-PW9, PW36 |
| A3 | PW2, PH9, PC4 |
| A4 | PW10, PW10b, PW11-PW13 |
| A5 | PW14 |
| A6 | PW21-PW27, PW44, PW10b, PD7 |
| §0g D1–D3, N3, A-PIN1 (1.1.8) | CK-P1 [BOX], PM76, PM76b; header pin/counts |
| §0f P2/G1/N3a/N4a/S1/S2/L1 (1.1.7) | CK-P1, PM76; PD7; PW26; PW23; PM73, PM73b; CK-N1 |
| §0e P1/N1-N4 (1.1.6) | CK-P1, PM76; CK-N1, PW10, PW10b, PW23, PM73, PM73b; PM74, PM75; PD7; PW26 N4 row |
| A6a | PW29, PH5, PH6, PC11 |
| A7 | PW28, PW33, PW34 |
| A8 | PW17-PW20 |
| A9 | PW30-PW32, PH14 |
| A10 | PW35, PW43, PS5 |
| A11 | PW36-PW41, PW45, PW46 |
| A12 | gate SC2 (PX5 retired; PR body statement checked in scope review), PB2 |
| A13 | PS1-PS7, PS9, PW42 |
| A14 | PC12, PC13, PC16, PS9, PX8 |
| A15 | PS8 |
| A16 | PH1, PH2 |
| A17 | PH3, PH4, PH9-PH12, PW46 |
| A18 | PH3, PH5-PH8, PH13, PH15, PC15 |
| A19 | PC1, PC5-PC9, PC17, PC18, PC19, PC20, PX10 |
| A20 | PC3, PC10, PC11 |
| A21 | PC14, PX1, PB1 |
| A22 | PX1, PX2 |
| A23 | PW15, PW16, PX3, PD1 |
| A24 | PX4 |
| A25 | PC1-PC4 |
| A26 | PC1, PH3 |
| A27 | PX6 (survives #7 or deleted with it; recorded) |
| A28 | PC1 (route reachable) |
| A29 | gate SC1/SC2 (PX5 retired) |
| CQ1-CQ24 | CQ2 PW2/PW32; CQ3 PW7/PW9; CQ4 PW40; CQ5 gate SC2; CQ6 PH3/PH5/PH15/PC15; CQ7 gate-ids block; CQ10 PW41/PW45; CQ11 PB2; CQ12 PC6/PC18/PX10; CQ13 PC4; CQ14 PS9/PX8; CQ15 PW12/PW13/PX9; CQ16 PW16; CQ17 PW25; CQ18 PH3/PH5; CQ19 overlap; CQ21 PX5; CQ22 header; CQ23 ordering; CQ24 PC19/PX10; CQ1, CQ8, CQ9, CQ20 doc/process only |
| A30 | PD1, PD5 |
| T1 | PW16, PX1, PX2, PX7, PW18 |
| T2 | PW7, PW8, PW2 |
| T3 | PW22, PW30, PW31 |
| T3b | PW30 (still-flagged rows dropped; expired-unlocked row kept), PM19, PM20, PM46 |
| T4 | PS1-PS8, PH7, PC13 |
| T5 | PS4, PS5, PW35, PW43 (tracking via image hosts closed by the DR6 allowlist) |
| T6 | PW38, PW39, PB2 (documented gap A12) |
| T7 | PW36, PW39, PW40, PW45 |
| T8 | PW11 |
| T9 | PD1 |
| T10 | PW14, PW15, PD1 |
| T11 | PW10, PW13, PW8, PX9 |
| T12 | PW12, PW18 (3xx), PW13 |
| T13 | PW32 |
| T14 | PW29, PC11, PH6 |
| T15 | PW30, PH3 |
| T16 | PW12, PW42, PW24 |
| T17 | PW10 (exact URL), PX2 |
Every A-item and T-row maps to at least one ID.

## Review of Spec defaults
- DR1 D4 numeric ids only — **agree**.
- DR2 D8 fail-closed, kept after BSI's leak fix — **agree** (strongly).
- DR3 D6 list `noindex, follow` with no canonical — **agree** (W7 decided by Web Lead in 1.1.1).
- DR12 D8 as revised for OQ-P2 (hide only while flagged locked, fail closed on missing/wrong fields) — **agree**; risk stays with Q-BSI-5: if BSI keeps `is_exclusive:true` after expiry, expired posts stay hidden (fails safe), so PD6 checks a real expired id after deploy.
- DR4 A17 invalid page on HTML → 200 page-1 head — **agree**, since the list is noindex; client also shows page 1 (Q16 decided in 1.1.2; PC17).
- DR5 A8 404 browser-cacheable `max-age=60`, never in the Cache API — **agree**.
- DR6 Images: **resolved in 1.1.2** — exact-host allowlist `brokenscience.org`, `referrerpolicy="no-referrer"`, `loading="lazy"`; CDN hosts only via Q-BSI-8 in a later rev. QA agrees (PW35, PW43, PS5, PM47, PM48, PM50).
- DR7 A11 TTLs 300/600 with no rate-limit binding (W2) — **agree for now**, given A12's documented gap; QA can't test BSI's bucket.
- DR8 A6a exact `brokenscience.org` (no `www.`) — **agree**, pending Q-BSI-6.
- DR9 **Resolved in 1.1.2**: A20 link `rel="noopener noreferrer"`, `target="_blank"` (PC11, PM56). QA agrees.
- DR10 A2 400 on bad page for the API — **agree**.
- DR11 A13 keeps `http:` links in content — **agree** (navigation, not mixed content), with `nofollow`.

## Overlap with PR2 (rule recorded in spec 1.1.2 §0b.1)
- Each shared surface is owned by one list. #3 (this list) owns: `/api/posts*` routing (PW1-PW5), the posts 3-header set and the dual-secret test (PW11, PW15), and the cross-PR guarantee that posts requests carry no `Cookie`/`Authorization` even for a signed-in browser (PW11, PM9). PR2 owns `/api/auth/*`, `/api/daily-fix/comments`, `/api/daily-fix/leaderboard` and its Daily Fix header test.
- The second PR to merge re-runs the other list's routing and grep cases, including the App.tsx/KNOWN_ROUTES route tests and the PX1 B2 grep (keeping both pattern sets); CQ reviews that rebase (W5-R). Neither list counts the other's items.
- CQ19: the second-merge re-run also covers **#7** (may delete `document-base.test.ts`, may touch `KNOWN_ROUTES`) and **#10** (the ci.yml B2 step that A22/PX1 extends): after either merges, PC1-PC4 route tests and PX1 are re-run on the #3 head.
- PR2 has login and comment posting; #3 has neither ("posts" here are read-only BSI articles).

## Decided values (spec 1.1.2 §0b), where each lands
- Q1 raw-string page check, `%31` → 400: PW7. Q2 case-variant `page` → 400: PW9, PM51. Q3 whitespace key = missing, never trimmed: PW14. Q4 list 404 → 503: PW19. Q5 truncate to 500 code points: PW25, PM52. Q6 keep first: PW27, PM53. Q7 explicit port → null (raw string): PW29, PW43, PM55. Q8 normalized href emitted: PW29, PS4, PS5, PW43. Q9 whole body, 1,048,576 UTF-8 bytes, streaming: PW42, PM54. Q10 attribute allowlist: PS3. Q11 external = origin ≠ metfix.org, mailto no target: PS4. Q12 drop `img` / drop whole `srcset`: PS5. Q13 absolute og:image fallback: PH8. Q14 `/posts/` → 301 keeping query: PH11. Q15 `test-posts-key` in B2: PX1. Q16 client page 1 + replaceState: PC17.
- G1 empty page + Older link: PC9. G2 resolve relative and fragment hrefs: PS4. G3 log mechanism: PW16 (redaction test), PX7 (rg rule). G4 `toISOString()`: PW25. **G5 closed**: order preserved, PW44, PM49. G7 list description: PH3, PC15. G8 HEAD = GET on a miss: PW4.
- **Closed by 1.1.5 §0d defaults (follow-up PRs only if BSI answers differently, CQ21):** G6 → Worker-computed `has_more` from `meta.total` (PW21, PW23, PW26, PM18, PM71, PM72); G9 → fail closed, shown only when `is_exclusive === false` and `access_levels` is `[]` (PW30 unchanged, PD6 post-deploy); Q-BSI-8 → images exactly `brokenscience.org` (PW35, PW43, PS5, PH8 unchanged). Deploy-only blockers: PD1 (Ethan's own words) and the posts key (A30).
- Disagreements with 1.1.2: none. QA notes one item for awareness: Q7/PW29 decides the port on the raw string while Q8 emits the normalized href; the two are consistent (a raw `:443` is rejected before normalizing) and PM55 guards it.

## Disagreements with 1.1.12
- None new. The 1.1.11 PM82 red-set disagreement moves to the gate (GM75 {HM1-stale} matches §R5). Retired RS4s3's success-path clause has no spec home; QA kept it in gate HM3 and flagged it there.

## Disagreements with 1.1.11
- **PM82 red set.** §0i: "**PM82** setup skips the fetch whenever `origin/main` exists, with no freshness check (red {RS4s1}; the RS4s1-stale planted-ref case belongs here)." With RS4s1-stale a separate gate ID, the exact red set is **{RS4s1-stale}**; RS4s1 (fresh-ref fixture) stays green. Spec to record {RS4s1-stale}.
- Closed by §0i: stale `origin/main` (F1); PM81/PM82 as s1-killers; per-test guards (PM78 exact). Closed earlier: R-A, R-B.

## Results
§R1: not run (pre-round-1; PR not yet retargeted onto main).

```gate-ids
PW1
PW2
PW3
PW4
PW5
PW6
PW7
PW8
PW9
PW10
PW10b
PW11
PW12
PW13
PW14
PW15
PW16
PW17
PW18
PW19
PW20
PW21
PW22
PW23
PW24
PW25
PW26
PW27
PW44
PW28
PW29
PW30
PW31
PW32
PW33
PW34
PW35
PW43
PW36
PW37
PW38
PW39
PW40
PW41
PW45
PW42
CK-N1
PS1
PS2
PS3
PS4
PS5
PS6
PS7
PS8
PS9
PH1
PH2
PH3
PH4
PH5
PH6
PH7
PH8
PH9
PH10
PH11
PH12
PH13
PH14
PH15
PC1
PC2
PC3
PC4
PC5
PC6
PC7
PC8
PC9
PC10
PC11
PC12
PC13
PC14
PC15
PC16
PC17
PC18
PC19
PC20
PW46
PX1
PX1.r
PX2
PX3
PX4
PX6
PX7
PX8
PX9
PX10
```

```box-ids
PB1
PB2
PB3
CK-P1
```

```post-deploy-ids
PD1
PD2
PD3
PD4
PD5
PD6
PD7
```

Test-list sign-off only; merge needs Ethan's go.
