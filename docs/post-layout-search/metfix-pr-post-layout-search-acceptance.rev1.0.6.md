# metfixhome draft PR: post body layout + Search page, acceptance spec, rev 1.0.6

> **FROZEN (1.0.4, 2026-10-22).** Ethan's answers on OQ-5, OQ-8 and OQ-9 arrived (relayed via CEO and Web Lead) and are applied in §0b. The pending list is lifted. Any further change needs Web Lead's ruling first. **The OQ-9 security exception still needs Ethan's direct confirmation before merge.**

> **1.0.6 (2026-10-22):** §0d scope rulings (relayed from MetFix Web Lead). QA test-list md5 pins removed from this spec: pins go one way only, list → spec. Rows changed: PL6 (retired), TC5, PD5, R8, E1, C3, §0 scope. New: PL12. See §4. The 1.0.5 note below is history.

> **1.0.5 (2026-10-22, doc cleanup only, no behaviour change):** per QA r1.3, relayed from Web Lead. §0c is the record. Rows changed: SR6, SR9, SR10, SR18, TC1b, TC4, SEC2, SEC3, E1, R8, OQ-9 and OQ-13. New: SR19. See §4. The 1.0.4 note below is history.

> **1.0.4 (2026-10-22):** §0b applies Ethan's answers (relayed). Rows changed: SR1, SR5–SR10, SR13, SR16, SN1–SN7, SEC3, TC1–TC3, the mutation set, PD1, PD3 and PD4. New: SR18, SEC7 and TC8. See §4. The 1.0.3 note below is history.

> **1.0.3 (2026-10-22):** R13 (relayed from Web Lead) takes OQ-12 option (a), and OQ-12 is closed. Rows changed: SR5, SR6, TC2; see §4. The 1.0.2 note below is history.

> **1.0.2 (2026-10-22):** MetFix Web Lead's rulings (relayed) on QA r1.1: R10, R11 and the OQ-10 confirmation are in §0a. OQ-11 is retired. Rows changed: SR5, SR6, SR8, SR9, SR10, SR13, SN1, SN4, SN6, SN7, TC1, TC2, the mutation set and PD3; see §4. The 1.0.1 note below is history.

> **1.0.1 (2026-10-22):** MetFix Web Lead's rulings (relayed) on QA's r1.0 list (`metfix-pr-post-layout-search-tests.md`) and on CQ's pre-build note (`metfix-pr-post-layout-search-cq-prebuild.md`, md5 `94f99437…`), with CQ's B1–B6 folded in. §0a wins over every later section where they differ. Rows changed: SR5, SR8, SR13, SR16, SN1, SN3–SN6, SEC3, TC1, TC3, PD3, PD4, plus new SR17 and SN7; see §4. The 1.0 note below is history.

> **1.0 (2026-10-22):** New work from Ethan, relayed via MetFix CEO and MetFix Web Lead, 2026-10-22 (relayed). One draft PR off main. Nothing merges without Ethan's direct go. Lean: no new features beyond the two items below (Ethan: "we have already overcomplicated and delayed this launch too long").

- Repo: Break-Even-Productions/metfixhome. Base: main **`5465f0d8`** (`5465f0d8f1f425fc025f88ed7b317caaa58a54b8`, "Draft: First-party Resource Library on /library (#17)"), read 2026-10-22 10:31 PM PT.
- Design reference: `https://rlhome.emilydesigns.org` (a client-rendered SPA). Its bundle carries source paths `client/src/pages/ResourceDetail.tsx` and the search page. I treat it as the deployed design source (Curie-and-Co/mia-metfix). **That link is not verified; see OQ-7.**
- Reference assets fetched 2026-10-22: `/assets/index-BRGGIAaC.css` (md5 prefix `37acf384`), `/assets/index-Cw2EZO4J.js` (md5 prefix `ffa25647`). I measured computed styles in headless Chrome at 1440px and 390px viewports. Every value in §1 is measured or read from those files. None is invented.
- Author: MetFix Web Spec. Read-only: no repo changes, no messages to the Project.

## 0d. Rev 1.0.6 scope rulings (MetFix Web Lead, 2026-10-22, relayed). Read first; wins over §0c and every earlier section.
- **D1** Post typography on `/posts/:id` and `/library/:type/:id` is **in scope** (PL1–PL5, PL7–PL11).
- **D2** A shared `post-prose.css`, imported only by those two pages, is allowed (PL12). This supersedes the "shared prose styles out of scope" line in R8, E1 and C3.
- **D3** The hero image and any font swap on the `/library` list are **out of scope**. PL6 is retired; `ResourceCard` and the `/library` list keep main's fonts (SR11 reuses the card unchanged).
- **D4** Search shows locked items with a lock (E4, SEC3, SEC7). Unchanged.
- **D5** The result count comes from `meta.total` (SR9, SEC3, TC2, TC3). Unchanged.
- **D6** There is no visibility filter module: no hide/visibility function or file is added (SEC3 already says no hide filter and no `isFreeOpen`). Unchanged.
- **Conflict fixes:** PL6 retired (D3); TC5 drops PL6; PD5 now covers PL1–PL5 and PL7; R8, E1 and C3 strike "shared prose styles" out of scope (D2); §0 in-scope line names the two post routes. No conflict found in SR9, SEC3, SEC7, TC2, TC3 or PD4.

