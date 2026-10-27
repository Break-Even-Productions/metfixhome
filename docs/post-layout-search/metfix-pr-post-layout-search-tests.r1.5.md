# QA test list: metfixhome draft PR #18, post detail + taxonomy pages + Search page + Sanity topics, rev 1.5 (round 3)

- Author: MetFix Web QA. Box-only file; no repo changes, no PR, no comments.
- **Spec pin (one-way): acceptance rev 1.1.0, md5 `c0e03cb45919d94bd52c0f5c55ab9fdb`** (verified on the box 2026-10-27 ~12:20 PM PT; 88 IDs across PL1–PL18, TX1–TX8, SR1–SR19, SN1–SN7, SEC1–SEC13, TC1+TC1b+TC2–TC14, PD1–PD8; §0f F1–F14 over §0e over §0d over §0c over §0b) + CQ pre-build notes `metfix-pr18-post-taxonomy-cq-prebuild.md` md5 `866f1df1441f99a9268857601de95d30` (`CQ-0`..`CQ-8`). Base main `5465f0d8`, read-only.
- Rev 1.5, 2026-10-27 ~12:20 PM PT (QA). Re-pin 1.0.6 → 1.1.0 (F1–F14, relayed from Web Lead / CEO). r1.4 (`7bfed717263793e1a236dc3acc736bf4`) kept at `metfix-pr-post-layout-search-tests.r1.4.md`. LB6 re-activated for PL6 (`ResourceMediaStage` video/image hero on both `/posts/:id` and `/library/:type/:id`, F3). LB5 expanded for PL5 + PL9 (`ResourceMetaRow` + `ResourceBreadcrumbs` with `?from=`, F2/F4). LB10 updated for PL10 + PL17 (`/api/posts/:id/comments` allowed in `PW2`, DetailPost v2 keys/cache `/__cache/v2/posts/`). LB11 tightened (round-2 follow-up: dead `.library-reader-hero` rule removed from `post-prose.css`, computed `fontFamily` checked on mounted `/library`). New post-layout rows: LB12 (PL13), LB13 (PL14), LB14 (PL15), LB15 (PL16), LB16 (PL17), LB17 (PL18). New taxonomy rows: TX-T1..TX-T8 (TX1–TX8). SS20 tightened (round-2 follow-up: `SS20a` runs against real Worker `HTMLRewriter` in `@cloudflare/vitest-pool-workers` or tests actual head output). SS21 tightened (round-2 follow-up: `getRouterBase()` asserted for `/library`, `/library/search`, `/library/post/1`, `/topic/metabolic-health`; `KNOWN_ROUTES` gains `"library"` and `"topic"`). SC-T4 updated for SEC4 + F11–F14 (allows the scoped Worker additions in `rev 1.1.0`). New security rows: SC-T8 (SEC8), SC-T9 (SEC9), SC-T10 (SEC10), SC-T11 (SEC11), SC-T12 (SEC12), SC-T13 (SEC13). New test-suite rows: TC-T10 (TC9), TC-T11 (TC10), TC-T12 (TC11), TC-T13 (TC12), TC-T14 (TC13), TC-T15 (TC14). CQ-T2 tightened (round-2 follow-up: repo file-tree guard for `*isibility*` / `*hide*`). New CQ row: CQ-T4 (`CQ-0`..`CQ-8` lockstep, cache bump, single-fetch, CSP, stale-doc cleanup). New post-deploy rows: PD-T6 (PD6), PD-T7 (PD7), PD-T8 (PD8). New mutants: LM31–LM36 (targeted ★LM31–★LM35).
- **Approval status (relayed).** E1 (`/library/search` route + handoff), E2 (Sanity + BSI topics), E4 (lock-not-hide, "Yes they still see a lock"), OQ-3 override (PL13 author-right two-column layout), and F1–F14 (`rev 1.1.0` post-detail parity, video stage, breadcrumbs, topic pills, comments, taxonomy pages) are recorded as **ruled (relayed)** via CEO / Web Lead. None confirmed to QA directly by Ethan; merge still needs Ethan's direct go.
- Rev 1.4, 2026-10-22 ~11:25 PM PT (QA). Re-pin 1.0.4 → 1.0.6 (`1809c3bc747e4af8f6dc5e0bd51ef16a`). r1.3 (`69be384b09b81b1624007db328925a07`) kept at `metfix-pr-post-layout-search-tests.r1.3.md`.
- Rev 1.3, 2026-10-22 ~10:55 PM PT (QA). Re-pin 1.0.3 → 1.0.4. r1.2 (`f098c197f45e5edafc22128ac79125a8`) kept at `metfix-pr-post-layout-search-tests.r1.2.md`.
- Rev 1.2, 2026-10-22 ~10:50 PM PT (QA). Re-pin 1.0.1 → 1.0.3. r1.1 (`204cf8df18a6327b7469fb638c7d7ebe`) kept at `metfix-pr-post-layout-search-tests.r1.1.md`.
- Rev 1.1, 2026-10-22 ~10:45 PM PT (QA). Re-pin 1.0 → 1.0.1. r1.0 (`96d21c849dfe833027626568961d0b8c`) kept at `metfix-pr-post-layout-search-tests.r1.0.md`.
- **SEC3 (r1.5):** lock-not-hide, ruled (relayed). SC-T3, TC-T3, CQ-T2, SC-T7, PD-T4 are written to it.
- Counts: **gate 86 [CI]**, **box 6 [BOX]**, **post-deploy 8 [POST]**, **mutation catalogue 27 live (+8 retired)**, **targeted 15 (advisory)**, **gating mutations 0**.
- Spec coverage: **88/88 IDs** (`PL1`–`PL18` = 18, `TX1`–`TX8` = 8, `SR1`–`SR19` = 19, `SN1`–`SN7` = 7, `SEC1`–`SEC13` = 13, `TC1`+`TC1b`+`TC2`–`TC14` = 15, `PD1`–`PD8` = 8).
- Bar (Ethan, 2026-10-22, in this chat): lean and practical. Block only on real breakage, security problems and weakened tests. Pixel nits are follow-ups, not blockers. Test-list sign-off only; merge needs Ethan's go.
- Rules: never weaken an assertion. Each row states exact values, call counts or text. "Renders" is not a pass. Existing posts and library tests must pass without weakened assertions (`PW2` `/api/posts/1/comments` → `/api/posts/1/unknown` and DetailPost v2 key/cache updates are explicitly ruled in by `rev 1.1.0` PL14/PL17/SEC8).

