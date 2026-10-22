# MetFix Web CQ: PR #3 posts, notes against spec 1.1.14 (2026-10-21 ~8:40 AM PT)

Read-only. Throwaway clone /workspace/tmp/pr3. No comments, pushes or edits.

## 1. Pin check: OK
- Spec `metfix-pr3-posts-acceptance.rev1.1.14.md` md5 = `f481ede4d9a4e92f83b779a3847e3d9d`. Matches the expected value.
- QA list `metfix-pr3-posts-tests.md` (rev 1.12, md5 `c42735d4e23c1a8bbe0ae72085de518f`) has already re-pinned to 1.1.14 `f481ede4…`, and the pin equals the recomputed md5.
- Header counts compared with the list's own blocks (CK-P1 style; spec counts not read): gate-ids 100 = 100, box-ids 4 = 4, post-deploy-ids 7 = 7. No duplicates within or across blocks; 6 fences (3 blocks).
- Advisory only: the list's targeted set is 18 and spec §0l says 8. QA already flagged this, and with gating at 0 it isn't a pin failure. Web Lead should say which set counts as "the" advisory run (CQ recommends the set in §3 below).

## 2. Head state: the code doesn't exist yet
- PR #3 head is still `f8b6b98b3112eba0f4a1392a62c6e2147925b7d2` (base main). It changes 5 files: App.tsx (+/posts route), const.ts (+"posts"), document-base.test.ts (+3 paths), `pages/posts/PostsPage.tsx` (79-line **unavailable stub**, no fetch) and page.mount.test.tsx.
- None of the posts path exists: no `worker/posts*.ts`, no `shared/posts/`, no `/api/posts` dispatch, no wrangler `/posts*` entries, no SafeHtml or dompurify. So the notes below are **pre-build requirements** for the Project, not a diff review. A real review needs a new head.

## 3. Code notes for the Project (blockers first)
B1. **Replace the stub; don't extend it (A25/A26).** The current PostsPage.tsx is ~60 lines of inline `style={{}}` objects that repeat color and font literals (`#C9A96E` 3x, `#0A0A0A`, `'DM Mono'`, …) and a dead `UNAVAILABLE_COPY`. That's slop. Use the site's existing classes/tokens and one shared posts layout component for the list, detail and error states. Nothing from the stub's copy survives (PC1).
B2. **One fetch per page change, abortable (A19/A20).** Use one `useEffect` keyed on `page` (list) or `id` (detail) with an `AbortController` cleanup. No fetch in render, no second effect for meta, no StrictMode double-fetch left un-aborted, no refetch on focus/interval, no prefetching page N+1, no list→detail waterfall (detail fetches only `/api/posts/{id}`). Derive Older/Newer from `has_more` and `page`; never probe page+1. Ignore aborted responses: don't set state after unmount.
B3. **One Worker read path for HTML head and API (A11/A17).** `/posts/{id}` HTML and `/api/posts/{id}` must go through the same `getPost(id)` helper using the synthetic cache key, so a page load costs at most one upstream call, and zero on the client's follow-up fetch. Don't fetch the list again to build the list head; reuse the same cached list entry. Cache only mapped, D8-filtered JSON, never 503 or 404-locked responses, and never key on the raw request URL.
B4. **The key stays in the Worker (A4/A5/A21/A22/A23).** Only `env.BSI_POSTS_API_KEY`, read in one place (upstream.ts or posts.ts). No `VITE_*` var, no `import.meta.env` posts key, no `DAILY_FIX_API_KEY` fallback. Missing key → 503 `nokey` with zero upstream calls. Client URLs are relative `/api/posts…` only. Upstream headers are exactly the 3 in A4: no copying incoming headers, no Bearer, no Cookie.
B5. **D8 locked filter is fail-closed and applied before caching or mapping (A9).** Implement it as an allowlist predicate (`access === "full"` AND `is_exclusive === false` AND `has_content_access === false` AND `access_levels` empty array). Never treat a missing field as unlocked. Whitelist re-serialization (D7) only: no spread of the upstream object.
B6. **Error and unavailable states.** Worker: every non-404 upstream outcome (4xx, 5xx, 3xx, timeout, bad JSON, invalid `meta.total`, size cap) → 503 `{"error":"unavailable"}` no-store. Client: 404 → NotFound with pathname kept; 503/network → one error view with a Retry button that refetches once (a user action, not a timer). No silent empty list on 503. Loading state doesn't flash the 404.
B7. **Rule 4: no test-only production hooks.** No exported `__resetCache`, `__setFetch`, `_testOnly` or similar from `worker/**`, `shared/**` or `client/src/**`. Inject `fetch`/base URL the way PR2's `upstream.ts` does, and keep fakes and harnesses under test dirs.
B8. **Rule 6: no scope creep.** Only the A29 allowed-files. No sitemap (A24), no rate-limit binding (D12), no slug routes (D4), no Daily Fix or PR2 changes, no unrelated dependency bumps (only dompurify, exact-pinned, PC16).
N1. Use one `PAGE_SIZE` (12) and one id regex/max, both from `shared/posts/`; client and Worker import them (D11/A3). Don't repeat the literal `12`.
N2. One head builder `buildPostsHead` used by the Worker and `usePageMeta` (PH15); no duplicated title/description strings.
N3. Upstream content renders only through `SafeHtml` (DOMPurify). Title and excerpt are text nodes. No raw `dangerouslySetInnerHTML` in `pages/posts/**`.