## 0c. Rev 1.0.5 cleanup (MetFix Web Lead, 2026-10-22, relayed; based on QA r1.3). No behaviour change.
- **C1** SR6 is aligned with SR13: a `topic` id that isn't in the resolved tab list lights **no** tab ("All" stays unlit), and the id is still sent.
- **C2** The type-tab wording is removed from SR9 and SR10 (type tabs were retired in E3).
- **C3 OQ-13 is ruled (a):** the one-line `"library"` entry in `KNOWN_ROUTES` (`client/src/const.ts`) is **in this PR** (SR19). This supersedes R8 and E1 for that item. `Map.tsx` stays out of scope; ~~shared prose styles~~ (allowed, D2).
- **C4** TC1b and TC4 now name `/library/search`.
- **C5 E4 approval status:** approved by Ethan via MetFix CEO on 2026-10-22, relayed by MetFix Web Lead under Web Lead's 2026-10-15 rule that a CEO-relayed go counts as Ethan's (E-R9). **Ethan has not confirmed that rule to me directly**, so this is recorded as relayed, not as Ethan's direct approval. **The merge still needs Ethan's direct go.**


## 0b. Rev 1.0.4: Ethan's answers (relayed via MetFix CEO and MetFix Web Lead, 2026-10-22). Read first; wins over §0a and every earlier section.
- **E1 (OQ-5) Route:** the route is **`/library/search`**, and the `/library` search box sends people there. The handoff is now **in scope** (SR16), which supersedes R8 for the handoff. `Map.tsx` stays out of scope; ~~shared prose styles~~ (allowed, D2). (`KNOWN_ROUTES` moved in scope by C3.)
- **E2 (OQ-8) Tab source:**
  - The tabs come from the BSI topics list already on main: `GET /api/library/filters` → `topics: LibraryFilterTerm[]` (`{id, name, slug, count?}`), the same read LibraryPage uses. No new route.
  - Sanity entries, if any, come first in Sanity order, then the API topics in API order, deduped by `topic_id` (Sanity wins on the label).
  - "All" is always shown first and is not part of the list.
  - Each Sanity entry has a required `topic_id` (an integer), used for dedupe and as the filter value (`topics[]`).
  - **Nothing is seeded, and there are no hardcoded defaults.** If both sources are empty or fail, only "All" shows.
- **E3 Type tabs retired:** the API list is topics only, so every tab is a topic. Type filtering stays on the pills.
  - R10 and R13 are retired as moot, and the `kind` and `typeSlug` fields are dropped.
  - R11 is reduced to its URL half: `topic=<id>`, with `type=<slug>` set by pills only.
  - R1 (id + label) stays, with the field renamed to `topic_id`. R2 is superseded by E2's empty/fail rule. R3 is retired.
  - Whiteboards and Infographics show as tabs only if BSI returns them as topics, or if Ethan adds a Sanity entry with a topic id.
- **E4 (OQ-9) Locked items show with a lock, the same as /library.**
  - The `isFreeOpen` hide filter is removed (R5, R12 and the B5 hide function are retired). The count and paging use `meta.total` and the upstream offset.
  - **This is an exception to the standing security rule** ("filter exclusive and content_access items on logged-out pages"). It is recorded as **relayed**, and **it needs Ethan's direct confirmation before merge**; a relay doesn't count.
  - SEC7 keeps the leak guard.


