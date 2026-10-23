# metfixhome: post layout + /search, CQ pre-build notes (MetFix Web Code Quality)

- Spec: metfix-pr-post-layout-search-acceptance.rev1.0.md, md5 5855043c499689b957890a7711cfdf2b (verified)
- Base: main 5465f0d8 (throwaway clone; read only). Beta Curie-and-Co/mia-metfix read at HEAD (depth 1).
- Lean: build to these; anything not listed here or in the spec waits for a follow-up PR.

## Blockers (build-to; a PR that misses these gets changes-required)
- **B1 One Sanity read for settings, no new fetch path.** `useSiteSettings` (client/src/hooks/useSanityContent.ts:23) is called by both GlobalNav.tsx:144 and CopyrightText.tsx:20, and each call fetches. Add `searchTopics[]{label,bsiTopic}` to the existing `SITE_SETTINGS_QUERY` (client/src/lib/content.ts:57) and map it in `fetchSiteSettings`. Memoise `fetchSiteSettings` as one module-level promise so nav, footer and /search share a single request per page load. No separate `useSearchTopics` Sanity query, no polling, no refetch on tab change.
- **B2 No per-keystroke upstream calls.** SR4 is submit-only (Enter/button). The input is local state; only submit writes `?query=` to the URL, and only the URL drives the fetch. No debounce-on-type search. Clear (×) resets input only; it doesn't fetch until submit (Clear filters, SR10, does one refetch).
- **B3 One fetch per state change, stale ones aborted.** Feed results through `useInfiniteArchive({kind:"search", params}, resetKey)` (client/src/pages/library/useInfiniteArchive.ts), which already aborts on reset (lines 77–117). `resetKey` = the canonical URL query string (sorted query/type/topic), so the same state never refetches and React StrictMode double-mount is the only duplicate. Don't add a second effect that calls `fetchLibrarySearch` directly.
- **B4 One filters read, shared.** SN5 and SR8 need `/api/library/filters` (slug→numeric term id: `topics[]` is `number[]` in api.ts `SearchParams`, `bsiTopic` is a slug). Wrap `fetchLibraryFilters` in a module-level cached promise reused by LibraryPage.tsx:189 and /search. Don't fetch filters per tab click. Don't fire search until filters resolve when a topic is set (otherwise you get one wasted unfiltered request).
- **B5 SEC3 filter in one shared pure function**, in shared/library (beside access.ts), used before render and before the count, unit-tested (TC3). The count must come from the filtered set, not `meta.total`, whenever filtering drops rows. Otherwise SR9 ("n is meta.total") contradicts SEC3. Web Lead must rule (see OQ-9 / Q1).
- **B6 No token or secret in the bundle.** Use the existing token-free `sanityClient` (client/src/lib/sanity.ts: `useCdn:true`, `perspective:"published"`). `VITE_SANITY_API_READ_TOKEN` stays unset (vite.config.ts throws if set; sanity.vite-guard.test.ts must still pass). No new `VITE_*` var. Map.tsx's `VITE_FRONTEND_FORGE_API_KEY` is pre-existing and untouched here, so it's not in scope; don't import Map on /search.

## 1. Reuse (name the files; no re-creation)
- Data: `client/src/pages/library/api.ts` (`fetchLibrarySearch`, `fetchLibraryFilters`); `useInfiniteArchive.ts` (paging, dedupe, abort); `ResourceCard.tsx` for results; `shared/library/constants.ts` `CONTENT_TYPE_CHIPS` and `QUERY_MAX`.
- Pill map: derive SR5 pills from `CONTENT_TYPE_CHIPS` by slug (`videos`, `articles`, `webinars`, `infographic`) with label overrides. Don't keep a second hard-coded slug list.
- Bodies: `SafeHtml` (client/src/components/SafeHtml.tsx) unchanged. PL work is CSS-only on `.posts-detail-content` (posts.css:269) and `.library-reader-body` (library.css:522).
- Routing: add `<Route path="/search">` in App.tsx, lazy like PostDetailPage. Add `"search"` to `KNOWN_ROUTES` (client/src/const.ts:18). `/search` is a client route served by SPA assets: no wrangler `run_worker_first` entry, no Worker route (SEC4). FYI: `library` is also missing from KNOWN_ROUTES on main; that's harmless with `base:"/"`, so it's a follow-up.
- URL state: reuse the URLSearchParams/`replaceState` pattern in LibraryPage.tsx (~94–101, 369). Use push on submit and tab click so back/forward works (SR13).
- Beta (mia-metfix): only `src/components/SearchModal.tsx` exists, a static modal with no fetch. There's no search page, topic bar, or ResourceDetail/prose component to reuse. The reference bundle's components aren't in the repo (relates to OQ-7). Nothing to port; reuse main's library code.

