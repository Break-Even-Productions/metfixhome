# Pre-Build Code Quality & Architecture Notes: PR #18 Expansion — Post Detail Template & Taxonomy Pages

- **Seat:** MetFix Web Code Quality (read-only)
- **Target repo / branch / commit:** `Break-Even-Productions/metfixhome`, PR #18 (`cursor/post-layout-library-search-fdcd`), head `1129813` (`1129813d8277e898c0cc34cf83c356054cc97994`)
- **Prior PR #18 artifacts:**
  - `metfix-pr-post-layout-search-cq-prebuild.md` (`94f99437054f342ff62df85bcffbf908`)
  - `metfix-pr18-cq-r1-84d84d5.md` (`fee5ce0a8b78fd24903e22bf6aa5aa34`)
  - `metfix-pr18-cq-r2-1df3cd9f.md` (`36374d6519613462520e34dfdd76a4ba`)
- **Mockup reference:** `https://rlhome.emilydesigns.org/resource/a-body-of-lies-emily-kaplan` (`ResourceDetail.tsx`) and `https://rlhome.emilydesigns.org/topic/metabolic-health` (`Topic.tsx`)

---

## 0. Baseline Audit of `1129813` (Delta from `1df3cd9f`) & Rule 6 Note

1. **Delta `1df3cd9f..1129813`:** Commit `1129813` (`feat(posts): author-right reader layout (Ethan OQ-3 override)`) added `client/src/components/AuthorAside.tsx` (33 lines, pure presentational component using the existing string `author` field + initials avatar), wrapped the reader body and `AuthorAside` in `.post-reader-grid` (`minmax(0, 2fr) minmax(0, 1fr)` at `>=1024px`) in `LibraryDetailPage.tsx` and `PostDetailPage.tsx`, widened the reader container to `1280px` when `AuthorAside` is present (`.library-reader--wide`, `.posts-shell--wide`), and added tests `PL13` / `LB12`.
2. **Process & Scope (Rule 6) + Preserved Invariants:**
   - PR #18 completed Round 2 review at `1df3cd9f`. Under Rule 6, expanding scope after Round 1 requires an explicit Ethan override (relayed here via CEO / Web Lead).
   - **All prior PR #18 invariants remain gating and must not regress:**
     - Token-free Sanity browser bundle (`client/src/lib/sanity.ts:28` `token: undefined`, no `VITE_SANITY*` token in client).
     - Exactly 1 `SITE_SETTINGS_QUERY` call per session via `useSiteSettings`.
     - Submit-only search on `/library` and `/library/search` through `useInfiniteArchive` and the shared module-level `getLibraryFilters()` promise (`client/src/pages/library/filtersCache.ts`).
     - `post-prose.css` imported only by `PostDetailPage.tsx` and `LibraryDetailPage.tsx` (or their shared detail subcomponents), never globally.
     - **Clean up `F4` from Round 2:** `docs/post-layout-search/metfix-pr18-cq-r1-84d84d5.md` is still committed in the repository at `1129813` — remove `docs/post-layout-search/` from the branch and do not commit any `/workspace/specs/` CQ notes into the repo.

---

## CQ-1. Shared Detail Template Subcomponents & Data Contract (`A.1`–`A.6`) — No 2× Copy-Paste

At `1129813`, `LibraryDetailPage.tsx` (`client/src/pages/library/LibraryDetailPage.tsx`, 159 lines) and `PostDetailPage.tsx` (`client/src/pages/posts/PostDetailPage.tsx`, 212 lines) already duplicate the reader shell, header, hero image, body container, and `AuthorAside` grid. Adding dynamic breadcrumbs (`A.5`), topic pills (`A.4`), category + content-type meta row (`A.2`, `A.3`), video/embed stage + locked overlay (`A.1`), and post comments (`A.6`) to both pages separately would duplicate 350+ lines of JSX, state, and effects.

- **CQ-1.1 (Shared detail view / subcomponents):** Extract shared presentational building blocks under `client/src/components/post-detail/` (or `client/src/pages/library/` shared by both detail pages):
  - `ResourceBreadcrumbs`: renders `Home > Resource Library > {Dynamic Source}` (see `CQ-5`).
  - `ResourceMetaRow`: renders formatted date, Content Type icon + link (`/library/content-type/:slug`), Category link (`/library/category/:slug`), and author byline.
  - `ResourceTopicPills`: renders the clickable `r.topics` pills row (`/library/topic/:slug` or `/topic/:slug` — see `CQ-6.2`) above the media stage.
  - `ResourceMediaStage`: renders the 16:9 playable video (`<iframe>` for YouTube/Vimeo, `<video controls>` for self-hosted), the locked preview overlay when `locked && !access.show_video_in_preview`, or the 16:9 featured `image` fallback when there is no video (removing the dead `.library-reader-hero` CSS selector noted in Round 2 `F1` or binding both pages to the shared media stage class).
  - `PostCommentsSection`: shared post comments container mounted below the article body inside `.post-reader-main` (`max-width: 680px`), matching the Emily mockup (`ResourceDetail.tsx:358`).
- **CQ-1.2 (Normalized reader model):** Define a shared TypeScript interface (e.g., `DetailReaderModel` in `@shared/library` or `client/src/components/post-detail/types.ts`) satisfied by both `LibraryDetail` and `DetailPost` (`id`, `title`, `date`, `author`, `image`, `video`, `categories`, `content_types`, `topics`, `locked`, `access`, `content`) so the shared components take one prop shape without page-specific branching.

---

## CQ-2. Unified Video / Embed Mapper, URL Allowlisting & Locked Gating (`A.1`)

