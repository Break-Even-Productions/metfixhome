# metfixhome #18 (post layout + Search), CQ round 1
Head 84d84d5d4e34b27366931171b75acc82b1076785, base main 5465f0d8. Read-only; throwaway clone /workspace/tmp/pr18. Prebuild notes 94f99437ce747c31f5d5bf36a56aef0a.

## Verdict: CHANGES REQUIRED (2 blockers, 1 ruling needed)

## Pin check
- List `metfix-pr-post-layout-search-tests.md` r1.3 (69be384b09b81b1624007db328925a07) pins spec 1.0.4 `1c59b421…`; the 1.0.4 file's md5 matches. Header gate 57 = 57 IDs in its own gate-ids block. OK for 1.0.4.
- Spec 1.0.5 (79f4b521ee69db470c8f0948fade7578) exists and the list has not been re-pinned to it. 1.0.5 also names the list's md5 (line 5), which breaks the one-way pin rule. 1.0.5 moves `KNOWN_ROUTES` "library" in scope (C3/SR19), while list r1.3 still carries the "KNOWN_ROUTES no-change" check. The code follows 1.0.5. QA needs to re-pin.

## Reproduced
- `npm ci --legacy-peer-deps` 0; `npm test` 64 files / 990 pass / 0 fail; `tsc --noEmit` 0; `check:worker` 0.
- `test:workers` (after build:cf) 26/26 + 1/1 pass.
- `npm run build:cf` 0. Grep of dist/public for `sk…{40,}`, `SANITY_API_READ_TOKEN`, `wp-json`, `X-API-Key`, `BSI_API`: 0 hits.
- `npm run build` fails (`server/index.ts` is missing). That's pre-existing on main and isn't used by CI.
- GitHub checks at head: test-and-build, test-workers and Workers Builds are all SUCCESS. The CI-green claim holds.

## Blockers
1. **B5 locked filter is a dead no-op with a misleading toggle.** `shared/library/searchVisibility.ts:18-27`: both branches return `items.slice()`. Flipping `SEARCH_VISIBILITY_MODE` to "hide" would silently still show locked items, so the toggle is a security footgun, and the `_opts` param is underscore-prefixed but used. Under spec E4/SEC3 (lock; count = `meta.total`; no hide filter), the right code is no filter at all. Delete the file and its exports (`shared/library/index.ts:45-49`) and the `visibleItems` memo (`SearchPage.tsx:104-111`), and render `infinite.items` directly. Ruling conflict for Web Lead: the ruling relayed to me (count from a filtered list via one B5 filter) contradicts spec 1.0.4/1.0.5 E4/SEC3 (lock, `meta.total`). The code follows the spec; confirm that the spec wins. `/api/library/search` has no exclude-locked param (worker/library.ts:392-440 reads only query/limit/offset/content_types/content_type_terms/taxonomies).
2. **Shared prose styles are out of scope per spec 1.0.5 (E1/C3/R8: "shared prose styles stay out of scope").** The PR adds `client/src/styles/post-prose.css` (40 lines), `@import`ed from `library.css:2` and `posts.css:2`, plus the font-variable swap Plus Jakarta Sans → DM Sans for all of /library and /posts (`library.css:6`, `posts.css:6`) and reader typography rewrites. Under Rule 6, split these into their own PR, or Web Lead rules them in explicitly. The `LibraryDetailPage.tsx:154-162` hero image is likewise not a Search item; it needs a spec ID or a split.