## Conventions
- [CI] runs in `npm test` / `npm run test:workers` / `tsc` / `check:worker` / a ci.yml step. [BOX] QA box evidence (headless Chrome, local build, mutations). [POST] after preview/prod deploy, never a merge gate.
- `fetchMock` records every request URL (with its search params decoded) and headers. `sanityMock` stubs `sanityClient.fetch` and records the GROQ string and call count.
- Grounding at `rev 1.1.0` (`c0e03cb45919d94bd52c0f5c55ab9fdb`): `CONTENT_TYPE_CHIPS` = articles, videos, webinars ("Live Streams"), whiteboards ("Coach Briefings"), journal-clubs, infographic, book-report. `SearchParams.topics` is `number[]`; `SearchParams.categories` is `number[]`; `content_type_terms` is `string[]`. `DETAIL_POST_KEYS` in `shared/posts/guards.ts` and `isLibraryDetailBody` in `shared/library/guards.ts` share `video`, `categories`, `content_types`, `topics`, `locked`, `access`. Cache keys bumped to `/__cache/v2/posts/*` and `library/v2/*`.
- Style tolerance: ±1px for lengths; colours compared as computed strings after normalising to oklch/rgb.

## A. Post detail & shared reader layout [CI unless marked]
Style and reader rows apply to **both** `/posts/:id` and `/library/:type/:id` via the shared `DetailReader` stack (`DetailReader`, `ResourceBreadcrumbs`, `ResourceMediaStage`, `ResourceMetaRow`, `ResourceTopicPills`, `PostCommentsSection`, `AuthorAside`).
- **LB1** (PL1) At 1440px and 768px, body element (`.posts-detail-content`, `.library-reader-body`) `getComputedStyle().maxWidth === "680px"` and `getBoundingClientRect().width` is 680 (±1). At 390px width === 390 − 32 = 358 (±1).
- **LB2** (PL2) Body `p`: fontFamily starts with `"DM Sans"`, fontSize `16px`, lineHeight `26px`, fontWeight `400`. Fails if it is still `Plus Jakarta Sans` or 1.05rem/1.7.
- **LB3** (PL3) Second `p` marginTop+previous marginBottom gap = 16px (measured as rect.top(p2) − rect.bottom(p1) = 16±1); first child marginTop `0px`.
- **LB4** (PL4) H1: fontFamily starts `"Playfair Display"`, 36px, lineHeight 45px, weight 700, marginBottom 16px at 1440px.
- **LB5** (PL5, PL9) `ResourceMetaRow`: category pill link (`/library/category/{slug}`), content-type icon + badge link (`/library/content-type/{slug}`), formatted date, and `By {author}` link (`/library?query={encodeURIComponent(author)}`); `font-size: 13px` DM Sans, `margin-bottom: 12px`. `ResourceBreadcrumbs` (`aria-label="Breadcrumb"`): `Home` (`/`) `>` `Resource Library` (`/library`) `>` context link (`?from=topic:<slug>` → `/topic/<slug>`, `?from=category:<slug>` → `/library/category/<slug>`, `?from=content-type:<slug>` → `/library/content-type/<slug>`, else primary category or content-type fallback) `>` truncated title (`aria-current="page"`). Invalid `?from=` values are ignored (SEC9).
- **LB6** (PL6, F3) `ResourceMediaStage` above header on both `/posts/:id` and `/library/:type/:id` (16:9 `aspect-ratio: 16 / 9`, `#1c1c1e`, max-height `520px`, `margin-bottom: 28px`, full container width above `.post-reader-grid`): (a) unlocked `youtube` / `vimeo` renders responsive `<iframe>` with allowlisted embed URL (`youtube.com/embed/{id}`, `youtube-nocookie.com/embed/{id}`, `player.vimeo.com/video/{id}`); (b) unlocked `self_hosted` renders `<video controls preload="metadata" poster={image}>` with `https://brokenscience.org/...` source; (c) null `video` + `image` renders `<img>` (`object-fit: cover`, `referrerPolicy="no-referrer"`); (d) locked (`locked === true` or `user_has_access === false`) without `has_preview && show_video_in_preview` renders poster/gradient + lock overlay CTA and **zero** `<iframe>`/`<video>` nodes in the DOM (SEC10); (e) neither `video` nor `image` omits stage cleanly.
- **LB11** (PL12, D2, round-2 follow-up) Repo grep (`rg -l "post-prose\.css" client/`) lists **only** `client/src/pages/posts/PostDetailPage.tsx` and `client/src/pages/library/LibraryDetailPage.tsx` (excluding test files). Every selector in `post-prose.css` is scoped under `.posts-detail-content`, `.library-reader-body`, `.post-reader-*`, `.post-author-*`, `.resource-*`, or `.post-comments-*` (no bare `p`, `h1`, `body`, `img`, and no dead `.library-reader-hero` selector). Mount `/library` list with `library.css` loaded: `ResourceCard` title/excerpt computed `fontFamily` uses `Plus Jakarta Sans` / `--lib-font-sans`, unaffected by `post-prose.css`.
- **LB7** (PL7) Inline 2000px image: rendered width ≤ body width (680 at 1440, 358 at 390), computed height `auto` ratio preserved (h/w equals natural ratio ±0.01).
- **LB8** (PL11) At 390px, `document.documentElement.scrollWidth <= 390`; the 300-char URL's container width ≤ body width; body `overflowWrap === "anywhere"`.
- **LB9** (PL8) Body h2/h3/blockquote/figcaption/ul computed fontFamily/weight equal main's values; no new hard-coded size appears for them in `post-prose.css` under `.posts-detail-content, .library-reader-body`.
- **LB10** (PL10) Existing posts and library tests stay green with no weakened assertions vs `5465f0d8` (only additive assertions for PL13/TC14, DetailPost v2 fixture/guard keys, `/__cache/v2/posts/*` cache keys, and `PW2` replacing `/api/posts/1/comments` with `/api/posts/1/unknown` per PL17 / `CQ-7.1`). `SafeHtml` remains the sole `dangerouslySetInnerHTML` consumer for post/library body HTML and strips `<script>` and `onerror=`.
- **LB12** (PL13, Ethan OQ-3 override, relayed) `.post-reader-grid`: 1 column below `1024px`, `minmax(0, 2fr) minmax(0, 1fr)` with `gap: 2.5rem` (`40px`) at `>= 1024px`. Left column `.post-reader-main` keeps body measure `max-width: 680px`. Right column `.post-reader-aside` renders sticky `AuthorAside` (`aria-label="About the author"`, initials avatar, `"About the Author"`, author name, `"Broken Science Initiative contributor."`, `"More from this author →"` link to `/library?query={encodeURIComponent(author)}`). When `author` is null/empty, `<aside>` is omitted.
- **LB13** (PL14, F2) Shared `DetailPost` (`shared/posts/types.ts`) and `LibraryDetail` (`shared/library/types.ts`) both expose `video: ResourceVideo | null`, `categories: LibraryTerm[]`, `content_types: LibraryTerm[]`, `topics: LibraryTerm[]`, `locked: boolean`, `access: LibraryAccess`. `mapTerms` is shared from `shared/library/map.ts` (no duplicate term mapper). `DETAIL_POST_KEYS` (`shared/posts/guards.ts`) and `isLibraryDetailBody` (`shared/library/guards.ts`) validate the new fields in lockstep; posts cache keys use `/__cache/v2/posts/*` and library detail/filters cache keys use `library/v2/*`.
- **LB14** (PL15, F4) `ResourceTopicPills` renders below `.posts-detail-content` / `.library-reader-body`: `"Topics"` uppercase label + pill `<Link>` per topic to `/topic/{topic.slug}`. Omitted when `topics.length === 0`.
- **LB15** (PL16, F5) Both `PostDetailPage` and `LibraryDetailPage` delegate header + media stage + meta row + body + topic pills + `AuthorAside` + `PostCommentsSection` to shared `DetailReader` (`client/src/components/post-detail/DetailReader.tsx`), keeping route-specific shells (back link, external CTA, locked join modal, Daily Fix redirect).
- **LB16** (PL17, F6) `PostCommentsSection` mounts below topic pills when `postId` is a valid positive integer (`post` / `page` with numeric ID): renders `"Comments ({count})"` header, wires `/api/auth/me` (`fetchMeCached` + `subscribeAuthBroadcast`), fetches `GET /api/posts/:id/comments`, and renders `CommentThread` with `target={{ kind: "post", postId, returnPath }}` (`showHeader={false}`). Post-mode `CommentThread` hides Daily Fix pillar badge, pillar selector dropdown, and like button (`isPostTarget`), and sends `POST /api/posts/:id/comments` (`{ content, parent_comment_id? }`), `PATCH /api/posts/:id/comments/:commentId` (`{ content }`), and `DELETE /api/posts/:id/comments/:commentId` with `X-CSRF-Token`.
- **LB17** (PL18, F6/F14) Detail HTML responses from `handlePostsHtml` and `handleLibraryHtml` pass through `finishDetailPageHtml`: response carries `Content-Security-Policy: DETAIL_PAGE_CSP` (`frame-src` allowlisting Google reCAPTCHA + `https://www.youtube.com` + `https://www.youtube-nocookie.com` + `https://player.vimeo.com`; `media-src 'self' https://brokenscience.org`; `frame-ancestors 'none'`) and injects `window.__MFX_RECAPTCHA_SITE_KEY__` into the HTML body.