At `1129813`:
- `shared/library/types.ts:47` types `LibraryDetail.video` as `string | null`.
- `shared/library/map.ts:402-406` sets:
  ```ts
  const video = !locked && typeof item.video === "string" && item.video
    ? allowlistedHttpsUrl(item.video, { resolveRelative: true })
    : null;
  ```
  This has **three bugs** relative to the new spec:
  1. It drops object-shaped `item.video` (`{ type: 'YouTube' | 'Vimeo' | 'Self Hosted', url, embed_url, video_id }`).
  2. `allowlistedHttpsUrl` (`shared/library/map.ts:74-96`) only permits `url.hostname === "brokenscience.org"`, so YouTube and Vimeo string or object URLs are always rejected (`null`).
  3. `!locked` unconditionally drops `video` when `access.access === "none"` or `"preview"`, ignoring `access.show_video_in_preview`.
- Meanwhile, `shared/posts/types.ts` (`DetailPost`) and `shared/posts/map.ts` (`mapDetailPost`) do not map `video` at all.

### Requirements:
- **CQ-2.1 (Single shared `mapResourceVideo` in `shared/`):**
  - Define a discriminated or structured `ResourceVideo` type in `shared/library/types.ts` (and re-export for `shared/posts/types.ts`):
    ```ts
    export type ResourceVideo = {
      kind: "youtube" | "vimeo" | "self_hosted";
      /** Validated canonical https embed URL for youtube/vimeo, or null for self_hosted. */
      embedUrl: string | null;
      /** Validated canonical https media/watch URL, or null. */
      url: string | null;
      /** Validated provider video ID when applicable. */
      videoId: string | null;
    };
    ```
    (If the acceptance spec pins exact field names such as `{ type, url, embed_url, video_id }`, use those exact keys in one shared type and guard in `shared/` — never two divergent video mappers in `shared/library/map.ts` and `shared/posts/map.ts`.)
  - Handle both upstream formats in the single mapper:
    1. **Object format:** `{ type: 'YouTube' | 'Vimeo' | 'Self Hosted', url?, embed_url?, video_id? }` (case-insensitive or exact union check on `type`).
    2. **Legacy string format:** `typeof raw === "string"` — inspect parsed `new URL(raw)` hostname to classify as YouTube (`youtube.com`, `www.youtube.com`, `youtu.be`, `www.youtube-nocookie.com`), Vimeo (`vimeo.com`, `player.vimeo.com`), or Self Hosted (`brokenscience.org`).
- **CQ-2.2 (Strict URL parsing & host allowlisting — no regex URL parsing):**
  - Parse every URL with `new URL(...)`, require `protocol === "https:"`, empty `username`/`password`, and empty `port` (preserving the `hasExplicitPort` guard in `shared/library/map.ts:69-72`). Reject `javascript:`, `data:`, `vbscript:`, `file:`, `http:`, or unparseable strings (`return null`).
  - **YouTube:** Validate extracted `video_id` (from `video_id`, `/embed/<id>`, `youtu.be/<id>`, or `?v=<id>`) against `/^[A-Za-z0-9_-]{6,32}$/`. Canonicalize `embed_url` to `https://www.youtube.com/embed/${videoId}` (or `https://www.youtube-nocookie.com/embed/${videoId}` if already on nocookie host). Never pass arbitrary query parameters or arbitrary paths from `embed_url` straight into `<iframe src>`.
  - **Vimeo:** Validate extracted `video_id` (from `video_id`, `vimeo.com/<id>`, or `player.vimeo.com/video/<id>`) against `/^[0-9]{1,20}$/`. Canonicalize `embed_url` to `https://player.vimeo.com/video/${videoId}`.
  - **Self Hosted:** Allow only `url.hostname === "brokenscience.org"` (matching `IMAGE_HOST` in `shared/library/constants.ts:8`, with relative path resolution against `https://brokenscience.org` when applicable).
- **CQ-2.3 (Locked & preview video gating — server + client):**
  - **In the mapper (`shared/library/map.ts` and `shared/posts/map.ts`):** When a resource is locked (`locked === true` / `access.access !== "full"`) AND `!access.show_video_in_preview`, the Worker/mapper MUST NOT leak playable `url` / `embed_url` / `video_id` strings to an unentitled client (consistent with the 10-13 locked-post leak fix in `2026-10-19-locked-post-leak-fix.md` §2.2(3) and `2026-10-19-bsi-auth-contracts-C1-C9.md:194`, where `video` is only returned when `access === 'full'` or `show_video_in_preview` is true). If the UI needs to know a locked post *has* a video to show the locked video overlay over `r.image`, either rely on `r.type` / a boolean flag or only populate playable URLs when `!locked || access.show_video_in_preview`.
  - **In the client (`ResourceMediaStage`):** When `r.locked && !r.access.show_video_in_preview`, render ONLY the 16:9 thumbnail (`r.image`) + locked overlay (`"MetFix Professional Access Required"` / lock CTA matching `ResourceDetail.tsx:145-160`). Never mount an `<iframe>` or `<video src>` behind the locked overlay in the DOM.
  - When unlocked (or `r.access.show_video_in_preview === true`) and a valid video is present, render the playable embed/video (`<iframe sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" ...>` for YouTube/Vimeo; `<video controls preload="metadata" poster={r.image ?? undefined} src={...}>` for Self Hosted). When no video is present, fall back to the 16:9 featured `r.image` (and render nothing if `r.image` is also `null`).

---

## CQ-3. Content Security Policy (`worker/csp.ts`) for Video Embeds, Media & Post Comments (`A.1`, `A.6`)