## 0a. Rev 1.0.1 rulings (MetFix Web Lead, 2026-10-22, relayed). Read first.
- **R1 Topic value:** Sanity stores the BSI term **id (int)** plus a label, with no slug lookup (matches main's `topics: number[]`). Each row also gets an optional `kind`, `'topic'` or `'type'`, default `'topic'`. → SN1, SR8.
- **R2 Filters route failure:** if `/api/library/filters` fails, the tab bar shows the Sanity tabs (or the defaults) as they are. Tabs never depend on that read. → SN5.
- **R3 Whiteboards and Infographics:** if the Project's live filters read finds either only as a content type, its row uses `kind:'type'` and the tab sends the type filter (`content_type_terms[]`) instead of `topics[]`. → SR8, SN6.
- **R4 URL `type=`** takes the BSI slug (for example `type=webinars`), not the label. → SR13.
- **R5 SEC3:** logged-out visitors don't see exclusive or gated items. No Worker change. The `/api/library/search` allowlist on main (query, limit, offset, content_types, content_type_terms, topics, categories) has **no** access param, so filtering happens on the client in **one pure function**, and the count comes from the filtered list. **Hiding versus showing with a lock is still pending Ethan (via CEO).** → SEC3, OQ-9, OQ-10.
- **R6 OQ-1** stays open, enforced by QA's LB9: body h2/h3/blockquote/figcaption/lists keep main's styles. → PL8.
- **R7 Earlier rulings:** the Q1–Q4 and Q9 assumptions stand (OQ-1 to OQ-4, with OQ-9's rule applying until Ethan answers). The Project does the live filters read and records the slugs and ids (OQ-6). `/search` is the working route (OQ-5). Still pending Ethan: OQ-5 (final route), OQ-8 (seed or prod entries) and the OQ-9 exception.
- **R8 Out of scope, each its own separate PR:** ~~adding `library` to `KNOWN_ROUTES`~~ (in scope, C3), the `Map.tsx` key, the `/library` → `/search` handoff, and ~~shared prose styles~~ (allowed, D2).
- **R9 CQ B1–B6 folded in:** B1 → SN3; B2 → SR4; B3 → SR17; B4 → SN5; B5 → SEC3; B6 → SEC2.
- **R10 Type rows (relayed, QA r1.1):** a `kind:'type'` row stores a **content-type slug from `CONTENT_TYPE_CHIPS`**, not an integer id. It sends the same param with the same slug that main's type pills already use (`content_type_terms[]`). Topic rows keep the integer id and send `topics[]`. This supersedes R1 and R3 for type rows. → SN1, SR8.
- **R11 One type value (relayed):** in the URL a topic tab sets `topic=<id>`, and a type tab sets `type=<slug>`, the same state a pill sets. Clicking a type tab selects that type, lights the matching pill and resets the topic to All. There's only ever one type value, so nothing is combined and OQ-11 is retired. Ids (integers) and slugs can't collide. → SR5, SR6, SR8, SR13.
- **R13 Type tab with no pill (relayed, OQ-12 option (a)):** when a type tab's slug has no matching pill (for example Whiteboards, `whiteboards`), clicking it lights **no** pill, not even All Types. The URL still sets `type=<slug>` and the request sends `content_type_terms[]=<slug>` as in R11. → SR5, SR6.
- **R12 OQ-10 confirmed (relayed):** hide exclusive and gated items through `isFreeOpen`, as SEC3 already says. OQ-10 is closed.

## 0. Scope and reuse
- **In scope:** (A) post body layout and typography on `/posts/:id` and `/library/:type/:id` only (D1), with no hero image change and no font swap on the `/library` list (D3); (B) a new Search page; (C) one small Sanity field for the topic tabs.
- **Reuse, don't rebuild:**
  - The Worker routes already on main: `/api/library/search`, `/api/library/filters` and `/api/library/item/:type/:id` (`worker/library.ts`).
  - The client fetchers in `client/src/pages/library/api.ts` (`fetchLibrarySearch` with `query`, `content_type_terms[]` and `topics[]`).
  - `ResourceCard.tsx` for result cards.
  - `CONTENT_TYPE_CHIPS` slugs in `shared/library/constants.ts`.
  - The token-free `sanityClient` and the `useSiteSettings` pattern in `client/src/lib/sanity.ts`.
  - `SafeHtml` for bodies.
- **Out of scope:** new Worker routes, new BSI endpoints, header and footer changes, comments, login, and colour theme changes (OQ-2).

## 1. Measured reference values (post page `/resource/a-body-of-lies-emily-kaplan`)
| Element | Measured value (1440px; 390px where it differs) | Source |
|---|---|---|
| Page container | max-width 1280px; padding-x 32px (16px at 390px); padding-top 40px | `.container{max-width:1280px;padding-left:2rem…}`, computed |
| Layout | grid, 3 columns at lg (main column `lg:col-span-2` = 797px, sidebar 379px), gap 40px (`gap-10`); 1 column on mobile | computed |
| **Body measure** | **max-width 680px** on body text, the hero media and the panels | `style:{maxWidth:"680px"}`, `max-w-[680px]` |
| Body paragraph | "DM Sans", sans-serif; 16px; line-height 26px (1.625, `leading-relaxed`); weight 400; colour `oklch(72% 0.006 60)`; spacing between paragraphs 16px (`mb-4`); the block after the body has mb 32px | computed + JS |
| Breadcrumb | DM Sans 13px / 17.33px; colour `oklch(55% 0.006 60)`; mb 24px | computed |
| H1 (title) | "Playfair Display", serif; 36px; line-height 45px (1.25, `leading-tight`); weight 700; mb 16px | computed |
| Meta line (date · type · source) | DM Sans 13px; date in gold `oklch(75% 0.08 70)`; type uppercase, letter-spacing 0.325px; mb 24px | computed |
| Tag pills | DM Sans 13px; padding 4px 10px; 1px border `oklch(100% 0 0 / 8%)`; rounded; row mb 32px | computed |
| Hero image | 680px wide; 16:9 aspect ratio; `object-cover`; rounded; mb 32px | JS `aspectRatio:"16/9"` |
| Section label | DM Sans 11px; weight 600; letter-spacing 0.12em; uppercase; colour `#cfa576` | `.section-label{…}` |
| H2 (section, e.g. "Related Resources") | Playfair Display 24px / 38.4px; weight 700 | computed |
| Card H3 | Playfair Display 15px / 20.6px; weight 700 | computed |
| Gold | `--gold: oklch(75% .08 70)` (fallback `#c9a84c`) | CSS |
| **Body H2/H3, blockquote, inline figure, figcaption, lists** | **Not determinable.** The reference body is plain paragraphs. The CSS has no `blockquote`, `figcaption` or prose rules, and the JS renders no rich body. | OQ-1 |

## 2. Acceptance list

### A. Post body layout (PL)
Applies to the BSI post body, both `/posts/:id` (`PostDetailPage`, `.posts-detail-content`) and the reader body on `/library/:type/:id` (`.library-reader-body`). See OQ-3.
- **PL1** The body column's max-width is 680px at every viewport ≥ 768px. At narrower viewports it is the container width minus 16px padding on each side.
- **PL2** Body paragraphs use "DM Sans", sans-serif at 16px, line-height 26px (1.625), weight 400. The spec today is 1.05rem / 1.7 in Plus Jakarta Sans; this changes it.
- **PL3** Paragraphs have 16px between them and none before the first block (keep `> *:first-child{margin-top:0}`).
- **PL4** The post title (H1) uses "Playfair Display", serif at 36px, line-height 1.25, weight 700, mb 16px on desktop. Mobile size: OQ-4.
- **PL5** The meta line uses DM Sans 13px; mb 24px below the meta and tag rows, as in §1.
- **PL6** ~~The hero/featured image is the full body measure (≤ 680px), 16:9, `object-fit: cover`, rounded, mb 32px.~~ **Retired (D3):** the hero image is out of scope and stays as on main.
- **PL7** Inline body images are `max-width:100%`, `height:auto`, and never wider than the 680px measure.
- **PL8** Body H2/H3, blockquote, figure/figcaption and lists get only the values Ethan or Web Lead supply under OQ-1. Until then they keep the current styles, scaled to the PL2 base. No invented values.
- **PL9** The breadcrumb, when shown, uses DM Sans 13px with mb 24px.
- **PL10** Only layout and typography change. Locked/preview/join UX, `SafeHtml` sanitising, head/meta tags and the comments area behave the same as on main (existing tests pass unchanged).
- **PL11** No horizontal scroll at 390px. Long URLs or code in the body wrap (`overflow-wrap:anywhere` on the body).
- **PL12** (D2) Shared post styles, if used, live in one `post-prose.css`. It is imported only by `PostDetailPage` (`/posts/:id`) and the `/library/:type/:id` reader page. A repo grep finds no other import of `post-prose.css`, and the `/library` list and `ResourceCard` fonts are unchanged from main.

### B. Search page (SR)
Route: **`/library/search`** (E1). Top to bottom:
- **SR1** Breadcrumb `HOME / RESOURCE LIBRARY / SEARCH`. The reference uses `.section-label` (11px, 600, 0.12em, uppercase, `#cfa576`), mb 16px. HOME links to `/`, RESOURCE LIBRARY links to `/library`, SEARCH is the current page (`aria-current="page"`). The page lives at `/library/search` and must not be matched by `/library/:type/:id`.
- **SR2** H1 "Search All Resources", centred, in "Playfair Display", serif; font-size `clamp(28px, 4vw, 48px)`, weight 700, colour `oklch(95% 0.006 60)`, mb 24px.
- **SR3** Search box: centred, max-width 42rem (`max-w-2xl`). It is a dark field, background `oklch(11% 0.004 60)` with a 1px border in gold at 25% alpha (`#…40`), padding 12px 16px, rounded, with a search icon in gold. The input's placeholder is exactly "What are you looking for?" and it has an `aria-label`. Text is 14px DM Sans.
- **SR4** A gold SEARCH button (background gold `oklch(75% 0.08 70)`, text `oklch(9% 0.004 60)`, weight 700, 12px uppercase, letter-spacing 0.08em, padding 6px 16px). Pressing Enter or clicking the button submits. A clear (×) control appears when the input has text. **(B2)** Search is submit-only. The input is local state, only a submit writes `?query=` to the URL, and only the URL drives the fetch. Typing makes 0 requests, with no debounce-on-type. × clears the input only, with no fetch until submit.
- **SR5** Content-type pills in this order: All Types, Videos, Articles, Live Streams, Infographics. The selected pill is gold background with dark text and a gold border. Others are background `oklch(11% 0.004 60)`, text `oklch(80% 0.006 60)` and border `oklch(100% 0 0 / 8%)`. Pills are 12px, weight 600, padding 6px 12px. "All Types" is selected on load. Mapping to the existing slugs in `CONTENT_TYPE_CHIPS`: Videos→`videos`, Articles→`articles`, Live Streams→`webinars`, Infographics→`infographic`, sent as `content_type_terms[]`. Exactly one pill is lit (E3: pills are the only type control). Pills and topic tabs are independent: changing one doesn't reset the other.
- **SR6** A full-width topic tab bar below the hero: background `oklch(10% 0.004 60)` with a 1px bottom border at 8% white, sticky at top. Tabs are 12px, weight 600, letter-spacing 0.04em, padding 14px 16px, `white-space:nowrap`, and the bar scrolls horizontally with the scrollbar hidden. The active tab has gold text and a 2px gold bottom border. Inactive tabs have text `oklch(80% 0.006 60)` and a transparent border. "All" is always first and active when `topic` is unset. When `topic` is set, the tab with that id is active. When `topic` isn't in the resolved list, **no** tab is active (C1, SR13). At most one tab is ever active.
- **SR7** (E2) The tabs after "All" are: Sanity `searchTopics` entries in Sanity order, then `/api/library/filters` `topics` in API order, deduped by topic id. The first occurrence wins, so the Sanity label overrides the API `name`. No hardcoded list and no cap. Ethan's 8 example labels show only if BSI or Sanity supplies them.
- **SR8** (E2, E3) Selecting a tab sets `topic=<id>` and sends `topics[]=<id>`, combined with the query and the current pill. Clicking "All" clears `topic`. A tab never changes the pill.
- **SR9** The count line is left-aligned, 14px, colour `oklch(80% 0.006 60)`. It reads `{n} resource(s)`, plus ` for "{q}"` when a query is set and ` in {Tab label}` when a topic tab is active. Example: "3 resources in Infographics". "resource" is singular at n=1. n is `meta.total`.
- **SR10** "× Clear filters" is right-aligned on the same row and shows only when a query, a non-All tab or a non-All pill is set. It resets all three and refetches.
- **SR11** Results use the existing `ResourceCard` in a grid of 1 column (mobile), 2 (sm) and 3 (md+), with a 20px gap. Paging reuses the existing archive pagination (`useInfiniteArchive`). No new pager.
- **SR12** Empty results show "No results found" (Playfair, 18px) and "Try a different search term or browse by category above." A fetch error shows a retry and never shows a blank page.
- **SR13** (R4, E3) State lives in the URL (`/library/search?query=&type=&topic=`). `type=` holds one `CONTENT_TYPE_CHIPS` slug, set only by a pill. `topic=` holds a positive integer topic id. Reload and back/forward restore it. Invalid values fall back to All. A `topic` id that isn't in the resolved tab list is still sent, and "All" is not lit for it; see TC2.
- **SR14** Mobile at 390px: no horizontal page scroll (only the tab bar scrolls), and the pills wrap.
- **SR15** Keyboard and a11y: the pills and tabs are buttons with `aria-pressed` or `aria-selected`, focus is visible, and Enter in the input submits.
- **SR16** (E1) **`/library` search hands off:** submitting the existing `/library` search form navigates to `/library/search?query=<trimmed q>` (SPA navigation, no full reload), carrying the active `/library` type chip as `type=<slug>` when it's one of the SR5 pill slugs. An empty submit goes to `/library/search` with no query. `/library`'s other rails, browse and filters are unchanged. `KNOWN_ROUTES` and `Map.tsx` are out of scope.
- **SR17** **(B3)** Results go through `useInfiniteArchive({kind:"search", params}, resetKey)`, which aborts on reset. `resetKey` is the canonical URL query string (sorted query, type, topic). One tab, pill or submit change makes exactly 1 search with the previous one aborted, and the same state never refetches. No second effect calls `fetchLibrarySearch` directly.
- **SR18** (E1) A direct load of `/library/search` and of `/library/search?query=x` serves the SPA and renders the page, on the deployed Worker as well as locally, never NotFound or a Worker 404. Covered with SR19.
- **SR19** (C3) `client/src/const.ts` `KNOWN_ROUTES` gains exactly one entry, `"library"`, and nothing else in that file changes. `getRouterBase()` returns `""` for `/library`, `/library/search` and `/library/post/1` at the root. The existing const or router tests still pass, and one unit case is added for `/library/search`.

### C. Sanity: editable topic list (SN)
- **SN1** (E2) The smallest addition is one field on the existing `siteSettings` doc: `searchTopics`, an ordered `array` of objects `{topic_id: number (required, integer > 0; the BSI topic term id), label: string (optional; overrides the API name)}`. It sits in a new "Search" group, and each row previews its label or id. No max, no `kind` and no `typeSlug` (E3). No new document type.
- **SN2** Ethan can reorder, rename, add and remove items in Studio. A publish shows on the site with no deploy (the CDN read may lag by up to ~60s).
- **SN3** (B1) The client reads it with the existing token-free `sanityClient` (`useCdn:true`, `perspective:"published"`), through **the existing** settings read: add `searchTopics[]{topic_id,label}` to `SITE_SETTINGS_QUERY` (client/src/lib/content.ts) and map it in `fetchSiteSettings`. `fetchSiteSettings` is memoised as one module-level promise, so nav, footer and the search page share 1 request per page load. No separate Sanity query, no polling, and no refetch on a tab change.
- **SN4** (E2) **Fallback:** Sanity missing, empty or failing → API topics only. API failing or empty → Sanity entries only. A Sanity entry with no label while the API failed uses the label `Topic {id}`. **Both empty or failing → only "All".** Never a hardcoded list and never a blank bar. Invalid Sanity rows (missing or non-integer or ≤ 0 `topic_id`) are skipped one at a time. Duplicate ids within Sanity keep the first.
- **SN5** (E2, B4) Topics come from one module-level cached `fetchLibraryFilters` promise shared with LibraryPage, read once per page load, never per tab click. A search doesn't wait on it unless `topic` is set, and even then it sends `topics[]` from the URL without waiting.
- **SN6** (E2) **No seeding:** `scripts/seed-sanity.ts` gains no `searchTopics`. The PR contains no hardcoded topic list (grep the diff for the 8 example labels outside tests and this spec).
- **SN7** ~~The Project records each tab's kind and value~~ **Retired (E2, E3).** Ids come live from the API. The Project lists the topics the preview's filters read returned in the PR body (names and ids only, no credential).

### D. Security (SEC), standing rules
- **SEC1** The browser never calls `brokenscience.org/wp-json`. All data goes through same-origin `/api/library/*`. Built-bundle scan: no `wp-json` URL is reachable from client code.
- **SEC2** (B6) No token in the client. Use only the existing token-free `sanityClient`. No new `VITE_*` var, and `/library/search` doesn't import `Map.tsx`. no `VITE_SANITY_API_READ_TOKEN` and no `VITE_*` secret. The existing `sanity.vite-guard.test.ts` keeps passing, and a `dist/` grep for `sk`-style Sanity tokens and `VITE_SANITY_API_READ_TOKEN` finds nothing.
- **SEC3** (E4; approved by Ethan via CEO on 10-22, relayed by Web Lead under its 10-15 rule (C5), not confirmed to me directly. **It is an exception to the standing rule, and the merge needs Ethan's direct go**) Logged out, locked, exclusive and gated items show in /library/search results **with a lock**, exactly as `/library` does: the same `ResourceCard` with `isLockedCard` / `onOpenLocked` → `JoinModal`. No hide filter, and no use of `isFreeOpen` on this page. The count is `meta.total`. Paging uses `meta.has_more` and the upstream offset.
- **SEC7** (E4 guard) A locked card shows only the metadata `/library` already shows: title, excerpt, date, type and topic labels, author, thumbnail `image` and the lock badge. The search list carries no `content` or `video` fields (`LibraryResource` has none), and the page renders no gated body or media URL. Clicking a locked card opens the join modal, not the item body. The item route's own locking (`locked:true` → body withheld) is unchanged.
- **SEC4** No new Worker route, upstream header or credential. Upstream headers stay as on main (X-API-Key, Accept, UPSTREAM_USER_AGENT; Bearer only with a session).
- **SEC5** The query string is length-capped at `QUERY_MAX` (120) client-side, and the Worker cap stays. Nothing user-typed is rendered as HTML.
- **SEC6** No token values or credentialed URLs in logs, test output or the PR body.

### E. Tests and checks (TC)
- **TC1** Unit: the tab resolver (E2). Covers Sanity first then API, dedupe by id with the Sanity label winning, Sanity empty or failing, API empty or failing, both empty → only "All", invalid Sanity rows skipped, and duplicate Sanity ids.
- **TC1b** Mount (B1, B2, B3): with nav, footer and /library/search mounted, `sanityClient.fetch` is called exactly once. Typing 10 characters makes 0 search calls, and a submit makes 1. Two quick tab clicks abort the first signal and render 1 result set.
- **TC2** Unit: params and URL per action (SR5, SR8, SR13). A tab sends `topics[]=<id>` and keeps the pill. A pill sends `content_type_terms[]=<slug>` and keeps the tab. Only one type value is sent. Invalid `topic` or `type` falls back to All. Also covers the count line (SR9: singular, plural, with query, with tab label, n = `meta.total`).
- **TC3** Mount (E4, SEC3, SEC7): logged out, a fixture with 5 items, 2 of them locked or exclusive. All 5 cards render, the 2 with a lock. The count equals `meta.total`. Clicking a locked card opens `JoinModal` and doesn't navigate. The DOM contains no `content` or `video` value from the fixture. This mirrors /library's card test.
- **TC4** Mount: `/library/search` renders the elements of SR1–SR10 in that order. Clear filters resets the state.
- **TC5** Computed style checks (headless, 1440px and 390px) for PL1, PL2, PL4, SR2, SR5 and SR6 against §1 values, with ±1px tolerance.
- **TC6** `npm test`, `tsc` and `check:worker` pass. Existing posts and library tests pass unchanged.
- **TC7** Bundle scan for SEC1 and SEC2.
- **TC8** (SR16, SR18) Mount: submitting `/library`'s search form with `q` and an active Videos chip navigates to `/library/search?query=q&type=videos`. `/library/search` renders the search page, not `LibraryDetailPage`.
- **Mutation (advisory only, gating at 0, no full runs, no reruns):** a small targeted set of 5 mutants: SN4 both-empty (fall back to a hardcoded list), E2 dedupe (API label wins over Sanity), SR9 plural, SR5 slug map (Live Streams→`videos`), SR16 handoff (drop `query`).

### F. Box / post-deploy checks (PD)
- **PD1** On the preview deploy, open `/library/search` (a direct load and a load from the `/library` search box). Confirm it shows "All" plus the API/Sanity tabs, the 5 pills and the placeholder, and that the count updates on a tab click.
- **PD2** Network tab: only `/api/library/*` and `*.apicdn.sanity.io` requests, with no `brokenscience.org/wp-json` and no `Authorization` header to Sanity.
- **PD3** In Studio, on a preview dataset only, never prod: add one `searchTopics` entry with an existing topic id and a custom label. It appears first, with no duplicate. Remove it, and the API order returns.
- **PD4** Logged out, search for a known exclusive title. It appears with a lock, the click opens the join modal, and the network shows no body or media URL for it (SEC3, SEC7). Ethan's direct OK on E4 must be on record before merge.
- **PD5** Compare a long BSI post at 1440px and 390px side by side with the reference (PL1–PL5, PL7), with screenshots attached to the PR.

## 3. Open questions
- **OQ-1** (open, held by LB9 to main's styles, R6) Body H2/H3, blockquote, figure/figcaption and list styles. The reference page has none (plain paragraphs only, and no rules in its CSS). Pick one: (a) give values from another reference page that has them, (b) derive from the scale (for example H2 = Playfair 24px as the page H2), or (c) leave as is. The spec currently says (c).
- **OQ-2** Colour: the reference is dark (body text `oklch(72%…)` on near-black), and `/posts` is light cream. Does "match the body layout/typography" include the dark theme? The spec assumes **no**: only sizes, measure and fonts, with colours kept.
- **OQ-3** Which post pages are in scope: `/posts/:id`, `/library/:type/:id`, or both? The spec assumes both. Also, should the 2-column grid with an author sidebar (379px) be included? The spec assumes **no** (no new author data).
- **OQ-4** The mobile H1 size isn't separately set in the reference (36px at both widths). Keep 36px on mobile?
- **OQ-5** **Closed (E1, relayed): `/library/search`, with the handoff in scope.** ~~ Route `/search` (as in the reference) or `/library/search`? Should the `/library` search box hand off to it?~~
- **OQ-6** (ruled R1, R3, R7: the Project does the live read and records ids and kinds per SN7) Topic mapping: are the 8 tabs BSI `topics`, or are some BSI `categories` or `content_type_terms` (for example "Infographics" and "Whiteboards" are content types on main, and "Professional Library" may be a category)? This needs BSI slugs per tab; I can't confirm them without a live `/api/library/filters` read. If any tab is not a topic, SN1 gets a `kind` field (topic|category|type).
- **OQ-7** Is rlhome.emilydesigns.org the deployed build of Curie-and-Co/mia-metfix? Should mia-metfix's source be preferred where they differ?
- **OQ-8** **Closed (E2, relayed): no seed; tabs come from the API plus Sanity.** ~~ Who runs the seed or creates the 8 entries in prod Sanity? (Ethan manages content.)~~
- **OQ-9** **Ruled (E4, relayed): show with a lock. Approved via CEO on 10-22, relayed (C5). The merge needs Ethan's direct go.** ~~ SEC3 vs main `/library`, which shows gated and exclusive items with a lock to logged-out users. Confirm `/search` hides them (standing rule) or matches `/library`. A security-rule exception needs Ethan's direct OK; a relay doesn't count.~~

- **OQ-10** ~~SEC3 field direction~~ **Closed (R12, relayed):** hide exclusive and gated items through `isFreeOpen`.
- **OQ-11** ~~AND or OR in `content_type_terms[]`~~ **Retired (R11):** only one type value is ever sent.
- **OQ-13** **Closed (C3, relayed): option (a).** The `"library"` entry in `KNOWN_ROUTES` is in this PR (SR19).
- **OQ-12** ~~Which pill lights for a type tab with no pill~~ **Closed (R13, relayed):** option (a), no pill lights.

## 4. Changelog
- 1.0.6 (2026-10-22): scope rulings relayed from Web Lead, recorded as §0d D1–D6. 59 IDs (58 + PL12; PL6 retired but kept as an ID).
  - Removed every QA test-list md5 pin (header notes 1.0.1, 1.0.2, 1.0.5, §0c heading, R10, changelog 1.0.1/1.0.2/1.0.5). Lists are named by revision only. CQ note pin and reference-asset hashes kept.
  - PL6 retired (hero out, D3). TC5 and PD5 updated to match.
  - New PL12: `post-prose.css` imported only by the two post pages; no font swap on the `/library` list.
  - R8, E1, C3 and §0: shared prose styles now allowed (D2); in-scope routes named (D1).
  - D4–D6 (lock, `meta.total`, no visibility filter module) checked against SR9, SEC3, SEC7, TC2, TC3, PD4: no conflict.
- 1.0.5 (2026-10-22): doc cleanup only, no behaviour change (QA r1.3, relayed from Web Lead), recorded as §0c C1–C5.
  - SR6 follows SR13: an unknown topic lights no tab.
  - SR9 and SR10 lose the type-tab wording.
  - OQ-13 is closed (a), and new SR19 puts the `KNOWN_ROUTES` `"library"` entry in scope. R8 and E1 are amended.
  - TC1b, TC4 and SEC2 now name `/library/search`.
  - E4/SEC3/OQ-9 record the relayed approval under E-R9, which Ethan hasn't confirmed to me directly. The merge still needs Ethan's direct go.
  - Removed a duplicate "Top to bottom" line.
- 1.0.4 (2026-10-22): Ethan's answers (relayed via CEO and Web Lead) as §0b E1–E4.
  - Route `/library/search`, with the `/library` handoff in scope (SR1, SR13, SR16, new SR18, TC8).
  - Tabs: Sanity `topic_id` entries first, then API topics from `/api/library/filters`, deduped by id. "All" always shows; no seed and no defaults; both sources empty → only "All" (SR7, SN1, SN3–SN7).
  - Type tabs retired: R10 and R13 retired, R11 reduced, `kind` and `typeSlug` dropped; types are on the pills only (SR5, SR6, SR8).
  - OQ-9: locked items show with a lock like /library. The `isFreeOpen` hide is removed, and the count and paging use `meta.total` and the upstream offset (SEC3). This is a standing-rule exception that needs Ethan's direct confirmation before merge. New SEC7 leak guard.
  - TC1–TC3, PD1, PD3 and PD4 are rewritten. Mutants are 5, advisory, gating 0.
  - Freeze pending list lifted. New OQ-13.
- 1.0.3 (2026-10-22): R13 (relayed from Web Lead) takes OQ-12 option (a): a type tab with no matching pill lights no pill. OQ-12 is recorded as closed. SR5, SR6 and TC2 are updated. The spec is marked frozen except for Ethan's pending answers via CEO on OQ-5, OQ-8 and OQ-9. No IDs were added or removed.
- 1.0.2 (2026-10-22): MetFix Web Lead's rulings (relayed) on QA r1.1, recorded as §0a R10–R12.
  - SN1: type rows store a `CONTENT_TYPE_CHIPS` slug (`typeSlug`); topic rows keep the integer `bsiTermId`.
  - SR8 and SR13: a type tab writes the same `type=<slug>` state as a pill, lights it and resets the topic. A topic tab sets `topic=<id>`. Only one type value.
  - SR5, SR6, SR9 and SR10 are aligned with that.
  - SN4, SN6, SN7, TC1, TC2 and PD3 are updated. The mutation set goes from 4 to 6 (adds the R11 reset).
  - OQ-10 closed (R12); OQ-11 retired.
- 1.0.1 (2026-10-22): MetFix Web Lead's rulings (relayed) on QA list r1.0 and CQ note `94f99437`, recorded as §0a R1–R9.
  - SN1 now stores the BSI term id (int), a label and an optional kind (topic/type, default topic), with no lookup.
  - SR8 routes by kind. SR13 `type=` holds the slug.
  - SN5: tabs don't depend on the filters read (B4).
  - SN3: one shared settings read (B1).
  - SR4: submit-only search (B2).
  - New SR17: one aborting fetch per state change (B3).
  - SEC3: logged-out hiding through one pure function reusing `isFreeOpen`, with the count from the filtered list and paging on the upstream offset (B5, R5).
  - SEC2 adds B6.
  - SR16 handoff, `KNOWN_ROUTES`, `Map.tsx` and shared prose styles are out of scope (separate PRs).
  - New SN7, TC1b, OQ-10 and OQ-11. TC1, TC3, PD3, PD4 and the mutation set are updated.
- 1.0 (2026-10-22): first rev.