## B. Taxonomy pages (`/topic/:slug`, `/library/topic/:slug`, `/library/category/:slug`, `/library/content-type/:slug`) [CI unless marked]
- **TX-T1** (TX1, F7/F11/F12) `wrangler.jsonc` `run_worker_first` includes `"/topic/*"`; `worker/index.ts` routes `/topic` and `/topic/*` (GET/HEAD with `Accept: text/html`) to `handleLibraryHtml`; `handleLibraryHtml` matches `/topic/:slug` and `/library/(topic|content-type|category)/:slug` **before** `/library/:type/:id`, validates `SLUG_RE`, and returns `200` SPA shell (`404` on invalid slug); `client/src/const.ts` `KNOWN_ROUTES` includes `"topic"`; `client/src/App.tsx` registers `/topic/:slug`, `/library/topic/:slug`, `/library/category/:slug`, and `/library/content-type/:slug` before `/library/:type/:id`.
- **TX-T2** (TX2, F8/F13) `shared/library/types.ts` `LibraryFilterTerm` includes `description: string | null` and `image: string | null`. `mapFilterTerms` (`shared/library/map.ts`) strips HTML tags while preserving `\n\n` paragraph breaks (`mapFilterDescription`), decodes entities, and extracts `image` via `pickImage` (`image | thumbnail | featured_image | acf_image | image_url`). `isLibraryFiltersBody` (`shared/library/guards.ts`) validates `description` and `image`.
- **TX-T3** (TX3, F7) `LibraryTaxonomyPage` header: breadcrumb `Home` (`/`) `>` `Resource Library` (`/library`) `>` `{term.name}` (`aria-current="page"`); 2-column hero grid (`1fr` mobile, `3fr 2fr` desktop when `term.image` is present, full-width when `term.image` is null); `<h1>` `{term.name}`; description split on `\n\n` into `<p>` elements; when `description.length > 280` or paragraphs > 1, collapses after first paragraph (or 280 chars) with `"Read More ↓"` / `"Show Less ↑"` button (`aria-expanded`); right column renders 4:3 image card when `term.image` is non-null.
- **TX-T4** (TX4, F7) Sticky content-type filter bar on Topic and Category pages: `"All"` tab + tabs from `filters.content_type_terms` (`role="tablist"`, `role="tab"`, `aria-selected`). Selecting a tab updates `?type={slug}` (`replace: true`) and passes `content_type_terms: [slug]` to `useInfiniteArchive`. Hidden on Content Type pages (`taxonomyKind === "content-type"`).
- **TX-T5** (TX5, F7/F10) Single-fetch resolution (`CQ-2`): `LibraryTaxonomyPage` seeds from `peekLibraryFilters()` or awaits `fetchLibraryFilters()`, keeps `useInfiniteArchive` `enabled: filtersReady && term != null`, and passes `topics: [term.id]` (Topic), `categories: [term.id]` (Category), or `content_type_terms: [term.slug]` (Content Type) — firing **at most 1** `/api/library/filters` request and **exactly 1** `/api/library/search` request on initial mount (0 uncategorized searches). `worker/library.ts` `buildSearchUpstreamQuery` also accepts singular `category` and appends `categories[]` (F10).
- **TX-T6** (TX6, F7) Unknown slug (not found in `filters` after `filtersReady`): renders not-found state (`"Topic not found"` / `"Category not found"` / `"Content type not found"`) with link to `/library` and makes **0** `/api/library/search` calls.
- **TX-T7** (TX7, F7) Resource grid on taxonomy pages renders `ResourceCard` with `from="{taxonomyKind}:{term.slug}"` so unlocked card `href`s carry `?from=topic:{slug}`, `?from=category:{slug}`, or `?from=content-type:{slug}`; locked cards open `JoinModal`; pagination uses `useInfiniteArchive` load-more.
- **TX-T8** (TX8, F7) Empty state when `archiveState.status === "data" && archiveState.items.length === 0`: on Topic/Category pages with an active content-type tab filter (`activeType`), displays `"No {type} resources yet"` and a `"View all {term.name} content →"` reset button that clears the content-type tab back to `All` (plus general empty state when `activeType` is null).