At `1129813`:
- `worker/csp.ts` defines only `DAILY_FIX_CSP`:
  ```ts
  export const DAILY_FIX_CSP = [
    "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
    "connect-src 'self' https://www.google.com/recaptcha/",
    "frame-ancestors 'none'",
  ].join("; ");
  ```
- `withDailyFixCsp` is only applied in `handleDailyFixHtml` (`worker/index.ts:379-430`). Neither `handlePostsHtml` (`worker/posts.ts:535`) nor `handleLibraryHtml` (`worker/library.ts:1016`) attaches a CSP header today, and `DAILY_FIX_CSP`'s `frame-src` only allows Google reCAPTCHA — so if `DAILY_FIX_CSP` were applied to detail pages without updating `frame-src`, it would **block YouTube and Vimeo `<iframe>` embeds**!

### Requirements:
- **CQ-3.1 (`frame-src` and `media-src` in `worker/csp.ts`):**
  - Update `worker/csp.ts` (either by extending the shared CSP or exporting a detail/site CSP helper alongside `DAILY_FIX_CSP` if tests pin `DAILY_FIX_CSP` byte-for-byte — **check `worker/__tests__` for exact-string assertions on `DAILY_FIX_CSP` before mutating `DAILY_FIX_CSP`!**):
    - `frame-src`: must allow `https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`
    - `media-src`: must allow `'self' https://brokenscience.org`
    - `script-src`, `connect-src`, `frame-ancestors 'none'`: keep the reCAPTCHA v3 directives (`'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`) because post detail pages now host comment composers that lazy-load reCAPTCHA (`ensureRecaptchaScript()`).
- **CQ-3.2 (Apply CSP and `window.__MFX_RECAPTCHA_SITE_KEY__` injection on detail HTML responses):**
  - Look at `worker/index.ts:370-377` (`injectRecaptchaSiteKey` on `handleDailyFixHtml`): `ensureRecaptchaScript()` (`client/src/pages/the-daily-fix/recaptcha.ts:10-12`) reads `window.__MFX_RECAPTCHA_SITE_KEY__`, which is injected into HTML by the Worker!
  - Currently, `handlePostsHtml` (`worker/posts.ts:535`) and `handleLibraryHtml` (`worker/library.ts:1016`) do **not** call `injectRecaptchaSiteKey`! If a user lands directly on `/posts/:id` or `/library/:type/:id` and focuses the comment textarea, `window.__MFX_RECAPTCHA_SITE_KEY__` will be `undefined` unless `handlePostsHtml` and `handleLibraryHtml` also inject the site key (or share one HTML shell transform helper with `handleDailyFixHtml`).
  - Ensure `handlePostsHtml` and `handleLibraryHtml` apply the updated CSP header and `injectRecaptchaSiteKey` (with `RECAPTCHA_CSP_CACHE_MARKER` cache-key differentiation if edge-cached HTML is used, matching `worker/index.ts:365-431`).

---

## CQ-4. Taxonomy Data, `DetailPost` Parity & Strict Guard Lockstep (`A.2`, `A.3`, `A.4`, `B.1`)

At `1129813`:
- `shared/library/map.ts:104-116` has `function mapTerms(raw: unknown): TermRef[]` (private to `shared/library/map.ts`), which maps `[{ id, name, slug }]` with `cleanText(t.name)` and `SLUG_RE.test(t.slug)` (`/^[a-zA-Z0-9_-]{1,64}$/`).
- `shared/library/map.ts:329-345` has `export function mapFilterTerms(raw: unknown): LibraryFilterTerm[]`, which currently maps `{ id, name, slug, count? }` and drops `description` and `image`.
- `shared/posts/types.ts` defines `Post` with `category: { name: string; slug: string } | null` and `DetailPost = Post & { content: string; permalink: string | null }`.
- **TRAP in `shared/posts/guards.ts:4-14, 48-62`:** `isDetailPost` uses `exactKeySet(value, DETAIL_POST_KEYS)`!
  - `worker/posts.ts:448` (`readCache`) and `client/src/pages/posts/PostDetailPage.tsx:99` (`fetchDetail`) both call `isPostDetailBody(data)` -> `isDetailPost(body.post)`.
  - If new fields (`video`, `categories`, `content_types`, `topics`, `locked`, `access`) are added to `DetailPost` / `mapDetailPost` without updating `DETAIL_POST_KEYS` and `isDetailPost` in `shared/posts/guards.ts` (and bumping the cache key prefix `https://cache.metfix.internal/v1/posts/` in `shared/posts/cache.ts:4` to `v2`), every `/api/posts/:id` call or cached entry will fail `isPostDetailBody` and render the unavailable state!

### Requirements:
- **CQ-4.1 (Export and reuse `mapTerms` across `shared/library` and `shared/posts`):**
  - Export `mapTerms` (and `TermRef`) from `shared/library/map.ts` and reuse it in `shared/posts/map.ts` (`mapDetailPost`) to map `categories: TermRef[]`, `content_types: TermRef[]`, and `topics: TermRef[]`. Do not write a second term-array parser in `shared/posts/map.ts`.
  - Keep `category: { name: string; slug: string } | null` on `Post` / `DetailPost` (or derive `category` from `categories[0]`) so `PostsPage.tsx` list cards and existing `Post` list tests (`POST_KEYS`) do not break.