## 4. Advisory mutation set (7; gating 0)
Targets are the planned files, because no lines exist at f8b6b98b. QA pins file:line at the first real head.
| ID | Mutant | Target | Expected killer |
|---|---|---|---|
| PM8 | copy incoming request headers into the upstream request | `worker/posts.ts` upstream header build (A4) | PW11 |
| PM12 | `env.BSI_POSTS_API_KEY ?? env.DAILY_FIX_API_KEY` | posts key read (A5/A23) | PW14, PW15 |
| PM22 | missing `content_access_display` treated as unlocked | D8 predicate (A9) | PW30 |
| PM35 | `SafeHtml` sets innerHTML without DOMPurify | `client/src/components/SafeHtml.tsx` (A14) | PC12, PC13 |
| PM41 | client fetches `https://brokenscience.org/wp-json/bsi/v1/posts` | PostsPage fetch URL (A21) | PC14, PX1 |
| CQ-M1 (new, CQ) | remove the AbortController cleanup / effect deps `[]`→none (refetch every render) | PostsPage list effect (A19) | PC fetch-count row (exactly 1 fetch per page change); add one if the list lacks an exact count after rerender + page change |
| CQ-M2 (new, CQ) | HTML `/posts/{id}` path bypasses the cache helper (direct upstream) | Worker HTML detail path (A11/A17) | PW cache row asserting upstream count 1 across HTML + API for the same id; add one if absent |
CQ-M1 and CQ-M2 are request-frequency mutants not in QA's 18. Proposed to QA as an advisory addition, which needs QA/Web Lead to accept them.

## 5. What a lint, type, test or CI check could catch
- Lint: B1 inline-style slop (`react/forbid-dom-props` style, or a no-inline-style rule in `pages/posts/**`); B4 `no-restricted-syntax` on `import.meta.env.*KEY*` and on `brokenscience.org` in `client/**`; N3 `react/no-danger` in `pages/posts/**` outside SafeHtml; N1 a `no-magic-numbers` / restricted-literal rule for `12`; B7 `no-restricted-exports` for `/^_|__/` in non-test files; the `no-restricted-globals: fetch` rule for `worker/**` (from the PR2 tooling follow-up).
- Type: B5 an `UnlockedPost` branded type produced only by the D8 predicate, with the mapper and cache accepting only that; B3 a cache helper whose key parameter is a `PostsCacheKey` brand, so the raw request URL can't be passed; B4 an `Env` type where posts code sees only `BSI_POSTS_API_KEY`.
- Test: B2 (exact fetch count + abort, CQ-M1); B3 (upstream count across HTML + API, CQ-M2); B6 (status mapping PW rows, client 404/503 mount tests); B4 (PW11/PW15, mount fetch URLs).
- CI: B4 bundle scan (A22 RS1); B8 gate scope step (allowed-files); PC16 dependency diff; CK-P1 pin/count (needs the gate infra PR's script committed).
