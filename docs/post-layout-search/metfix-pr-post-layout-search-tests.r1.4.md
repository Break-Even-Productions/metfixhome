# QA test list: metfixhome draft PR, post body layout + Search page + Sanity topics, rev 1.4 (round 1)

- Author: MetFix Web QA. Box-only file; no repo changes, no PR, no comments.
- **Spec pin (one-way): acceptance rev 1.0.6, md5 `1809c3bc747e4af8f6dc5e0bd51ef16a`** (verified on the box 2026-10-22 ~11:22 PM PT; 59 IDs, PL6 retired; §0d D1–D6 over §0c over §0b). Base main `5465f0d8`, read-only.
- Rev 1.4, 2026-10-22 ~11:25 PM PT (QA). Re-pin 1.0.4 → 1.0.6 (1.0.5 C1–C5 and 1.0.6 D1–D6, relayed from Web Lead). r1.3 (`69be384b09b81b1624007db328925a07`) kept at `metfix-pr-post-layout-search-tests.r1.3.md`. LB6 retired (PL6, D3). New LB11 (PL12), SS21 (SR19), LM30. CQ-T2 rewritten to D6 (no hide/visibility module may exist; the r1.3 'filter is identity' unit is no longer required). SS6/SS13 already followed C1. KNOWN_ROUTES: verified SS16 already allowed exactly the one `"library"` line; SS21 now asserts it positively. No other row asserted `const.ts` unchanged. Nothing else loosened.
- **Approval status (relayed).** E4 lock-not-hide is recorded as **ruled** on QA's list: Web Lead reports Ethan told MetFix CEO "Yes they still see a lock" (relayed, spec C5). E1 route and E2 topics likewise relayed. Not confirmed to QA directly; merge still needs Ethan's direct go.
- Rev 1.3, 2026-10-22 ~10:55 PM PT (QA). Re-pin 1.0.3 → 1.0.4. r1.2 (`f098c197f45e5edafc22128ac79125a8`) kept at `metfix-pr-post-layout-search-tests.r1.2.md`. Route renamed `/search` → `/library/search` in every row. Rewritten to the rulings: SS5–SS10, SS13, SS16, SS18, SS19, SN-T1, SN-T3–SN-T7, SC-T3, CQ-T2, TC-T1, TC-T2, TC-T3, PD-T1, PD-T3, PD-T4. New: SS20 (SR18), SC-T7 (SEC7), TC-T8 (TC8). Relaxed **only where a ruling requires it**: the hide assertions (E4), the 8-default fallback (E2), the type-tab rows (E3), the `KNOWN_ROUTES` no-change check (Web Lead's OQ-13 pick, relayed). Mutants retired: LM1, LM13, LM14, LM15, LM19, LM20, LM21. New: LM23–LM29.
- Rev 1.2, 2026-10-22 ~10:50 PM PT (QA). Re-pin 1.0.1 → 1.0.3; applies R10–R13 (Web Lead rulings, relayed; not Ethan's approvals). r1.1 (`204cf8df18a6327b7469fb638c7d7ebe`) kept at `metfix-pr-post-layout-search-tests.r1.1.md`. Rows changed to the new behaviour: SS5, SS8, SS9, SS10, SS13, SN-T1, SN-T3, SN-T6, SN-T7, TC-T2, PD-T3. New: SS18 (active tab / pill lighting), SS19 (one type value). Mutants: LM15 re-cut; new LM19–LM22. No assertion loosened; the only removal is SS5's two-value check, which R11 made wrong behaviour (it is now inverted into SS19).
- Rev 1.1, 2026-10-22 ~10:45 PM PT (QA). Re-pin 1.0 → 1.0.1; applies §0a R1–R9 (Web Lead rulings, relayed; not Ethan's approvals). r1.0 (`96d21c849dfe833027626568961d0b8c`) kept at `metfix-pr-post-layout-search-tests.r1.0.md`. No assertion loosened; rows changed only where the spec changed the behaviour (SS4, SS5, SS8, SS13, SS16, SN-T1, SN-T2, SN-T3, SN-T5, SN-T6, SC-T2, SC-T3, TC-T1, TC-T3, PD-T3, PD-T4). New: SS17, SN-T7, TC-T1b, CQ-T1, CQ-T2, CQ-T3; mutants LM13–LM18; LM12 retired.
- **SEC3 (r1.4):** lock-not-hide, ruled (relayed). SC-T3, TC-T3, CQ-T2, SC-T7, PD-T4 are written to it.
- Counts: **gate 58 [CI]**, **box 6 [BOX]**, **post-deploy 5 [POST]**, **mutation catalogue 21 live (+8 retired)**, **targeted 10 (advisory)**, **gating mutations 0**.
- Spec coverage: 59/59 IDs (PL6 retired: mapped to its retired row LB6, no gate).
- Bar (Ethan, 2026-10-22, in this chat): lean and practical. Block only on real breakage, security problems and weakened tests. Pixel nits are follow-ups, not blockers. Test-list sign-off only; merge needs Ethan's go.
- Rules: never weaken an assertion. Each row states exact values, call counts or text. "Renders" is not a pass. Existing posts and library tests must pass **unchanged** (a diff to an existing assertion is a blocker unless Web Lead rules it in).

## Conventions
- [CI] runs in `npm test` / `tsc` / `check:worker` / a ci.yml step. [BOX] QA box evidence (headless Chrome, local build, mutations). [POST] after preview/prod deploy, never a merge gate.
- `fetchMock` records every request URL (with its search params decoded) and headers. `sanityMock` stubs `sanityClient.fetch` and records the GROQ string and call count.
- Grounding at main `5465f0d8`: `CONTENT_TYPE_CHIPS` = articles, videos, webinars ("Live Streams"), whiteboards ("Coach Briefings"), journal-clubs, infographic, book-report. `SearchParams.topics` is `number[]` (term ids); `content_type_terms` is `string[]` (slugs). `isFreeOpen` in `shared/library/access.ts:70`. `QUERY_MAX = 120`. `sanityClient` is `useCdn:true`, `perspective:"published"`. Body classes `.posts-detail-content` (posts.css:269) and `.library-reader-body` (library.css:522).
- Style tolerance: ±1px for lengths; colours compared as computed strings after normalising to oklch/rgb.

## A. Post body layout [CI unless marked]
Style rows run as a headless computed-style test (TC5) on a fixture post with: 6 paragraphs, an inline image 2000px wide, a 300-char unbroken URL, a hero image. Each row runs for **both** `/posts/:id` and `/library/:type/:id` (OQ-3; if Web Lead rules one out, drop that half, do not loosen).
- **LB1** (PL1) At 1440px and 768px, body element `getComputedStyle().maxWidth === "680px"` and `getBoundingClientRect().width` is 680 (±1). At 390px width === 390 − 32 = 358 (±1).
- **LB2** (PL2) Body `p`: fontFamily starts with `"DM Sans"`, fontSize `16px`, lineHeight `26px`, fontWeight `400`. Fails if it is still `Plus Jakarta Sans` or 1.05rem/1.7.
- **LB3** (PL3) Second `p` marginTop+previous marginBottom gap = 16px (measured as rect.top(p2) − rect.bottom(p1) = 16±1); first child marginTop `0px`.
- **LB4** (PL4) H1: fontFamily starts `"Playfair Display"`, 36px, lineHeight 45px, weight 700, marginBottom 16px at 1440px.
- **LB5** (PL5, PL9) Meta line fontSize 13px DM Sans, marginBottom 24px; breadcrumb (when present) 13px DM Sans, marginBottom 24px. If the page has no breadcrumb, the row asserts it is absent on main too (no new element required).
- **LB6** (PL6) **Retired r1.4 (D3: hero out of scope).** ID not reused; not in a gate block.
- **LB11** (PL12, D2) If `post-prose.css` exists: repo grep (`rg -l "post-prose\.css" client/`) lists exactly two importers, `client/src/pages/posts/PostDetailPage.tsx` and `client/src/pages/library/LibraryDetailPage.tsx` (no `main.tsx`, `App.tsx`, `index.css`, `LibraryPage`, `SearchPage` or `ResourceCard`). Every selector in it is scoped under `.posts-detail-content` or `.library-reader-body` (no bare `p`, `h1`, `body`, `img`). Mount `/library` list: `ResourceCard` title/excerpt computed `fontFamily` equal to main's values.
- **LB7** (PL7) Inline 2000px image: rendered width ≤ body width (680 at 1440, 358 at 390), computed height `auto` ratio preserved (h/w equals natural ratio ±0.01).
- **LB8** (PL11) At 390px, `document.documentElement.scrollWidth <= 390`; the 300-char URL's container width ≤ body width; body `overflowWrap === "anywhere"`.
- **LB9** (PL8) Body h2/h3/blockquote/figcaption/ul computed fontFamily/weight equal main's values (snapshot from `5465f0d8` run of the same fixture); no new hard-coded size appears for them in the diff (grep the CSS diff for `blockquote|figcaption|h2|h3` under the two body selectors: any new px value = FAIL unless OQ-1 is ruled).
- **LB10** (PL10) The existing posts and library test files (`client/src/pages/posts/**.test.*`, `client/src/pages/library/**.test.*`) are byte-identical to main or only add tests; `git diff 5465f0d8 -- <those files>` shows no removed or altered `expect(` line. Locked/preview fixture still shows the same lock/join copy as main, and `SafeHtml` still strips `<script>` and `onerror=` from the fixture (the existing sanitiser tests stay green).

## B. Search page [CI unless marked]
Mount tests render `/library/search` with `fetchMock` returning `{items:[3 cards], meta:{total:3}}`, `/api/library/filters` returning `topics: [{id:11,name:"Metabolic Health"},{id:12,name:"Coaches"},{id:13,name:"Women's Health"}]`, and `sanityMock` returning `searchTopics: [{topic_id:13,label:"Women's Health & Hormones"},{topic_id:99,label:"Professional Library"}]`.
- **SS1** (SR1) Breadcrumb text in order `HOME`, `RESOURCE LIBRARY`, `SEARCH`; HOME `href="/"`, RESOURCE LIBRARY `href="/library"`; SEARCH is not a link and has `aria-current="page"`.
- **SS2** (SR2) Exactly one `h1` with text `Search All Resources`; computed textAlign `center`, Playfair, weight 700 (style check in TC5 at 1440: fontSize 48px; 390: 28px).
- **SS3** (SR3) Input has placeholder exactly `What are you looking for?` and a non-empty `aria-label`; `maxLength === 120` (SEC5).
- **SS4** (SR4) Type `keto` + Enter → exactly 1 new search fetch with `query=keto`; type `fat` + click SEARCH → exactly 1 new fetch with `query=fat`. Clear (×) is absent with empty input, present after typing; clicking it empties the input, makes **0** fetches and leaves `?query=` unchanged until the next submit (SR4 B2). Typing 10 characters makes **0** search fetches and does not change `location.search`; one submit then makes exactly 1. Fake timers advanced 2s after typing: still 0 (no debounce search).
- **SS5** (SR5) Pill labels in DOM order exactly `All Types, Videos, Articles, Live Streams, Infographics`; on load only All Types has `aria-pressed="true"` and the fetch has **no** `content_type_terms[]`. Clicking each pill gives exactly one `content_type_terms[]` value: Videos→`videos`, Articles→`articles`, Live Streams→`webinars`, Infographics→`infographic`; exactly one pill pressed after each click. Pill slugs come from `CONTENT_TYPE_CHIPS` (diff check: no second literal list of these four slugs in new client code).
- **SS6** (SR6) Tab bar: first tab `All`, selected on load (`aria-selected="true"`), fetch has no `topics[]`. After every click in SS8/SS18, exactly 1 tab has `aria-selected="true"` (except the SR13 unknown-id case, OQ-Q14). TC5 style: `position: sticky`, `top: 0px`, `overflowX: auto`, tabs `whiteSpace: nowrap`; active tab borderBottomWidth 2px and colour = gold; inactive border colour transparent.
- **SS7** (SR7, E2) With the mocks above, tab labels are exactly, in order: `All, Women's Health & Hormones, Professional Library, Metabolic Health, Coaches` — Sanity first in Sanity order, then API in API order, id 13 shown once with the Sanity label, no `Women's Health` label anywhere. Reversing the Sanity mock reverses the first two only. An API list of 15 topics shows all 15 (no cap).
- **SS8** (SR8, E3) (a) Query `keto`, pill Videos, click Metabolic Health → last fetch `/api/library/search` with params exactly `query=keto`, `content_type_terms[]=videos`, `topics[]=11`; URL `type=videos&topic=11`; Videos still pressed. (b) Click Professional Library (Sanity-only) → `topics[]=99` only. (c) Click All → no `topics[]`, `content_type_terms[]=videos` kept, Videos still pressed. No tab click triggers `/api/library/filters` or Sanity, and no request goes to any other path.
- **SS9** (SR9) Count line text, n = `meta.total`: total 3 + tab Metabolic Health → `3 resources in Metabolic Health`; tab id 13 → `… in Women's Health & Hormones` (Sanity label); total 1 → `1 resource`; total 2 + query `fat` → `2 resources for "fat"`; total 0 → `0 resources`; pill Videos with tab All → `3 resources` (no ` in `). Fixture with 3 items, total 40 → `40 resources` (not items.length).
- **SS10** (SR10) "Clear filters" absent on load; present after each of: query set, non-All tab, non-All pill. Clicking it → input empty, All Types and All selected, exactly 1 new fetch with no `query`, `content_type_terms[]` or `topics[]`, and the control is gone.
- **SS11** (SR11) Results render as `ResourceCard` (the card's existing test id/class), 3 cards for 3 items. Grid columns via TC5: 1 at 390, 2 at 640, 3 at 1024; columnGap 20px. Pager: with `has_more` true, the existing `useInfiniteArchive` load-more fires a fetch with the next offset; the PR adds no new pager component (diff check: no new file matching `*Pag*`).
- **SS12** (SR12) `items:[]`, total 0 → text `No results found` and `Try a different search term or browse by category above.` Fetch rejects / 500 → a retry button; clicking it makes exactly 1 new fetch; no state where the results region is empty with no message.
- **SS13** (SR13, R4, E3) URL `/library/search?query=fat&type=videos&topic=11` → input `fat`, Videos pressed, Metabolic Health selected, first fetch carries all three. Live Streams writes `type=webinars`. Fallback to All, with the param absent from the fetch, for: `type=Live%20Streams`, `type=bogus`, `type=whiteboards` (not a pill slug), `topic=0`, `topic=-3`, `topic=1.5`, `topic=abc`. `topic=555` (valid integer, not in the tab list) → fetch sends `topics[]=555` and the All tab is **not** selected (SR13). Changing a filter pushes history; `history.back()` restores the previous tab, pill and fetch params.
- **SS18** (SR5, SR6, SR8, E3) Pills and tabs independent: tab 11 then pill Articles → tab 11 still selected, URL `type=articles&topic=11`, fetch has both. Pill Infographics then tab 12 → Infographics still pressed. Pill All Types → topic unchanged. At every step exactly 1 pill pressed and (except `topic=555`) exactly 1 tab selected.
- **SS19** (SR5, TC2) One type value: across every action sequence in SS8, SS13, SS16 and SS18 (recorded fetch log), no `/api/library/search` request has more than 1 `content_type_terms[]` entry or more than 1 `topics[]` entry.
- **SS20** (SR18, E1) Direct load: (a) Workers runtime test: `GET /library/search` and `/library/search?query=x` → 200, `content-type` text/html, body is the SPA shell (same bytes as `GET /library`'s shell), not the Worker 404 body. (b) Mount at that URL → the search page's h1 `Search All Resources` renders; `LibraryDetailPage` and NotFound are not mounted (route order: `/library/search` matched before `/library/:type/:id`). (c) With router base set via `getRouterBase()` for `/library/search`, the base is `""` (or main's root value), not `/library`.
- **SS21** (SR19, C3) `git diff 5465f0d8 -- client/src/const.ts` is exactly one added line `"library",` inside `KNOWN_ROUTES` and nothing else. Unit: `getRouterBase()` returns `""` for `/library`, `/library/search` and `/library/post/1` at the root; the existing const/router tests unchanged and green; one added case for `/library/search`.
- **SS14** (SR14, PL11) At 390px: `documentElement.scrollWidth <= 390`; tab bar `scrollWidth > clientWidth` allowed; pill container `flexWrap === "wrap"`.
- **SS15** (SR15) Pills are `<button>` with `aria-pressed`; tabs are `<button role="tab">` with `aria-selected` inside `role="tablist"`; keyboard Tab reaches pills and tabs; focused element has a non-`none` outline or box-shadow (`:focus-visible`).
- **SS16** (SR16, E1) Mount `/library`, Videos chip active, type `  keto  ` in its search form, submit → SPA navigation (no `location.assign`/reload; `window.location` spy 0 calls) to exactly `/library/search?query=keto&type=videos`; then the search page's first fetch has `query=keto` and `content_type_terms[]=videos`. Chip not one of the 4 pill slugs (e.g. `journal-clubs`) → `type=` absent. Empty submit → `/library/search` with no `query=`. `/library`'s existing tests stay green unchanged. Diff vs `5465f0d8`: in `client/src/const.ts` the only change allowed is adding `"library"` to `KNOWN_ROUTES` (one line; Web Lead's OQ-13 pick, relayed); no change to `Map.tsx` or header/footer/nav; the search module graph does not import `Map` (built chunk grep for `VITE_FRONTEND_FORGE` = 0).
- **SS17** (SR17, B3) Mount with a `fetchMock` that records each call's `signal`. (a) Load → exactly 1 un-aborted search fetch (under StrictMode the first may be aborted; exactly 1 completes). (b) Click tab A then tab B in the same tick → A's signal `aborted === true`, B's not; resolve A after B → only B's cards in the DOM (1 result set). (c) Click the already-selected tab, or re-submit the same query → 0 new fetches. (d) Grep of new /library/search code: 0 direct `fetchLibrarySearch` call sites (only via `useInfiniteArchive`). (e) `resetKey` is equal for `?topic=101&query=a` and `?query=a&topic=101`.

## C. Sanity topics [CI unless marked]
- **SN-T1** (SN1, E2) Schema unit test on `sanity/schemaTypes/siteSettings.ts`: `searchTopics` is an `array` of object with exactly the fields `topic_id` (number, required, integer, > 0) and `label` (string, optional). A row missing `topic_id`, or with 0, -1, 1.5, fails validation; a row with `topic_id:13` and no label passes. No `Rule.max` (20 rows pass). No `kind`, `typeSlug` or `bsiTermId` field. Field is in group `search`. No new `_type` document under `sanity/schemaTypes` (diff check).
- **SN-T2** (SN3, B1) `SITE_SETTINGS_QUERY` in `client/src/lib/content.ts` contains `searchTopics[]{topic_id,label}` and `fetchSiteSettings` maps it. No other GROQ string in new code references `searchTopics` (grep = 1 site). Diff grep for `createClient(` outside `client/src/lib/sanity.ts` = 0. The call count (exactly 1) is asserted in TC-T1b.
- **SN-T3** (SN4, TC1, E2) Tab resolver unit `(sanityRows, apiTopics)` → exact `[{id,label}]` list (All not included): (a) Sanity [13 "WH&H", 99 "PL"], API [11,12,13] → [13 WH&H, 99 PL, 11, 12] (dedupe by id, Sanity label wins, Sanity first); (b) Sanity missing, `[]` or rejected → API list exactly, in API order; (c) API rejected or `[]` → Sanity rows only; a Sanity row with no label → `Topic 99`; (d) both empty/rejected → `[]` (page shows only All); (e) invalid Sanity rows (no `topic_id`, 0, -2, 1.5, `"13"`) skipped one at a time, valid neighbours kept in order; (f) duplicate Sanity ids [13 "A", 13 "B"] → one entry, label `A`; (g) an API topic with no Sanity label uses API `name`. No hardcoded label list appears in the resolver module (grep the 8 example labels = 0).
- **SN-T4** (SN4, E2) Mount: Sanity rejects + filters 500 → tab bar has exactly 1 tab, `All`, selected; search still fires once; no console.error. Sanity rejects only → All + the 3 API tabs. Filters 500 only → All + the 2 Sanity tabs (labels from Sanity; `Topic {id}` where unlabelled). `isSanityConfigured=false` = Sanity missing.
- **SN-T5** (SN5, B4) One `fetchLibraryFilters` promise per module instance shared with LibraryPage: mount `/library` then navigate to `/library/search` → exactly 1 `/api/library/filters` fetch total; 3 tab clicks add 0. With `topic=11` in the URL and filters pending (never resolved), the first search fetch fires with `topics[]=11` (not held).
- **SN-T6** (SN6, E2) No seeding and no defaults: `git diff 5465f0d8 -- scripts/seed-sanity.ts` adds no `searchTopics`; grep of the diff outside `*.test.*` and `docs/` for any of the 8 example labels (`Metabolic Health`, `Special Populations`, `Women's Health`, `Professional Library`, `Whiteboards`, `Coaches`, `BSI Educators`; `Infographics` excluded as a pill label) = 0 hits.

- **SN-T7** (SN7, retired by spec, review row kept) [QA checks at round 1] The PR body lists the topics the preview filters read returned (names and ids) and the read time, with no `X-API-Key`, token or credentialed URL. Missing list is a follow-up, not a blocker (no longer drives shipped ids).

## D. Security [CI]
- **SC-T1** (SEC1, TC7) After `npm run build`, grep `dist/` for `wp-json` and `brokenscience.org/wp-json` → 0 hits. In mount tests every `fetchMock` URL starts with `/api/library/`.
- **SC-T2** (SEC2, TC7) `client/src/lib/sanity.vite-guard.test.ts` unchanged and green; `dist/` grep for `VITE_SANITY_API_READ_TOKEN` and `/sk[A-Za-z0-9]{40,}/` → 0 hits; no new `import.meta.env.VITE_` name in the diff (0 added); /library/search does not import `Map.tsx` (SS16).
- **SC-T3** (SEC3, E4 — **relayed; Ethan's direct confirmation pending, required before merge**) Mount, logged out, page of 5 items, `meta.total: 40`, `has_more: true`: 3 open, `EXCL-A` (`is_exclusive:true`), `GATE-B` (`has_content_access:true`). → exactly 5 cards in fixture order; `EXCL-A` and `GATE-B` carry the same lock badge element as `/library` (`isLockedCard` true for exactly those 2); count `40 resources`; load-more fetches `offset=5`. Clicking `EXCL-A` opens `JoinModal` (role dialog present), `location.pathname` unchanged, and 0 `/api/library/item/*` fetches. Signed in with access → 0 lock badges. Grep: `isFreeOpen` not referenced in the search page module.
- **SC-T7** (SEC7, E4 guard) Fixture locked item carries sentinel extra fields the upstream must not need: `content:"GATED-BODY-91"`, `video:"https://media.example/GATED-VID-91.m3u8"`, `excerpt` normal. Logged out: the sentinel strings appear nowhere in the DOM (text, `href`, `src`, `data-*`), in any request URL made after click, or in `console.*`. The search response mapping (`LibraryResource`) has no `content`/`video` key (type test: `// @ts-expect-error` on `r.content`). Locked card's only anchor/click target opens `JoinModal`, never `/library/<type>/<id>` body. Item route's own locking tests on main stay green unchanged.
- **SC-T4** (SEC4) `git diff 5465f0d8 -- worker/` adds no route, no new upstream header, no new secret binding (`wrangler.*` diff shows no new `vars`/secrets); existing `worker/library` tests unchanged and green.
- **SC-T5** (SEC5) Input `maxLength` 120; pasting 200 chars sends a `query` of length ≤ 120. Query `<img src=x onerror=alert(1)>` shows as literal text in the count line, and `document.querySelectorAll('img[onerror]').length === 0`.
- **SC-T6** (SEC6) In all new tests, `console.*` spies record no string matching `token|X-API-Key|sk[A-Za-z0-9]{20}`; PR body checked by QA at review (box note in BX-6).

## E. Test-suite rows [CI]
- **TC-T1** (TC1) = SN-T3 (cases a–g) + SN-T4 present as named tests.
- **TC-T1b** (TC1b, B1–B3) Mount nav + footer + /library/search together: `sanityClient.fetch` called **exactly 1** time (`vi.resetModules()` between tests; no prod reset export, CQ rule 4). Typing 10 chars → 0 search calls; submit → exactly 1. Two quick tab clicks → first signal aborted, 1 rendered result set.
- **TC-T2** (TC2, E3) Unit on the state→params/URL reducer: All/All/no query → no filter params; each of 4 pills × {All, tab 11} → exact param sets (8 cases), and changing the pill keeps the tab / changing the tab keeps the pill; invalid URL `topic`/`type` values per SS13 → All; `topic=555` kept; count-line cases per SS9. Every output has ≤ 1 type value and ≤ 1 topic (SS19).
- **TC-T3** (TC3, E4) = SC-T3 + SC-T7 (mount, mirrors /library's card test). Pending Ethan's direct E4 confirmation.
- **TC-T4** (TC4) Mount: DOM order of breadcrumb, h1, input, SEARCH button, pills, tab bar, count line, Clear filters, grid (`compareDocumentPosition` chain) + SS10.
- **TC-T5** (TC5) The headless computed-style test exists in CI (or a ci.yml step) covering LB1, LB2, LB4, SS2, SS5, SS6 at 1440 and 390 (LB6 dropped with PL6), ±1px. If the Project makes it box-only, it moves to BX-1 and is not dropped.
- **TC-T6** (TC6) `npm test`, `tsc --noEmit`, `npm run check:worker` exit 0; skip count not higher than main's (no new `.skip`/`.todo`/`it.only`).
- **TC-T7** (TC7) Bundle scan step exists in CI and fails on a planted `wp-json` string (proved once by BX-4).
- **TC-T8** (TC-mutation note) The mutation set exists as patches under `docs/<feature>/mutations/` or QA box only; never in a gate block.
- **TC-T9** (TC8, SR16, SR18) = SS16 (handoff with Videos → `/library/search?query=q&type=videos`) + SS20(b) (renders the search page, not `LibraryDetailPage`) as named tests.

### CQ pre-build checks folded in [CI]
- **CQ-T1** (call counts; SN3, SN5, SR4, SR17) One /library/search page load with nav+footer: exactly 1 Sanity settings read, ≤ 1 `/api/library/filters`, exactly 1 `/api/library/search`. A tab click, a pill click and a submit each add exactly 1 search and 0 Sanity / 0 filters. Load-more adds exactly 1 search per page.
- **CQ-T2** (SEC3, D6) No hide filter remains: the diff adds no file matching `*isibility*` or `*hide*` under `shared/` or `client/`, and no exported function that filters results by access; `isFreeOpen` is not imported by any search module; the array handed to the card grid is the hook's `items` (grep: no `.filter(` over results in `SearchPage.tsx` keyed on `access`). Mount: logged-out and signed-in fixtures render the same card count and order as upstream `items`.
- **CQ-T3** (dist grep; SEC1, SEC2, TC7) A CI step after `npm run build` greps `dist/` and fails on any hit for `wp-json`, `brokenscience.org/wp-json`, `VITE_SANITY_API_READ_TOKEN`, `/sk[A-Za-z0-9]{20,}/`. No `|| true` on the step; proved by BX-4.

## Box-only [BOX]
- **BX-1** Headless Chrome 1440/390 screenshots and computed-style dump for LB1–LB8, SS2, SS5, SS6, SS11 on a local build; md5 of the dump recorded.
- **BX-2** Reproduce counts: clean `npm ci`, `npm test`, `tsc`, `check:worker`; report pass/fail/skip.
- **BX-3** Weakened-test diff: `git diff 5465f0d8..<head> -- '**/*.test.*'` reviewed; any removed or loosened `expect` is a blocker.
- **BX-4** Plant `"https://brokenscience.org/wp-json/x"` in a client file on a scratch branch → TC-T7 / SC-T1 go red; revert, porcelain clean.
- **BX-5** Run the targeted mutants (below), each alone, exact red set, revert.
- **BX-6** PR body and test output grep for tokens/credentialed URLs (SEC6).

## Post-deploy [POST] (never merge gates)
- **PD-T1** (PD1) Preview `/library/search` by direct load and from the `/library` search box: All + the API/Sanity tabs, 5 pills, placeholder exact; click a tab → count text changes and contains ` in <Tab>`.
- **PD-T2** (PD2) DevTools network on preview: request hosts only the metfix origin (`/api/library/*`) and `*.apicdn.sanity.io`; 0 requests to `brokenscience.org/wp-json`; Sanity requests carry no `Authorization` header.
- **PD-T3** (PD3, SN2) Studio on a **preview dataset only**, never prod: add one `searchTopics` entry with an existing API topic id and a custom label → within ~60s, no deploy, it is first in the bar with the custom label and the API's copy of that id is gone (no duplicate). Remove it → API order returns exactly.
- **PD-T4** (PD4, E4) Logged out on preview: search a known exclusive title → it appears with the lock badge; click opens the join modal; DevTools network shows no body/media URL for it. Ethan's direct OK on E4 must be on record before merge.
- **PD-T5** (PD5) Long BSI post at 1440 and 390 vs reference, PL1–PL5 and PL7, screenshots on the PR (Web Lead posts them; QA does not).

## Mutation catalogue [BOX] (reference; exact red sets) with advisory targeted set
Gating 0. Run each alone against only the files holding its red set. Targeted marked ★.
| ID | Patch (realistic mistake) | Red set (exact) |
|---|---|---|
| LM1 | Retired 1.3 (no defaults under E2); ID not reused | — |
| ★LM2 | Hide filter left in (`items.filter(isFreeOpen)` before the grid) — locked items dropped | SC-T3, CQ-T2, PD-T4† |
| ★LM3 | Count line always plural (`resources`) | SS9, TC-T2 |
| ★LM4 | Live Streams maps to `videos` instead of `webinars` | SS5, TC-T2 |
| LM5 | Resolver drops all Sanity rows if any row is invalid (instead of skipping that row) | SN-T3 |
| LM13 | Retired 1.3 (filtered count gone under E4) | — |
| LM14 | Retired 1.3 (filtered offset gone under E4) | — |
| LM15 | Retired 1.3 (type tabs retired, E3) | — |
| LM16 | `fetchSiteSettings` not memoised (each caller fetches) | TC-T1b, CQ-T1 |
| LM19 | Retired 1.3 (type tabs retired, E3) | — |
| LM20 | Retired 1.3 (type tabs retired, E3) | — |
| LM21 | Retired 1.3 (type tabs retired, E3) | — |
| LM22 | `topic=` parsed with `parseInt` (accepts `1.5`, `101abc`) | SS13, TC-T2 |
| ★LM17 | A second effect calls `fetchLibrarySearch` directly on tab change (double fetch, no abort) | SS17, TC-T1b, CQ-T1 |
| LM18 | Search fires on each keystroke (input bound straight to the URL) | SS4, TC-T1b |
| LM6 | Clear filters resets query and pill but not the tab | SS10, TC-T4 |
| LM7 | Count uses `items.length` instead of `meta.total` | SS9 |
| LM8 | Body `max-width` set on the page container not the body (body becomes 797px at lg) | LB1, TC-T5 |
| LM30 | `post-prose.css` imported globally (in `main.tsx`) instead of by the two detail pages | LB11 |
| LM9 | Unknown `?type=` passed through to the fetch | SS13 |
| LM10 | Tabs sorted alphabetically instead of source order | SS7, SN-T3 |
| LM11 | `maxLength` removed from the input and no slice on submit | SS3, SC-T5 |
| LM12 | Retired 1.1 (SN5 slug check removed by R2); ID not reused | — |
| ★LM23 | Locked card renders the item link/media from upstream (`href` to `/library/<type>/<id>` or `r.video`/`r.content` passed into the card) — gated URL reaches the DOM | SC-T7, SC-T3, TC-T3 |
| ★LM24 | Merge concatenates Sanity + API without dedupe (id 13 shown twice) | SS7, SN-T3, PD-T3† |
| ★LM25 | Merge puts API topics first, Sanity after (`[...api, ...sanity]` then dedupe) | SS7, SN-T3, SS9 |
| ★LM26 | Handoff navigates to `/library/search` without `query` (or with untrimmed `q`) | SS16, TC-T9 |
| ★LM27 | Both sources empty → falls back to a hardcoded topic list (spec mutant) | SN-T3, SN-T4, SN-T6 |
| ★LM28 | Selecting a tab resets the pill to All Types (old R11 reset kept) | SS8, SS18, TC-T2 |
| LM29 | Dedupe keeps the API `name` over the Sanity label (spec mutant) | SS7, SS9, SN-T3 |

Targeted 10: LM2, LM3, LM4, LM17, LM23, LM24, LM25, LM26, LM27, LM28. † = [POST] row, not run in BX-5 (red set for BX-5 excludes it). LM5 and LM8 moved to catalogue-only (r1.3), rows unchanged. Spec's 5 = LM27, LM29, LM3, LM4, LM26. Catalogue 21 live (LM2–LM11, LM16–LM18, LM22–LM30), 8 retired (LM1, LM12–LM15, LM19–LM21). LM2/LM23 follow the pending E4 confirmation. Red sets re-checked against r1.3 rows. A surviving targeted mutant is a finding to Web Lead, not a gate.

## Open questions (not guessed; rows stay as written until ruled)
- **OQ-Q14 (new, SR13 vs SR6)** SR6 says "exactly one tab is active"; SR13 says `topic=555` (not in the list) lights no tab, so zero are active. Rows follow SR13 for that one case. Confirm.
- **OQ-Q15 (new, SR9/SR10 leftovers)** SR9 still says "or a type tab matching `type`" and SR10 "a type tab counts as both" (R11 text), though E3 retired type tabs. Rows ignore those clauses. Spec cleanup only.
- ~~OQ-Q16~~ closed by C3/SR19 (KNOWN_ROUTES in scope). ~~OQ-Q14~~ closed by C1. ~~OQ-Q15~~ closed by C2. ~~OQ-Q17~~ closed by C4.
- **OQ-Q17 (new, TC1b wording)** TC1b still mounts "/search"; rows use `/library/search`.
- **Pending Ethan directly (QA chat):** E1 route + handoff, E2 topic source, E4 lock-not-hide (security exception; must be confirmed before merge).
- **OQ-Q1 (spec OQ-1)** Body H2/H3/blockquote/figcaption/list values: LB9 holds them to main's values until ruled.
- ~~OQ-Q2~~ ruled R1 (int id + kind). ~~OQ-Q4~~ ruled R2 (tabs show). ~~OQ-Q6~~ ruled R4 (slug). ~~OQ-Q5~~ ruled R3 (`kind:'type'`).
- ~~OQ-Q9~~ closed by R10 (type rows store `typeSlug`, send `content_type_terms[]`).
- ~~OQ-Q10~~ closed by R11 (`topic=` is integer ids only; type tabs use `type=`).
- ~~OQ-Q11~~ closed by R12 (`isFreeOpen` confirmed; spec OQ-10).
- ~~OQ-Q12~~ retired with spec OQ-11 (one type value).
- (history) **OQ-Q2 (SN1 vs main)** SN1 says `bsiTopic` is a slug string, SR8 says send the "BSI term id", and main's `SearchParams.topics` is `number[]`. Is the Sanity value a slug resolved to an id via `/api/library/filters`, or an id? SS8, SN-T5 and SN-T6 assert the resolved value once ruled.
- ~~OQ-Q3 (SEC3)~~ superseded by E4 (lock, `meta.total`), pending Ethan's direct confirmation.
- **OQ-Q4 (SN5)** When `/api/library/filters` fails, are unverifiable tabs shown or hidden?
- **OQ-Q5 (SR7/OQ-6)** "Whiteboards" and "Infographics" tabs overlap content types on main (`whiteboards` is labelled "Coach Briefings"; `infographic` is also a pill). Is Infographics tab + Infographics pill meant to be both a topic and a type filter?
- **OQ-Q6 (SR13 vs SR5)** URL `type=` takes the BSI slug (`webinars`) or the label? SS13 assumes the slug.
- ~~OQ-Q7~~ OQ-3/OQ-4 assumptions stand; OQ-5 answered by E1 (relayed, pending Ethan directly).
- **OQ-Q13 (CQ rule 4 vs SN-T5)** Testing "shared with LibraryPage" needs both in one module instance; QA uses `vi.resetModules()` only between tests, no prod reset export.
- **OQ-Q8 (TC5)** Is the computed-style test a CI test (needs a headless browser in CI) or box-only? TC-T5 accepts either, but it must exist somewhere.

## Spec ID coverage map (59/59)
PL1 LB1 · PL2 LB2 · PL3 LB3 · PL4 LB4 · PL5 LB5 · PL6 LB6 (retired) · PL7 LB7 · PL8 LB9 · PL9 LB5 · PL10 LB10 · PL11 LB8, SS14 · PL12 LB11
SR1 SS1 · SR2 SS2 · SR3 SS3 · SR4 SS4 · SR5 SS5, SS18, SS19 · SR6 SS6, SS18 · SR7 SS7 · SR8 SS8, SS19 · SR9 SS9 · SR10 SS10 · SR11 SS11 · SR12 SS12 · SR13 SS13 · SR14 SS14 · SR15 SS15 · SR16 SS16, TC-T9 · SR19 SS21 · SR17 SS17, TC-T1b, CQ-T1 · SR18 SS20, TC-T9
SN1 SN-T1 · SN2 PD-T3 · SN3 SN-T2 · SN4 SN-T3, SN-T4 · SN5 SN-T5, CQ-T1 · SN6 SN-T6 · SN7 SN-T7
SEC1 SC-T1, CQ-T3 · SEC2 SC-T2, CQ-T3 · SEC3 SC-T3, CQ-T2, PD-T4 · SEC7 SC-T7, TC-T3 · SEC4 SC-T4 · SEC5 SC-T5, SS3 · SEC6 SC-T6, BX-6
TC1 TC-T1 · TC1b TC-T1b · TC2 TC-T2 · TC3 TC-T3 · TC4 TC-T4 · TC5 TC-T5, BX-1 · TC6 TC-T6, BX-2 · TC7 TC-T7, BX-4 · TC8 TC-T9
PD1 PD-T1 · PD2 PD-T2 · PD3 PD-T3 · PD4 PD-T4 · PD5 PD-T5
(Spec's mutation set of 5 = LM27, LM29, LM3, LM4, LM26.)

```gate-ids
LB1
LB2
LB3
LB4
LB5
LB7
LB8
LB9
LB10
LB11
SS1
SS2
SS3
SS4
SS5
SS6
SS7
SS8
SS9
SS10
SS11
SS12
SS13
SS14
SS15
SS16
SS17
SS18
SS19
SS20
SS21
SN-T1
SN-T2
SN-T3
SN-T4
SN-T5
SN-T6
SN-T7
SC-T1
SC-T2
SC-T3
SC-T4
SC-T5
SC-T6
SC-T7
TC-T1
TC-T1b
TC-T2
TC-T3
TC-T4
TC-T5
TC-T6
TC-T7
TC-T8
TC-T9
CQ-T1
CQ-T2
CQ-T3
```

```box-ids
BX-1
BX-2
BX-3
BX-4
BX-5
BX-6
```

```post-deploy-ids
PD-T1
PD-T2
PD-T3
PD-T4
PD-T5
```

## Changelog
- r1.4 (2026-10-22 ~11:25 PM PT): re-pin to 1.0.6 `1809c3bc…`; LB6 retired, LB11/SS21/LM30 added, CQ-T2 to D6.
- r1.3 (2026-10-22 ~10:55 PM PT): re-pin to 1.0.4 `1c59b421…`; E1–E4 applied (relayed; Ethan's direct confirmation pending); see header.
- r1.2 (2026-10-22 ~10:50 PM PT): re-pin to 1.0.3 `020a837e…` (frozen); R10–R13 applied; see header.
- r1.1 (2026-10-22 ~10:45 PM PT): re-pin to 1.0.1 `d56220ee…`; R1–R9 and CQ B1–B6 applied; see header.
- r1.0 (2026-10-22 ~10:40 PM PT): first rev, pinned to acceptance 1.0 `5855043c…`.