- **CQ-4.2 (Update `DETAIL_POST_KEYS` & `isDetailPost` in `shared/posts/guards.ts` + bump `shared/posts/cache.ts`):**
  - Update `DETAIL_POST_KEYS` and `isDetailPost` in `shared/posts/guards.ts` in lockstep with `DetailPost` in `shared/posts/types.ts` and `mapDetailPost` in `shared/posts/map.ts`.
  - Also update `isLibraryDetailBody` in `shared/library/guards.ts` to validate the new `video` union (`r.video === null || typeof r.video === "string" || isResourceVideo(r.video)`) and arrays (`Array.isArray(r.topics)`, `Array.isArray(r.categories)`, `Array.isArray(r.content_types)`), and bump the cache key paths in `shared/library/cache.ts` (`filters`, `item`, `search`) and `shared/posts/cache.ts` so stale pre-deploy cached payloads missing the new fields are never served.
- **CQ-4.3 (Sanitize `description` and `image` in `mapFilterTerms` — `B.1`):**
  - In `shared/library/types.ts`, extend `LibraryFilterTerm`:
    ```ts
    export type LibraryFilterTerm = {
      id: number;
      name: string;
      slug: string;
      count?: number;
      description: string | null;
      image: string | null;
    };
    ```
  - In `shared/library/map.ts:329` (`mapFilterTerms`), map `image` through `pickImage(t.image ?? t.featured_image ?? t.thumbnail)` (which enforces `allowlistedHttpsUrl(..., { resolveRelative: true })` on `brokenscience.org`), defaulting to `null`.
  - For `description`: strip HTML tags and decode entities into clean plain text while **preserving paragraph breaks (`\n\n`)** so multi-paragraph descriptions can be split into `<p>` elements for the `Read More ↓` / `Show Less ↑` toggle on taxonomy pages (`Topic.tsx:159-175`). Specifically: convert `</p>`, `<br>`, `<br/>` or `\r?\n\s*\r?\n` to `\n\n`, strip all remaining `<...>` tags and decode HTML entities per paragraph using `cleanText`, join non-empty paragraphs with `\n\n`, and return `null` when empty. **Never render taxonomy `description` with `dangerouslySetInnerHTML`.**

---

## CQ-5. Dynamic Breadcrumbs, `?from=` Validation & Zero Extra Requests (`A.5`)

Spec requirement `A.5`:
- Format: `Home > Resource Library > {Dynamic Source}` (from Topic, Category, or Content Type page via `?from=topic:metabolic-health` or router state from `ResourceCard`; default to primary Category `r.categories[0]`).

### Requirements:
- **CQ-5.1 (Strict `?from=` parser & validator in `shared/library/`):**
  - Parse `?from=` from the current URL query string (`useSearch()` in wouter) with router-state fallback (`window.history.state?.from`). Prefer putting `?from=<kind>:<slug>` on the `<a href>` generated by `ResourceCard` when rendered inside a taxonomy page so middle-click, open-in-new-tab, copy-link, and page reload all preserve the breadcrumb deterministically.
  - Validate the raw `from` value strictly against:
    ```ts
    const FROM_PARAM_RE = /^(topic|category|content-type):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
    ```
    with `raw.length <= 80`. Any value failing this regex (including `javascript:`, `//`, path traversal, HTML, or unknown prefix) MUST be ignored and fall back to `r.categories[0]` (linking to `/library/category/${r.categories[0].slug}`), or omit the 3rd crumb if `r.categories` is empty.