## 2. Sanity schema (smallest change)
- One field on the existing `siteSettings` (sanity/schemaTypes/siteSettings.ts; groups already exist, so add `{name:"search"}`): `searchTopics: array of object {label: string required, bsiTopic: string required}`, `validation: Rule.max(8)`, and a preview on `label`. No new doc type. No `kind` field unless OQ-6 says some tabs aren't topics.
- Read: the existing settings query (B1). GROQ: `*[_type=="siteSettings"][0]{copyrightText, navLinks[]{...}, searchTopics[]{label,bsiTopic}}`.
- Defaults: one `DEFAULT_SEARCH_TOPICS` constant beside `DEFAULT_NAV_LINKS`, used by both the client fallback (SN4) and scripts/seed-sanity.ts. Import it; don't copy it.
- Resolution as one pure function, `resolveSearchTopics(rows, filters) → Tab[]`: drop invalid rows one at a time, drop slugs not in filters (SN5), fall back to the defaults when the result is empty. Unit-test it (TC1). The caching is the CDN plus the memoised promise; no localStorage.

## 3. No token in client
- Covered in B6. In addition, all BSI data goes through same-origin `/api/library/*` (SEC1). /search must not import from `shared/library/constants.ts`'s `BSI_*` bases at runtime in client code. Better: those constants shouldn't be reachable from the client bundle at all, since the bundle grep would catch them (TC7).

## 4. CSS
- Main's approach is a plain per-page stylesheet with scoped custom properties (`--posts-*` in posts.css, `--lib-*` in library.css) plus global tokens and fonts in index.css. DM Sans and Playfair are already loaded (client/index.html:80). Tailwind/shadcn are only in components/ui.
- /search: `client/src/pages/search/search.css` with a `--search-*` (or reused `--lib-*`) block for the oklch values. Each colour is defined once as a variable and never repeated as a literal.
- No inline `style={{}}` objects in new code. One already exists at LibraryDetailPage.tsx:159; don't add more.
- Post body: put a shared measure/type rule set on both selectors (`.posts-detail-content, .library-reader-body { max-width:680px; font: 400 16px/26px var(--font-dm-sans); overflow-wrap:anywhere }`) in one place rather than duplicated. Keep `> *:first-child{margin-top:0}`. PL3 16px replaces the current 1.1rem. Use the `img{max-width:100%;height:auto}` that already exists. Use `aspect-ratio:16/9; object-fit:cover` for the hero. No invented H2/blockquote values (PL8 / OQ-1).
- Tab bar scroll: `overflow-x:auto` with `scrollbar-width:none` and `::-webkit-scrollbar{display:none}`. Sticky only on the bar itself.

## 5. Request frequency (summary)
- Page load: 1 settings read (shared, B1), 1 filters read (shared, B4), and 1 search (B3). A tab, pill or submit causes exactly 1 search with the prior one aborted. Typing causes 0. Load more causes 1 per page via the hook. Topics never refetch within a page view.

## 6. Rules
- **Rule 4:** no exported test seams in production modules (no `__setFetch`, `resetCacheForTests`, or test-only props on SearchPage). To test the memoised promises, use `vi.resetModules()` or dependency injection through the function parameter, not a prod reset export.
- **Rule 6:** scope is the spec's A/B/C only. Anything that comes up (KNOWN_ROUTES `library`, the Map.tsx key, the `/library` → `/search` handoff if OQ-5 says later, prose H2/blockquote) goes in its own PR once round 1 starts.

## Questions for Web Lead
- Q1 (B5): SEC3 filtering vs SR9 `meta.total`. Pick a filtered count, or Worker-side omission. A client-side filter with `meta.total` gives a wrong count and breaks paging (pages come back short). If client-side, `hasMore` must still use the upstream offset.
- Q2: OQ-6 decides whether SN1 needs `kind`. Hold the schema until it's answered, since adding a field later is cheap but a wrong slug ships empty tabs.

## What a lint rule, type, test, or CI check could catch
- B1/B4 duplicate fetches: a mount test counting `sanityClient.fetch` and `fetch('/api/library/filters')` calls (expect 1 each with nav, footer and /search mounted).
- B2: a test that types 10 characters and expects 0 search calls, then submits and expects 1.
- B3: a test that clicks two tabs quickly and expects the first signal aborted, with 1 rendered result set.
- B5/SEC3: unit test TC3 plus the advisory mutant (drop `is_exclusive`).
- B6/SEC1/SEC2: the existing vite-guard test, plus the TC7 `dist/` grep as a CI step (`wp-json`, `VITE_SANITY_API_READ_TOKEN`, `sk[A-Za-z0-9]{20,}`).
- Inline styles: eslint `react/forbid-dom-props` / `react/forbid-component-props` with `style` on `client/src/pages/**` (follow-up tooling PR).
- Duplicate slug list: a type, `type PillSlug = (typeof CONTENT_TYPE_CHIPS)[number]["slug"]` (needs `as const`), so a wrong slug fails `tsc`. The advisory mutant (Live Streams→`videos`) is covered by TC2.
- `topics[]` slug vs id mix-up: `tsc` already catches it (`number[]`). Keep it that way; don't widen it to `string`.
- KNOWN_ROUTES/App route drift: a unit test asserting every top-level `<Route>` segment is in KNOWN_ROUTES.
- Rule 4: grep CI for `ForTests|__set` exports outside `*.test.*`.
- Only judgment catches: reuse vs re-creation, and the CSS-variable discipline (stylelint `color-no-hex` / a custom oklch-literal rule outside `:root`-style blocks can partly cover it).