## Nits (follow-ups)
- N1 `shared/library/searchTopics.ts:74` `isContentTypeChipSlug` is exported and re-exported but referenced only by tests (Rule 4 / dead export). Also `searchState.ts:18,46` export helpers used only internally (OK, but they could be module-private).
- N2 `SearchPage.tsx:63-72`: the mount effect calls `apply()`, which re-reads the URL the `useState` initializer already read (extra render; no refetch because resetKey is a string).
- N3 `SearchPage.tsx:153,157`: breadcrumb uses raw `<a href>` → full reload, which refetches the Sanity settings and filters. Use wouter `Link`.
- N4 `searchState.ts:54-61`: `history.pushState` is called directly, bypassing wouter. In-app links to `/library/search?query=…` while the page is mounted won't update `urlState` (no popstate).
- N5 `SearchPage.tsx:265-271`: the count line shows "0 resources" while loading (total resets to 0). Hide it or show "…" until status is data.
- N6 `content.ts:172-191,196-201`: the memo caches the fallback after a Sanity failure for the life of the tab (catch is inside the memoised promise). Clear the memo on error, as `filtersCache.ts:15-18` does.
- N7 `worker/library.ts:1044-1047`: adds a `/library/search/` → `/library/search` redirect not in SR18 (harmless, same handler, no new route/header/binding). `worker/library.test.ts:72-78` checks the source by regex rather than calling `handleLibraryHtml`. Make it a behavioural test (200 + hub head for GET/HEAD).
- N8 `search.css:23-25ff` re-declares the `--lib-*` palette because library vars are scoped to `.library-page`. Hoist the shared tokens once rather than copying hex values.
- N9 `SearchPage.tsx:20` imports all of `library.css` (and now post-prose) just for cards. Acceptable reuse, but note the chunk weight.

## B1–B6 + SR18
- B1 ✅ `SITE_SETTINGS_QUERY` gains `searchTopics[]{topic_id,label}`; module memo `content.ts:97,196`; nav, footer and search all use `useSiteSettings` → `fetchSiteSettings`; no new `createClient`. (N6 caveat.) Schema: `topic_id` int + optional label. There's no `kind` field, which matches spec E2/E3 (type tabs retired); the "kind topic|type" ruling relayed to me is superseded by E3.
- B2 ✅ input only sets local state; fetch is driven by `urlState` → `resetKey`; identical submit is a no-op; × clears the input only. 0 calls while typing (SS4 covered by the mount test).
- B3 ✅ `useInfiniteArchive(true, archive, resetKey)`; no second fetch effect; it adds `total` from `meta.total`.
- B4 ✅ `filtersCache.ts` caches one module promise shared with LibraryPage and resets on error. The search does not wait for filters (matches SN5 "not held"; the "waits" wording in the brief is superseded).
- B5 ❌ see Blocker 1 (identity function; should be removed under E4).
- B6 ✅ no new `VITE_` var; `sanityClient` is unchanged and token-free; dist grep is clean; CI adds a wp-json grep.
- SR18 ✅ `worker/library.ts:1044-1051` serves the hub HTML shell for `/library/search`. No new route, header, binding or secret; `wrangler.*` is unchanged. (N7.)
- Scope: `KNOWN_ROUTES` "library" (`const.ts:25`) and the /library → /library/search handoff (`LibraryPage.tsx:428-439`) are IN scope per spec 1.0.5 C3/E1, so they're not blockers. `Map.tsx` is untouched ✅. Prose styles: Blocker 2.
- Request frequency: one Sanity read, ≤1 filters call, 1 search per state change, and load-more once per page. Tab, pill and All clicks no-op when already active ✅. Abort is handled by the hook ✅.
- CSS: own `search.css` with vars; no new inline styles (the `LibraryDetailPage.tsx:168` inline style is pre-existing).

## What a lint/type/test/CI check could catch
- Blocker 1: a test asserting that hide mode drops locked items would have failed. Better: delete the code. `@typescript-eslint/no-unused-vars` with an args-ignore pattern won't catch an underscore param that's used; a review lint for identical branches (`sonarjs/no-identical-functions`/`no-all-duplicated-branches`) would.
- Blocker 2: needs a CI scope check (a changed-path allowlist per spec ID). Lint can't judge scope.
- N1: `ts-prune`/`knip` unused-export check in CI.
- N3: `no-restricted-syntax` banning internal `<a href="/…">` in `client/src/pages/**`.
- N4: `no-restricted-properties` on `history.pushState` outside a router util.
- N6: a unit test (reject once, then call again → 2 fetches).
- N7: a behavioural Worker test instead of a source regex.
- N8: stylelint `color-no-hex` outside token files.
- N2, N5, N9, and the pin/list drift: review or QA process only. The list re-pin needs a CK-P1-style pin check.