## C. Search page (`/library/search`) [CI unless marked]
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
- **SS20** (SR18, E1, round-2 follow-up) Direct load: (a) Worker test (`worker/library.test.ts` + real `HTMLRewriter` / `finishDetailPageHtml`): `GET /library/search` and `/library/search?query=x` → 200, `content-type` text/html, `Content-Security-Policy` = `DETAIL_PAGE_CSP`, body is the SPA shell (same bytes as `GET /library`'s shell), not the Worker 404 body. (b) Mount at that URL → the search page's h1 `Search All Resources` renders; `LibraryDetailPage` and NotFound are not mounted (route order: `/library/search` matched before `/library/:type/:id`). (c) With router base set via `getRouterBase()` for `/library/search`, the base is `""`, not `/library`.
- **SS21** (SR19, C3, F12, round-2 follow-up) `git diff 5465f0d8 -- client/src/const.ts` adds only `"library",` and `"topic",` inside `KNOWN_ROUTES` and nothing else. Unit: `getRouterBase()` returns `""` for `/library`, `/library/search`, `/library/post/1`, and `/topic/metabolic-health` (including when `BASE_URL !== "./"` path-segment logic is exercised); existing const/router tests unchanged and green.
- **SS14** (SR14, PL11) At 390px: `documentElement.scrollWidth <= 390`; tab bar `scrollWidth > clientWidth` allowed; pill container `flexWrap === "wrap"`.
- **SS15** (SR15) Pills are `<button>` with `aria-pressed`; tabs are `<button role="tab">` with `aria-selected` inside `role="tablist"`; keyboard Tab reaches pills and tabs; focused element has a non-`none` outline or box-shadow (`:focus-visible`).
- **SS16** (SR16, E1) Mount `/library`, Videos chip active, type `  keto  ` in its search form, submit → SPA navigation (no `location.assign`/reload; `window.location` spy 0 calls) to exactly `/library/search?query=keto&type=videos`; then the search page's first fetch has `query=keto` and `content_type_terms[]=videos`. Chip not one of the 4 pill slugs (e.g. `journal-clubs`) → `type=` absent. Empty submit → `/library/search` with no `query=`. `/library`'s existing tests stay green unchanged. Diff vs `5465f0d8`: in `client/src/const.ts` the only changes allowed are adding `"library"` and `"topic"` to `KNOWN_ROUTES`; no change to `Map.tsx` or header/footer/nav; the search module graph does not import `Map` (built chunk grep for `VITE_FRONTEND_FORGE` = 0).
- **SS17** (SR17, B3) Mount with a `fetchMock` that records each call's `signal`. (a) Load → exactly 1 un-aborted search fetch (under StrictMode the first may be aborted; exactly 1 completes). (b) Click tab A then tab B in the same tick → A's signal `aborted === true`, B's not; resolve A after B → only B's cards in the DOM (1 result set). (c) Click the already-selected tab, or re-submit the same query → 0 new fetches. (d) Grep of new /library/search code: 0 direct `fetchLibrarySearch` call sites (only via `useInfiniteArchive`). (e) `resetKey` is equal for `?topic=101&query=a` and `?query=a&topic=101`.

## D. Sanity topics [CI unless marked]
- **SN-T1** (SN1, E2) Schema unit test on `sanity/schemaTypes/siteSettings.ts`: `searchTopics` is an `array` of object with exactly the fields `topic_id` (number, required, integer, > 0) and `label` (string, optional). A row missing `topic_id`, or with 0, -1, 1.5, fails validation; a row with `topic_id:13` and no label passes. No `Rule.max` (20 rows pass). No `kind`, `typeSlug` or `bsiTermId` field. Field is in group `search`. No new `_type` document under `sanity/schemaTypes` (diff check).
- **SN-T2** (SN3, B1) `SITE_SETTINGS_QUERY` in `client/src/lib/content.ts` contains `searchTopics[]{topic_id,label}` and `fetchSiteSettings` maps it. No other GROQ string in new code references `searchTopics` (grep = 1 site). Diff grep for `createClient(` outside `client/src/lib/sanity.ts` = 0. The call count (exactly 1) is asserted in TC-T1b.
- **SN-T3** (SN4, TC1, E2) Tab resolver unit `(sanityRows, apiTopics)` → exact `[{id,label}]` list (All not included): (a) Sanity [13 "WH&H", 99 "PL"], API [11,12,13] → [13 WH&H, 99 PL, 11, 12] (dedupe by id, Sanity label wins, Sanity first); (b) Sanity missing, `[]` or rejected → API list exactly, in API order; (c) API rejected or `[]` → Sanity rows only; a Sanity row with no label → `Topic 99`; (d) both empty/rejected → `[]` (page shows only All); (e) invalid Sanity rows (no `topic_id`, 0, -2, 1.5, `"13"`) skipped one at a time, valid neighbours kept in order; (f) duplicate Sanity ids [13 "A", 13 "B"] → one entry, label `A`; (g) an API topic with no Sanity label uses API `name`. No hardcoded label list appears in the resolver module (grep the 8 example labels = 0).
- **SN-T4** (SN4, E2) Mount: Sanity rejects + filters 500 → tab bar has exactly 1 tab, `All`, selected; search still fires once; no console.error. Sanity rejects only → All + the 3 API tabs. Filters 500 only → All + the 2 Sanity tabs (labels from Sanity; `Topic {id}` where unlabelled). `isSanityConfigured=false` = Sanity missing.
- **SN-T5** (SN5, B4) One `fetchLibraryFilters` promise per module instance shared across `LibraryPage`, `SearchPage`, and `LibraryTaxonomyPage` (with synchronous `peekLibraryFilters()` cache read): mount `/library` then navigate to `/library/search` or `/topic/:slug` → at most 1 `/api/library/filters` fetch total; 3 tab clicks add 0. With `topic=11` in the URL on `/library/search` and filters pending, the first search fetch fires with `topics[]=11` (not held).
- **SN-T6** (SN6, E2) No seeding and no defaults: `git diff 5465f0d8 -- scripts/seed-sanity.ts` adds no `searchTopics`; grep of the diff outside `*.test.*` and `docs/` for any of the 8 example labels (`Metabolic Health`, `Special Populations`, `Women's Health`, `Professional Library`, `Whiteboards`, `Coaches`, `BSI Educators`; `Infographics` excluded as a pill label) in search/topic resolver code = 0 hits.
- **SN-T7** (SN7, retired by spec, review row kept) [QA checks at review] The PR body lists the topics the preview filters read returned (names and ids) and the read time, with no `X-API-Key`, token or credentialed URL. Missing list is a follow-up, not a blocker.

## E. Security [CI]
- **SC-T1** (SEC1, TC7) After `npm run build`, grep `dist/` for `wp-json` and `brokenscience.org/wp-json` → 0 hits. In mount tests every `fetchMock` URL starts with `/api/library/`, `/api/posts/`, or `/api/auth/`.
- **SC-T2** (SEC2, TC7) `client/src/lib/sanity.vite-guard.test.ts` unchanged and green; `dist/` grep for `VITE_SANITY_API_READ_TOKEN` and `/sk[A-Za-z0-9]{40,}/` → 0 hits; no new `import.meta.env.VITE_` name in the diff (0 added); `/library/search` does not import `Map.tsx` (SS16).
- **SC-T3** (SEC3, E4 — **relayed; Ethan's direct confirmation pending, required before merge**) Mount, logged out, page of 5 items, `meta.total: 40`, `has_more: true`: 3 open, `EXCL-A` (`is_exclusive:true`), `GATE-B` (`has_content_access:true`). → exactly 5 cards in fixture order; `EXCL-A` and `GATE-B` carry the same lock badge element as `/library` (`isLockedCard` true for exactly those 2); count `40 resources`; load-more fetches `offset=5`. Clicking `EXCL-A` opens `JoinModal` (role dialog present), `location.pathname` unchanged, and 0 `/api/library/item/*` fetches. Signed in with access → 0 lock badges. Grep: `isFreeOpen` not referenced in the search page module.
- **SC-T7** (SEC7, E4 guard) Fixture locked item carries sentinel extra fields the upstream must not need: `content:"GATED-BODY-91"`, `video:"https://media.example/GATED-VID-91.m3u8"`, `excerpt` normal. Logged out: the sentinel strings appear nowhere in the DOM (text, `href`, `src`, `data-*`), in any request URL made after click, or in `console.*`. The search response mapping (`LibraryResource`) has no `content`/`video` key (type test: `// @ts-expect-error` on `r.content`). Locked card's only anchor/click target opens `JoinModal`, never `/library/<type>/<id>` body. Item route's own locking tests on main stay green unchanged.
- **SC-T4** (SEC4, F9–F14) Worker diff vs `5465f0d8` is strictly scoped to the `rev 1.1.0` contract: (1) `/api/library/search` singular `category` alias; (2) `handleLibraryHtml` `/library/search`, `/topic/:slug`, and `/library/(topic|content-type|category)/:slug` before `/library/:type/:id`; (3) `worker/index.ts` + `wrangler.jsonc` `/topic/*` routing; (4) `worker/postComments.ts` + `worker/upstream.ts` post comment proxy routes; (5) `worker/csp.ts` + `worker/detailHtml.ts` `DETAIL_PAGE_CSP` + `window.__MFX_RECAPTCHA_SITE_KEY__` injection. No new secret bindings in `wrangler.jsonc`; existing `worker/library` and `worker/posts` tests stay green.
- **SC-T5** (SEC5) Input `maxLength` 120; pasting 200 chars sends a `query` of length ≤ 120. Query `<img src=x onerror=alert(1)>` shows as literal text in the count line, and `document.querySelectorAll('img[onerror]').length === 0`.
- **SC-T6** (SEC6) In all new tests, `console.*` spies record no string matching `token|X-API-Key|sk[A-Za-z0-9]{20}`; PR body checked by QA at review (box note in BX-6).
- **SC-T8** (SEC8, F2/F3/F14) Video URL & embed host allowlist (`shared/library/video.ts` + `worker/csp.ts`): `mapResourceVideo` accepts **only** `https:` URLs with no credentials, no explicit port, and no `..` / `//` path segments; YouTube video IDs match `/^[A-Za-z0-9_-]{11}$/` → `https://www.youtube.com/embed/{id}`; Vimeo video IDs match `/^[0-9]{6,12}$/` → `https://player.vimeo.com/video/{id}`; self-hosted video URLs must have hostname `brokenscience.org`. Any `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `http:`, or non-allowlisted host returns `null`. `DETAIL_PAGE_CSP` allowlists `frame-src` (`https://www.youtube.com`, `https://www.youtube-nocookie.com`, `https://player.vimeo.com`, plus Google reCAPTCHA) and `media-src 'self' https://brokenscience.org`.
- **SC-T9** (SEC9, F4) Breadcrumb `?from=` validation (`shared/library/fromParam.ts`): `parseFromParam` enforces length `<= 80` and `/^(topic|category|content-type):([a-z0-9]+(?:-[a-z0-9]+)*)$/`. Any path traversal (`..`), slashes (`/`), protocol prefixes (`http:`, `javascript:`), uppercase, or unknown prefix returns `null` and falls back to resource taxonomy terms.
- **SC-T10** (SEC10, F3) Locked resource media protection: when `locked === true` or `access.user_has_access === false` and `!(access.has_preview && access.show_video_in_preview)`, `mapResourceVideo(raw, { allowPlayable: false })` returns `null` in `mapDetailBody`, and `ResourceMediaStage` renders **no** `<iframe>` or `<video>` element in the DOM (only poster image/gradient + lock CTA).
- **SC-T11** (SEC11, F6/F9) Post comments write security (`worker/postComments.ts`): `POST /api/posts/:id/comments`, `PATCH /api/posts/:id/comments/:commentId`, and `DELETE /api/posts/:id/comments/:commentId` enforce `isAuthHost(request, env)` (off-host → `404`), `resolveActingSession` (missing/invalid session → `401`), `requireCommentCsrf` (`X-CSRF-Token` verified against `acting.record.csrf` and `CSRF_SECRET` → `403` on mismatch), `COMMENT_WRITE_LIMITER` (`429` with clamped `Retry-After`), and `runUserBsiCall` (`Bearer` + `X-API-Key`). Content length capped at `1..2000` code points after trim; `parent_comment_id` validated as positive integer (`<= 2147483647`).
- **SC-T12** (SEC12, F8) Taxonomy description sanitization: `mapFilterDescription` strips all HTML tags on the server mapper while preserving `\n\n` paragraph breaks and decoding basic entities, and `LibraryTaxonomyPage` renders descriptions exclusively as React `<p>` text nodes (never `dangerouslySetInnerHTML`).
- **SC-T13** (SEC13, F2) Guard key-set lockstep: `DETAIL_POST_KEYS` in `shared/posts/guards.ts` and `isLibraryDetailBody` in `shared/library/guards.ts` both require `video`, `categories`, `content_types`, `topics`, `locked`, `access`; `shared/posts/guards.lockstep.test.ts` asserts lockstep so neither guard rejects mapped responses or serves stale shape from cache.

## F. Test-suite rows [CI]
- **TC-T1** (TC1) = SN-T3 (cases a–g) + SN-T4 present as named tests.
- **TC-T1b** (TC1b, B1–B3) Mount nav + footer + /library/search together: `sanityClient.fetch` called **exactly 1** time (`vi.resetModules()` between tests; no prod reset export, CQ rule 4). Typing 10 chars → 0 search calls; submit → exactly 1. Two quick tab clicks → first signal aborted, 1 rendered result set.
- **TC-T2** (TC2, E3) Unit on the state→params/URL reducer: All/All/no query → no filter params; each of 4 pills × {All, tab 11} → exact param sets (8 cases), and changing the pill keeps the tab / changing the tab keeps the pill; invalid URL `topic`/`type` values per SS13 → All; `topic=555` kept; count-line cases per SS9. Every output has ≤ 1 type value and ≤ 1 topic (SS19).
- **TC-T3** (TC3, E4) = SC-T3 + SC-T7 (mount, mirrors /library's card test). Pending Ethan's direct E4 confirmation.
- **TC-T4** (TC4) Mount: DOM order of breadcrumb, h1, input, SEARCH button, pills, tab bar, count line, Clear filters, grid (`compareDocumentPosition` chain) + SS10.
- **TC-T5** (TC5) The headless computed-style test exists in CI (or a ci.yml step) covering LB1, LB2, LB4, LB12, SS2, SS5, SS6 at 1440 and 390, ±1px. If the Project makes it box-only, it moves to BX-1 and is not dropped.
- **TC-T6** (TC6) `npm test`, `npm run test:workers`, `tsc --noEmit`, `npm run check:worker`, `npm run build:cf` exit 0; skip count not higher than main's (no new `.skip`/`.todo`/`it.only`).
- **TC-T7** (TC7) Bundle scan step exists in CI and fails on a planted `wp-json` string (proved once by BX-4).
- **TC-T8** (TC-mutation note) The mutation set exists as patches under `docs/<feature>/mutations/` or QA box only; never in a gate block.
- **TC-T9** (TC8, SR16, SR18) = SS16 (handoff with Videos → `/library/search?query=q&type=videos`) + SS20(b) (renders the search page, not `LibraryDetailPage`) as named tests.
- **TC-T10** (TC9, PL6, SEC8, SEC10) Unit + component tests (`shared/library/video.test.ts`, `client/src/components/post-detail/ResourceMediaStage.test.tsx`) covering YouTube/Vimeo/Self-Hosted mapping, scheme/host/path rejection (`javascript:`, `data:`, `http:`, evil host, `..`), `allowPlayable: false` returning `null`, and `ResourceMediaStage` omitting `<iframe>`/`<video>` when locked without preview.
- **TC-T11** (TC10, PL14, SEC13) Lockstep guard + mapper tests (`shared/posts/guards.test.ts`, `shared/posts/guards.lockstep.test.ts`, `shared/posts/map.test.ts`, `shared/library/map.test.ts`) verifying `DetailPost` and `LibraryDetail` carry `video`, `categories`, `content_types`, `topics`, `locked`, `access` and cache keys use `/__cache/v2/posts/*` and `library/v2/*`.
- **TC-T12** (TC11, PL5, PL9, PL15, SEC9) Component + unit tests (`client/src/components/post-detail/ResourceBreadcrumbs.test.tsx`, `ResourceMetaRow`, `ResourceTopicPills`, `parseFromParam`) verifying default breadcrumb chain, `?from=` override for `topic`/`category`/`content-type`, rejection of invalid `?from=`, meta row links, and topic pills links.
- **TC-T13** (TC12, TX1–TX8, SEC12) Worker + mount tests (`worker/library.test.ts`, `client/src/pages/library/LibraryTaxonomyPage.mount.test.tsx`) verifying `/topic/:slug`, `/library/topic/:slug`, `/library/category/:slug`, `/library/content-type/:slug` return `200` SPA shell (and invalid slug → `404`), `LibraryTaxonomyPage` fires `<= 1` filters call and `1` search call on mount (`filtersReady` gate), and `ResourceCard` receives `from`.
- **TC-T14** (TC13, PL17, SEC11) Worker + client tests (`worker/postComments.test.ts`, `PostCommentsSection` / `CommentThread`) verifying anonymous `GET /api/posts/:id/comments` uses `X-API-Key` + `Cache-Control: no-store`, `POST` off `metfix.org` → `404`, `POST` without session → `401`, `POST` without valid CSRF → `403`, and invalid post ID falls through to `404`.
- **TC-T15** (TC14, PL18, SEC8) Worker HTML tests (`worker/library.test.ts`, `worker/posts.test.ts`) verifying `handleLibraryHtml` and `handlePostsHtml` emit `Content-Security-Policy: DETAIL_PAGE_CSP` (with YouTube, Vimeo, `brokenscience.org` media, and Google reCAPTCHA) and inject `window.__MFX_RECAPTCHA_SITE_KEY__`.

### CQ pre-build checks folded in [CI]
- **CQ-T1** (call counts; SN3, SN5, SR4, SR17) One /library/search page load with nav+footer: exactly 1 Sanity settings read, ≤ 1 `/api/library/filters`, exactly 1 `/api/library/search`. A tab click, a pill click and a submit each add exactly 1 search and 0 Sanity / 0 filters. Load-more adds exactly 1 search per page.
- **CQ-T2** (SEC3, D6, round-2 follow-up) No hide filter remains: `git ls-files` has **0** files matching `*isibility*` or `*hide*` under `shared/` or `client/`, and no exported function that filters results by access; `isFreeOpen` is not imported by any search module; the array handed to the card grid is the hook's `items` (grep: no `.filter(` over results in `SearchPage.tsx` keyed on `access`). Mount: logged-out and signed-in fixtures render the same card count and order as upstream `items`.
- **CQ-T3** (dist grep; SEC1, SEC2, TC7) A CI step after `npm run build` greps `dist/` and fails on any hit for `wp-json`, `brokenscience.org/wp-json`, `VITE_SANITY_API_READ_TOKEN`, `/sk[A-Za-z0-9]{20,}/`. No `|| true` on the step; proved by BX-4.
- **CQ-T4** (`CQ-0`..`CQ-8` pre-build gates) (a) `CQ-0`/`CQ-8`: stale Round-1 CQ files (`metfix-pr-post-layout-search-cq-prebuild.md`, `metfix-pr18-cq-r1-84d84d5.md`) removed from `docs/post-layout-search/`; (b) `CQ-1`: `mapTerms` exported from `shared/library/map.ts` and reused by `shared/posts/map.ts`, cache keys bumped to `v2`; (c) `CQ-2`: `peekLibraryFilters()` exported and `LibraryTaxonomyPage` gates `useInfiniteArchive` on `filtersReady && term != null`; (d) `CQ-3`/`CQ-7.3`: `finishDetailPageHtml` sets `DETAIL_PAGE_CSP` and injects `window.__MFX_RECAPTCHA_SITE_KEY__` on both `handlePostsHtml` and `handleLibraryHtml`; (e) `CQ-5`: `postComments.ts` imports shared helpers from `worker/comments.ts` without duplicating auth/CSRF/rate-limit plumbing; (f) `CQ-7.2`: `SafeHtml` remains the only `dangerouslySetInnerHTML` consumer for post/library HTML.

## Box-only [BOX]
- **BX-1** Headless Chrome 1440/390 screenshots and computed-style dump for LB1–LB8, LB12, SS2, SS5, SS6, SS11 on a local build; md5 of the dump recorded.
- **BX-2** Reproduce counts: clean `npm ci --legacy-peer-deps`, `npm test`, `npm run test:workers`, `tsc --noEmit`, `npm run check:worker`, `npm run build:cf`; report pass/fail/skip.
- **BX-3** Weakened-test diff: `git diff 5465f0d8..<head> -- '**/*.test.*'` and `git diff 1df3cd9f..<head> -- '**/*.test.*'` reviewed; any removed or loosened `expect` (outside the spec-ruled `PW2` `/api/posts/1/unknown` and DetailPost v2 key/cache updates) is a blocker.
- **BX-4** Plant `"https://brokenscience.org/wp-json/x"` in a client file on a scratch worktree → TC-T7 / SC-T1 go red; revert, porcelain clean.
- **BX-5** Run the targeted mutants (below), each alone, exact red set, revert.
- **BX-6** PR body and test output grep for tokens/credentialed URLs (SEC6).

## Post-deploy [POST] (never merge gates)
- **PD-T1** (PD1) Preview `/library/search` by direct load and from the `/library` search box: All + the API/Sanity tabs, 5 pills, placeholder exact; click a tab → count text changes and contains ` in <Tab>`.
- **PD-T2** (PD2) DevTools network on preview: request hosts only the metfix origin (`/api/library/*`, `/api/posts/*`, `/api/auth/*`) and `*.apicdn.sanity.io`; 0 requests to `brokenscience.org/wp-json`; Sanity requests carry no `Authorization` header.
- **PD-T3** (PD3, SN2) Studio on a **preview dataset only**, never prod: add one `searchTopics` entry with an existing API topic id and a custom label → within ~60s, no deploy, it is first in the bar with the custom label and the API's copy of that id is gone (no duplicate). Remove it → API order returns exactly.
- **PD-T4** (PD4, E4) Logged out on preview: search a known exclusive title → it appears with the lock badge; click opens the join modal; DevTools network shows no body/media URL for it. Ethan's direct OK on E4 must be on record before merge.
- **PD-T5** (PD5) Long BSI post at 1440 and 390 vs reference, PL1–PL6, PL9, PL13–PL17, screenshots on the PR (Web Lead posts them; QA does not).
- **PD-T6** (PD6) Video post on preview (`/posts/:id` and `/library/post/:id`): YouTube/Vimeo iframe or self-hosted `<video>` loads without CSP violation in DevTools console; locked video resource logged out shows poster + lock overlay with 0 `<iframe>`/`<video>` nodes.
- **PD-T7** (PD7) Taxonomy pages on preview (`/topic/metabolic-health`, `/library/category/bsi`, `/library/content-type/video`): direct load returns 200 HTML shell, renders hero title + description + content-type tabs + resource cards; clicking a card navigates to `/library/:type/:id?from=...` and renders the matching breadcrumb context link.
- **PD-T8** (PD8) Post comments on preview (`/posts/:id` and `/library/post/:id`): logged-out viewer sees existing comments + `"Sign In To Comment"` / join modal trigger; signed-in viewer can post, reply, edit, and delete a test comment on staging/preview with CSRF token and no console/CSP errors.

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
| ★LM31 | Video mapper (`mapResourceVideo` in `shared/library/video.ts`) ignores `opts?.allowPlayable === false` or allows `http:` / non-allowlisted hosts | SC-T8, SC-T10, TC-T10 |
| ★LM32 | Guard key set (`DETAIL_POST_KEYS` in `shared/posts/guards.ts`) omits `"video"` or `"topics"` | LB13, SC-T13, TC-T11 |
| ★LM33 | `?from=` validator (`parseFromParam` in `shared/library/fromParam.ts`) accepts unvalidated strings / path traversal (`..` or `/`) | LB5, SC-T9, TC-T12 |
| ★LM34 | Taxonomy page (`LibraryTaxonomyPage.tsx`) sets `enabled: true` on `useInfiniteArchive` before `filtersReady && term != null` (fires unfiltered search on mount) | TX-T5, TC-T13, CQ-T4 |
| ★LM35 | Post comments write handler (`handlePostCommentPost` in `worker/postComments.ts`) skips `isAuthHost` or `requireCommentCsrf` check | LB16, SC-T11, TC-T14 |
| LM36 | Detail HTML handler (`finishDetailPageHtml` in `worker/detailHtml.ts`) omits `withDetailPageCsp` header | LB17, SC-T8, TC-T15 |

Targeted 15: LM2, LM3, LM4, LM17, LM23, LM24, LM25, LM26, LM27, LM28, LM31, LM32, LM33, LM34, LM35. † = [POST] row, not run in BX-5 (red set for BX-5 excludes it). Catalogue 27 live (LM2–LM11, LM16–LM18, LM22–LM36), 8 retired (LM1, LM12–LM15, LM19–LM21). A surviving targeted mutant is a finding to Web Lead, not a gate.

## Open questions (not guessed; rows stay as written until ruled)
- **OQ-Q14 (SR13 vs SR6)** SR6 says "exactly one tab is active"; SR13 says `topic=555` (not in the list) lights no tab, so zero are active. Rows follow SR13 for that one case.
- **OQ-Q15 (SR9/SR10 leftovers)** SR9 still says "or a type tab matching `type`" and SR10 "a type tab counts as both" (R11 text), though E3 retired type tabs. Rows ignore those clauses.
- **OQ-Q17 (TC1b wording)** TC1b still mounts "/search"; rows use `/library/search`.
- **Pending Ethan directly (QA chat):** E1 route + handoff, E2 topic source, E4 lock-not-hide, OQ-3 author-right override, and F1–F14 (`rev 1.1.0` scope expansion) — all arrived relayed via CEO / Web Lead; Ethan's direct go is required before merge.

## Spec ID coverage map (88/88)
PL1 LB1 · PL2 LB2 · PL3 LB3 · PL4 LB4 · PL5 LB5, TC-T12 · PL6 LB6, TC-T10 · PL7 LB7 · PL8 LB9 · PL9 LB5, TC-T12 · PL10 LB10 · PL11 LB8, SS14 · PL12 LB11 · PL13 LB12 · PL14 LB13, TC-T11 · PL15 LB14, TC-T12 · PL16 LB15 · PL17 LB16, TC-T14 · PL18 LB17, TC-T15
TX1 TX-T1, TC-T13 · TX2 TX-T2 · TX3 TX-T3 · TX4 TX-T4 · TX5 TX-T5, TC-T13, CQ-T4 · TX6 TX-T6 · TX7 TX-T7 · TX8 TX-T8
SR1 SS1 · SR2 SS2 · SR3 SS3 · SR4 SS4 · SR5 SS5, SS18, SS19 · SR6 SS6, SS18 · SR7 SS7 · SR8 SS8, SS19 · SR9 SS9 · SR10 SS10 · SR11 SS11 · SR12 SS12 · SR13 SS13 · SR14 SS14 · SR15 SS15 · SR16 SS16, TC-T9 · SR17 SS17, TC-T1b, CQ-T1 · SR18 SS20, TC-T9 · SR19 SS21
SN1 SN-T1 · SN2 PD-T3 · SN3 SN-T2 · SN4 SN-T3, SN-T4 · SN5 SN-T5, CQ-T1 · SN6 SN-T6 · SN7 SN-T7
SEC1 SC-T1, CQ-T3 · SEC2 SC-T2, CQ-T3 · SEC3 SC-T3, CQ-T2, PD-T4 · SEC4 SC-T4 · SEC5 SC-T5, SS3 · SEC6 SC-T6, BX-6 · SEC7 SC-T7, TC-T3 · SEC8 SC-T8, TC-T10, TC-T15 · SEC9 SC-T9, LB5, TC-T12 · SEC10 SC-T10, LB6, TC-T10 · SEC11 SC-T11, LB16, TC-T14 · SEC12 SC-T12, TX-T2, TX-T3 · SEC13 SC-T13, LB13, TC-T11
TC1 TC-T1 · TC1b TC-T1b · TC2 TC-T2 · TC3 TC-T3 · TC4 TC-T4 · TC5 TC-T5, BX-1 · TC6 TC-T6, BX-2 · TC7 TC-T7, BX-4 · TC8 TC-T9 · TC9 TC-T10 · TC10 TC-T11 · TC11 TC-T12 · TC12 TC-T13 · TC13 TC-T14 · TC14 TC-T15
PD1 PD-T1 · PD2 PD-T2 · PD3 PD-T3 · PD4 PD-T4 · PD5 PD-T5 · PD6 PD-T6 · PD7 PD-T7 · PD8 PD-T8

```gate-ids
LB1
LB2
LB3
LB4
LB5
LB6
LB7
LB8
LB9
LB10
LB11
LB12
LB13
LB14
LB15
LB16
LB17
TX-T1
TX-T2
TX-T3
TX-T4
TX-T5
TX-T6
TX-T7
TX-T8
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
SC-T8
SC-T9
SC-T10
SC-T11
SC-T12
SC-T13
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
TC-T10
TC-T11
TC-T12
TC-T13
TC-T14
TC-T15
CQ-T1
CQ-T2
CQ-T3
CQ-T4
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
PD-T6
PD-T7
PD-T8
```

## Changelog
- r1.5 (2026-10-27 ~12:20 PM PT): re-pin to 1.1.0 `c0e03cb4…` + CQ pre-build `866f1df1…`; 88/88 spec IDs covered; LB6 re-activated (PL6), LB12–LB17 (PL13–PL18), TX-T1–TX-T8 (TX1–TX8), SC-T8–SC-T13 (SEC8–SEC13), TC-T10–TC-T15 (TC9–TC14), CQ-T4, PD-T6–PD-T8 (PD6–PD8), and LM31–LM36 added; LB11, SS20, SS21, CQ-T2 tightened per round-2 follow-ups.
- r1.4 (2026-10-22 ~11:25 PM PT): re-pin to 1.0.6 `1809c3bc…`; LB6 retired, LB11/SS21/LM30 added, CQ-T2 to D6.
- r1.3 (2026-10-22 ~10:55 PM PT): re-pin to 1.0.4 `1c59b421…`; E1–E4 applied (relayed; Ethan's direct confirmation pending); see header.
- r1.2 (2026-10-22 ~10:50 PM PT): re-pin to 1.0.3 `020a837e…` (frozen); R10–R13 applied; see header.
- r1.1 (2026-10-22 ~10:45 PM PT): re-pin to 1.0.1 `d56220ee…`; R1–R9 and CQ B1–B6 applied; see header.
- r1.0 (2026-10-22 ~10:40 PM PT): first rev, pinned to acceptance 1.0 `5855043c…`.