- **CQ-5.2 (Zero extra network requests for breadcrumb label resolution):**
  - Do **NOT** trigger an unconditional `getLibraryFilters()` (`/api/library/filters`) network request on `PostDetailPage` or `LibraryDetailPage` mount just to look up the display name of `?from=topic:metabolic-health`!
  - Resolve the display name in this exact zero-network order:
    1. **Match against the resource's own term arrays first:**
       - `kind === "topic"` -> `r.topics.find((t) => t.slug === slug)?.name`
       - `kind === "category"` -> `r.categories.find((c) => c.slug === slug)?.name`
       - `kind === "content-type"` -> `r.content_types.find((ct) => ct.slug === slug)?.name` (or `CONTENT_TYPE_CHIPS.find((c) => c.slug === slug)?.label`)
       *(When a user clicks a card on `/topic/metabolic-health`, that post has `metabolic-health` in `r.topics` ~99% of the time — resolved in O(1) with 0 network calls!)*
    2. **Router state / synchronous filter cache peek:** If the user navigated from the taxonomy page in-SPA, pass `fromLabel` in `history.state` or add a synchronous `peekLibraryFilters(): LibraryFiltersBody | null` helper in `client/src/pages/library/filtersCache.ts` (reading the resolved value if `getLibraryFilters` already completed earlier in the session, without starting a fetch).
    3. **Slug humanizer fallback:** If neither (1) nor (2) has the label (e.g. cold page load with a valid `?from=topic:foo-bar` not present on `r.topics`), format the slug (`foo-bar` -> `Foo Bar`, matching Emily's `ResourceDetail.tsx:66` `replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())`) or fall back to `r.categories[0]`.
- **CQ-5.3 (Keep `?from=` out of API URLs, Worker cache keys, and `<link rel="canonical">`):**
  - Client detail fetchers (`fetchLibraryItem(type, id)` and `fetchDetail(id)`) only pass `type` and `id` — never forward `window.location.search` (`?from=...`) to `/api/library/item/:type/:id` or `/api/posts/:id`.
  - In `worker/library.ts` (`handleLibraryHtml`) and `worker/posts.ts` (`handlePostsHtml`), ignore query parameters when matching `/library/:type/:id` and `/posts/:id` HTML routes, and ensure `<link rel="canonical">` and `og:url` (`buildLibraryHead` / `buildPostsHead`) never include `?from=`.

---

## CQ-6. Single Parameterized Taxonomy Page Component, Routing & Request Discipline (`B.1`, `B.2`)

Spec requirement `B.2`:
- Support dedicated pages for Topics, Content Types, and Categories:
  - `/library/topic/:slug` and `/topic/:slug`
  - `/library/content-type/:slug`
  - `/library/category/:slug`
  in `worker/library.ts` `handleLibraryHtml` and `client/src/App.tsx`; forward `category` -> `categories[]` in `buildSearchUpstreamQuery` in `worker/library.ts`.
- Breadcrumbs (`Home > Resource Library > {Term Name}`), 2-column Hero (left `<h1>` + expandable multi-paragraph `description` `Read More ↓` / `Show Less ↑`; right 4:3 rounded hero `image`), content-type filter tab bar on Topic and Category pages, and 3-column `ResourceCard` grid passing `from` context.

### Requirements:
- **CQ-6.1 (ONE `LibraryTaxonomyPage.tsx` component — no 3× copy-paste):**
  - Build a single `client/src/pages/library/LibraryTaxonomyPage.tsx` taking `taxonomyKind: "topic" | "category" | "content-type"` and `slug: string` (or reading the matched route). Do NOT create separate `TopicPage.tsx`, `CategoryPage.tsx`, and `ContentTypePage.tsx` files with duplicated hero, read-more toggle, tab bar, infinite-scroll observer, and grid JSX.
  - On `taxonomyKind === "content-type"`, hide the content-type filter tab bar (as specified: *"content-type filter tab bar on Topic and Category pages"*).
  - Split `term.description` on `\n\n` into paragraphs `paragraphs: string[]`:
    - Render `paragraphs[0]` always.
    - Only render the `Read More ↓` / `Show Less ↑` `<button type="button">` when `paragraphs.length > 1` (matching Emily's `Topic.tsx:163-175`).
  - Hero right column: only render the 4:3 rounded image container when `term.image` is non-null (or render a clean themed placeholder without a broken `<img src="">` when `term.image === null`).
- **CQ-6.2 (Full route & SSR parity across 4 places):**
  Every taxonomy route (`/library/topic/:slug`, `/topic/:slug`, `/library/content-type/:slug`, `/library/category/:slug`) must be wired consistently across all 4 places:
  1. **`wrangler.jsonc` `assets.run_worker_first` (`wrangler.jsonc:11-20`):**
     - **CRITICAL CATCH:** Currently `wrangler.jsonc` lists:
       ```jsonc
       "run_worker_first": [
         "/the-daily-fix",
         "/the-daily-fix/*",
         "/api/*",
         "/sitemap-daily-fix.xml",
         "/posts",
         "/posts/*",
         "/library",
         "/library/*"
       ]
       ```
       Notice `/topic/*` is **NOT** in `run_worker_first`! Without `"/topic/*"` in `wrangler.jsonc` AND routing `/topic/` in `worker/index.ts:170-185` to `handleLibraryHtml`, requests to `/topic/:slug` in Cloudflare Workers production/preview will bypass the Worker entirely and never hit `handleLibraryHtml`!
  2. **`worker/index.ts` (lines 170–185) and `worker/library.ts` (`handleLibraryHtml`, lines 1016–1086):**
     - Route `/topic/:slug` (when `pathname.startsWith("/topic/")`) as well as `/library/*` to `handleLibraryHtml`.
     - In `handleLibraryHtml`, match:
       - `/topic/:slug` and `/library/topic/:slug`
       - `/library/content-type/:slug`
       - `/library/category/:slug`
       Validate `:slug` against `SLUG_RE` (`/^[a-zA-Z0-9_-]{1,64}$/`). If `:slug` fails `SLUG_RE`, return `notFoundPage(env, request)` (status 404, 0 upstream calls).
  3. **`client/src/const.ts` (`KNOWN_ROUTES`, line 18):**
     - Add `"topic"` to `KNOWN_ROUTES` in `client/src/const.ts:18-28` so `getRouterBase()` does not misinterpret `/topic/metabolic-health` as a sub-path deployment base!
  4. **`client/src/App.tsx` (lines 46–60):**
     - Register `<Route path="/topic/:slug">`, `<Route path="/library/topic/:slug">`, `<Route path="/library/content-type/:slug">`, and `<Route path="/library/category/:slug">` BEFORE `<Route path="/library/:type/:id">`!
     - **Route ordering hazard in `App.tsx`:** In wouter `<Switch>`, `/library/:type/:id` matches ANY two-segment path under `/library/*`! If `/library/:type/:id` is placed before `/library/topic/:slug`, `/library/content-type/:slug`, and `/library/category/:slug`, wouter will route `/library/topic/metabolic-health` to `LibraryDetailPage` with `type="topic"` and `id="metabolic-health"`, which fails ` parsePositiveInt("metabolic-health")` and renders 404! Those three `/library/<taxonomy>/:slug` routes MUST appear **above** `<Route path="/library/:type/:id">` in `App.tsx`, and `handleLibraryHtml` in `worker/library.ts` must likewise match `topic`, `content-type`, and `category` **before** the generic `/library/:type/:id` branch (`isResourceType(type)` already excludes `topic`/`category`/`content-type`, so checking taxonomy slugs first returns 200 instead of 404).
- **CQ-6.3 (Upstream query forwarding in `worker/library.ts` `buildSearchUpstreamQuery` & client `useInfiniteArchive`):**
  - Let's check `worker/library.ts:389-446` (`buildSearchUpstreamQuery`) and `client/src/pages/library/api.ts:10-38`:
    - Currently `buildSearchUpstreamQuery` accepts `categories[]` (positive integers) and `topics[]` (positive integers) and `content_type_terms[]` (slugs matching `SLUG_RE`).
    - Web Lead's brief notes: *"forward `category` → `categories[]` in `buildSearchUpstreamQuery` in `worker/library.ts:294`"* (at `1129813`, `buildSearchUpstreamQuery` is at line 389).
    - Check how `category` (and `topic` if passed as singular or slug/id) is sent:
      - In `buildSearchUpstreamQuery(searchParams)` (`worker/library.ts:389-446`), support singular `category` (and `categories[]`) forwarding to upstream `categories[]`. **Check whether `category` can be a numeric term ID or slug** per the acceptance spec: if client resolves `slug -> term.id` via `getLibraryFilters()` (just like `LibraryPage.tsx:216-226` resolves `metfixCatIds` / `bsiCatIds` from `f.categories` and `SearchPage.tsx:68` resolves `topicId` from `f.topics`) OR passes `category` / `categories[]`, ensure `buildSearchUpstreamQuery` and `api.ts` agree on the exact query param name and format, and that `out.toString()` includes it deterministically in `librarySearchCacheKey(built.queryString, salt)` (`worker/library.ts:535`).
- **CQ-6.4 (Request frequency on Taxonomy Pages — strictly <= 2 requests on mount):**
  - On mount of `LibraryTaxonomyPage`:
    1. Call `getLibraryFilters(signal)` (shared module-level single-flight promise — 0 network calls if already loaded, 1 `/api/library/filters` call on cold load).
    2. Once filters resolve and match `:slug` to the term in `f.topics`, `f.categories`, or `f.content_type_terms`:
       - For `topic` and `category` pages (which filter upstream by numeric `topics[]: [term.id]` or `categories[]: [term.id]`): wait until `filtersReady` (just like `LibraryPage.tsx:311` `browseMode && filtersReady`) before activating `useInfiniteArchive(active, archiveKind, resetKey)`!
       - **Why this matters:** If `useInfiniteArchive` fires on frame 1 with `topics: undefined` while `getLibraryFilters` is still in flight, and then fires a second time 50ms later when `term.id` resolves, every taxonomy page mount will wastefully fire an unfiltered `/api/library/search?limit=24&offset=0` call followed by the filtered call! Passing `active = filtersReady && term != null` guarantees **exactly 1 `/api/library/search` request** on mount (and **0 search requests** if `:slug` does not exist in `filters`, rendering the NotFound / empty state immediately!).
    3. Switching the content-type tab on a Topic or Category page updates `content_type_terms: [selectedTab]` (or `content_types`) in `useInfiniteArchive`, aborting any prior in-flight search via `useInfiniteArchive`'s `AbortController` and firing 1 search request per tab click.

---

## CQ-7. Post Comments Worker Proxy & Client Reuse (`A.6`)

Spec requirement `A.6`:
- Proxy `/api/posts/:id/comments` (and comment edit/delete/like matching BSI `app-apis.php:165-205, 1367-1404`) in the Worker with session bearer auth, CSRF, rate-limit/reCAPTCHA matching Daily Fix comments, and render the comment thread below the article on post detail pages.

Let's examine how Daily Fix comments are implemented at `1129813` in `worker/comments.ts` (715 lines), `worker/upstream.ts` (lines 580–650, 946–1046), `worker/auth/comment-rate-limit.ts`, and `client/src/pages/the-daily-fix/CommentThread.tsx` (700 lines) + `comments.ts` (224 lines):

### Key architectural facts in `1129813` to build around:
1. **PR #3 test `PW2` conflict warning (`worker/posts.test.ts` / spec `metfix-pr3-posts-tests`):**
   - Look at `metfix-pr3-posts-acceptance.rev1.1.md:74` and `metfix-pr3-posts-tests.r1.9.md:34` (`PW2`):
     > `PW2 Bad paths and bad ids (A3, CQ2): /api/posts/1/comments, /api/posts/abc ... -> the catch-all 404 byte for byte`
   - In PR #3 (and in `worker/posts.ts:467-492` at `1129813`), `/api/posts/1/comments` was explicitly listed as an example of an unknown sub-path under `/api/posts/*` that returned the catch-all 404!
   - Now `A.6` adds real `/api/posts/:id/comments` handling! Any existing test in `worker/` that asserts `GET /api/posts/1/comments` returns the catch-all 404 must be updated in lockstep with the spec (e.g. testing `/api/posts/1/unknown` for the catch-all 404 instead of `/api/posts/1/comments`).
2. **Post ID availability on `PostDetailPage` vs `LibraryDetailPage`:**
   - On `PostDetailPage` (`/posts/:id`), `:id` is the numeric WP post ID (`post.id: number`).
   - On `LibraryDetailPage` (`/library/:type/:id`), `resource.id: number` is also the numeric WP ID (`shared/library/types.ts:27`).
   - **Check which `ResourceType` values support post comments:** BSI's `/wp-json/bsi/v1/posts/{id}/comments` (`app-apis.php:165-205`) operates on WP post IDs. Confirm in the spec whether comments render on all detail pages where `r.id` is a post or only when `r.type === "post"` (or all library detail resources backed by WP posts), and ensure locked resources (`r.locked === true`) either gate or hide the comment composer per the spec (note Emily's mockup `ResourceDetail.tsx:358-370` shows a gated discussion card when locked).
3. **Reuse Worker auth / CSRF / rate-limit / reCAPTCHA / single-flight refresh plumbing (`worker/comments.ts` & `worker/upstream.ts`):**
   - **Do NOT copy-paste `worker/comments.ts` (715 lines) into `worker/posts.ts`!**
   - In `worker/comments.ts`, the security & reliability pipeline for writes (`POST`, `PATCH`, `DELETE`, `POST .../like`) is already battle-tested (PR #2):
     1. Host gate: `isAuthHost(request, env)` -> `403 { error: "forbidden" }` (`comments.ts:363`).
     2. Session gate: `readSessionContext(request, env)` -> `401 { error: "unauthorized" }` (`comments.ts:451`).
     3. Origin + CSRF gate: `checkOrigin(request)` + constant-time `X-CSRF-Token` verification against `csrfForSid(env.CSRF_SECRET, ctx.sid)` (`comments.ts:369-374`).
     4. Rate-limit gate (`worker/auth/comment-rate-limit.ts`):
        - Reuses the **existing** bound Cloudflare Rate Limiters in `wrangler.jsonc:65-86`:
          - `COMMENT_WRITE_LIMITER` (`namespace_id: "27104"`, 5/60s per `userId:ip` via `checkCommentWriteLimit`) for POST, PATCH, DELETE.
          - `COMMENT_LIKE_LIMITER` (`namespace_id: "27105"`, 30/60s via `checkCommentLikeLimit`) + `COMMENT_LIKE_TOGGLE_LIMITER` (`namespace_id: "27106"`, 4/60s per `userId:commentId` via `checkCommentLikeToggleLimit`) for like toggles.
        - **Do NOT invent unbound limiter names in `Env`!** Reusing `checkCommentWriteLimit`, `checkCommentLikeLimit`, and `checkCommentLikeToggleLimit` uses the already-deployed `27104`–`27106` bindings.
     5. Content validation (`validateContent`: trimmed `1..2000` code points, `comments.ts:386-393`) and reCAPTCHA v3 verification on POST (`verifyCommentRecaptcha`, `comments.ts:403-444`).
     6. Single-flight OAuth token refresh & retry on upstream `401`: `runUserBsiCall(env, ctx, (accessToken) => ...)` (`worker/auth/acting.ts:103-117`).
     7. No-store headers (`COMMENTS_NO_STORE`: `Cache-Control: no-store`, `Vary: Cookie`) and `sanitizeCommentResponse` / `sanitizeThreadList` (`stripCommentPii` + `sanitizePublicName`, `comments.ts:137-205`).
   - **Actionable structure:** Extract the shared write-gate pipeline (`requireCommentWriteSessionAndCsrf`, rate-limit + reCAPTCHA + `runUserBsiCall` + PII scrubber) in `worker/comments.ts` (or `worker/postComments.ts` importing shared helpers from `worker/comments.ts`) so Daily Fix comments and Post comments share 100% of the auth, CSRF, rate-limit, reCAPTCHA, `Retry-After` (`parseRetryAfter`), and PII-sanitization logic.
4. **Upstream BSI headers & Bearer-only alignment (`worker/upstream.ts`):**
   - Keep `worker/upstream.ts` aligned with the Bearer-only contract (`metfix-pr-bearer-no-key-followup-acceptance.rev1.0.4.md` §1 / `BK3`):
     - User-acting comment calls (`POST`, `PATCH`, `DELETE`, `like`, and signed-in `GET` if personalized) must use the shared user header builder (`Authorization: Bearer <token>`, `Accept: application/json`, `User-Agent: UPSTREAM_USER_AGENT`, plus `Content-Type: application/json` when there is a body) and must NOT introduce new inline header literals combining `X-API-Key` and `Authorization` or carrying `Referer`/`Origin` (`BK12`).
     - Anonymous `GET /api/posts/:id/comments` uses the key-only `bsiGetHeaders(apiKey)` (check whether BSI `/wp-json/bsi/v1/posts/{id}/comments` uses `env.BSI_POSTS_API_KEY` or `env.DAILY_FIX_API_KEY` — note `2026-10-19-posts-api-contract.md` §10.F scoped `BSI_POSTS_API_KEY` to `/bsi/v1/posts` and `/bsi/v1/posts/{id}` only! Verify which key env var is authorized for `/bsi/v1/posts/{id}/comments` and `app-apis.php:1367-1404` so scoped keys do not get `403 key_route_forbidden`!).
5. **No automatic POST retry on write failure (`CT-P1` / `Q-BSI-8`):**
   - As documented in `2026-10-19-bsi-auth-contracts-C1-C9.md:243`, BSI's `bsi_api_add_post_comment` uses `wp_insert_comment()`, which has **no duplicate check and no idempotency key**.
   - Therefore, just like Daily Fix comments (`CT-P1`), neither the Worker (except for a single 401 token refresh when the first call returned 401 before inserting) nor the client may automatically retry a failed or timed-out `POST /api/posts/:id/comments`. On ambiguous failure, the client performs at most one cache-bypassing `GET` refetch and preserves the user's draft text in the textarea.
6. **Client Comment Component & Cache Reuse (`client/src/pages/the-daily-fix/CommentThread.tsx` & `comments.ts`):**
   - **Do NOT copy-paste the 700-line `CommentThread.tsx` into a second 600-line `PostCommentThread.tsx`!**
   - Look at `CommentThread.tsx`: the only Daily-Fix-specific parts are:
     1. The `pillar` (`belly | body | brain`) selector dropdown (`CommentThread.tsx:616-637`) and `pillarLabel(comment.pillar)` badge (`:482`). Post comments belong to a single `postId: number` and do not have a Belly/Body/Brain pillar dropdown!
     2. The endpoint URLs (`/api/daily-fix/comments` with `dateIso` vs `/api/posts/${postId}/comments`) and `getMetfixLoginUrl(currentPath)` return path (`:425, :597` — on post detail pages, `getMetfixLoginUrl(window.location.pathname)` should return to the post, not hardcoded `"/the-daily-fix"`!).
   - Refactor `CommentThread.tsx` (or extract a shared core `<CommentsThread>` / hook) parameterized by target:
     - `target: { kind: "daily-fix"; dateIso: string; pillar: Pillar } | { kind: "post"; postId: number; returnPath: string }`
     - When `target.kind === "post"`, hide the pillar `<DropdownMenu>`, key comments by `comment.id`, send `{ content, parent_comment_id? }` to `/api/posts/${postId}/comments`, and pass `target.returnPath` to `getMetfixLoginUrl(...)`.
   - **Client request frequency for post comments & `/api/auth/me`:**
     - Reuse `loadMe()` from `client/src/lib/session.ts` for `viewerDisplayName` and `moderator` (shared module-level single-flight `/api/auth/me` — 0 extra `/api/auth/me` calls when navigating between pages).
     - Cache and single-flight `GET /api/posts/:id/comments` per `postId` in a `Map<number, CacheEntry>` (matching `commentsCache` in `client/src/pages/the-daily-fix/comments.ts:45`).
     - Fetch comments **at most once per `postId` on detail page mount**. Changing `?from=` breadcrumbs, toggling video state, or re-rendering must never re-fetch `/api/posts/:id/comments`.
     - Abort in-flight comment state updates on unmount via `AbortController`.

---

## CQ-8. What a Lint Rule, Type, Test, or CI Check Could Catch

Per MetFix Web Code Quality standing rules, every review ends with the mechanical checks that can enforce these findings automatically:

1. **TypeScript (`npm run check:worker` / `tsc --noEmit`):**
   - Exporting a single `ResourceVideo` type and `DetailReaderModel` interface from `@shared/library` ensures `LibraryDetailPage`, `PostDetailPage`, `shared/library/map.ts`, and `shared/posts/map.ts` cannot drift in field names or nullability.
   - Making `LibraryTaxonomyPage` take `taxonomyKind: "topic" | "category" | "content-type"` catches any typo in route wiring at compile time.
2. **Runtime & Guard Parity Tests (`npm test` / `npm run test:workers`):**
   - **Guard lockstep test:** A unit test that runs `mapDetailPost(fixture)` through `isDetailPost(...)` (`shared/posts/guards.ts`) and `mapDetailFromPostLike(fixture)` through `isLibraryDetailBody(...)` (`shared/library/guards.ts`) with `video` (YouTube object, Vimeo object, Self Hosted object, legacy string, and `null`), `topics`, `categories`, and `content_types` populated. This immediately catches forgetting to update `DETAIL_POST_KEYS` in `shared/posts/guards.ts`.
   - **Video URL sanitizer & locked-gate table test:** Parameterized test feeding `javascript:alert(1)`, `data:text/html,...`, `http://brokenscience.org/a.mp4`, `https://evil.example/embed/123`, `https://www.youtube.com/embed/../../evil`, and locked items (`locked: true, access: { show_video_in_preview: false }`) into the shared video mapper and asserting `null` (and 0 `<iframe>`/`<video>` elements in the rendered DOM).
   - **CSP directive test:** Assert that HTML responses from `handlePostsHtml` (`/posts/42`) and `handleLibraryHtml` (`/library/post/42`) include `Content-Security-Policy` containing `frame-src` with `https://www.youtube.com`, `https://www.youtube-nocookie.com`, `https://player.vimeo.com`, and `https://www.google.com/recaptcha/`, `media-src 'self' https://brokenscience.org`, and inject `window.__MFX_RECAPTCHA_SITE_KEY__` when `env.RECAPTCHA_SITE_KEY` is set.
   - **Route order & SSR parity test:** Test both Worker HTML (`handleLibraryHtml`) and client `<App />` routing for `/topic/metabolic-health`, `/library/topic/metabolic-health`, `/library/category/bsi`, and `/library/content-type/video` to prove none of them fall into `/library/:type/:id` (`LibraryDetailPage` 404) or miscompute `getRouterBase()` on `/topic/:slug`.
   - **Request-count assertions:**
     - Detail page mount with `?from=topic:metabolic-health`: assert **0 calls** to `/api/library/filters`, **1 call** to detail API, **1 call** to `/api/posts/:id/comments`, and **<= 1 call** to `/api/auth/me` across the session.
     - Taxonomy page mount: assert **<= 1 call** to `/api/library/filters` across the session and **exactly 1 call** to `/api/library/search` on initial mount (catching the double-fetch hazard before `filtersReady`).
3. **Static Repo-Scan / Lint Tests in Vitest:**
   - **No `dangerouslySetInnerHTML` on taxonomy pages:** Scan `LibraryTaxonomyPage.tsx` (and taxonomy components) to forbid `dangerouslySetInnerHTML`.
   - **Single taxonomy page & shared comment thread check:** Assert `client/src/pages/` does not contain separate copy-pasted `TopicPage.tsx` / `CategoryPage.tsx` / `ContentTypePage.tsx` files, and that `post-prose.css` is imported only in the detail template / detail pages (`PL12`).
   - **No `docs/` review notes committed:** Fail CI if any `*cq*` file or `docs/post-layout-search/` review artifact is tracked in git.
   - **`wrangler.jsonc` route guard:** Parse `wrangler.jsonc` in a unit test and assert `assets.run_worker_first` includes `"/topic/*"` alongside `"/library/*"` and `"/posts/*"`.
