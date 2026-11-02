# Acceptance Spec — Post Layout, Resource Detail, Dedicated Taxonomy Pages & Library Search (rev 1.1.0)
- **Repo:** Break-Even-Productions/metfixhome (PR #18, branch `cursor/post-layout-library-search-fdcd`, inspected at `1129813`; `main` inspected at `5465f0d8`). Companion BSI PR: `Curie-and-Co/bsi` PR #30 (`cursor/resource-library-taxonomy-f1ad`). Nothing merges without Ethan's go.
- **Brief (Web Lead, 2026-10-22; expanded 2026-10-26 via CEO + Web Lead, relayed):** (1) Post/resource reader layout, typography, 16:9 video/thumbnail load-in, meta row (Date, Content Type icon+label link, Category link), Topic pills row, dynamic breadcrumbs (`Home > Resource Library > {Dynamic Source}`, default primary Category), author-right sidebar, and post comments section + Worker proxy matching `https://rlhome.emilydesigns.org/resource/a-body-of-lies-emily-kaplan`. (2) Dedicated taxonomy pages for Topics, Content Types, and Categories matching `https://rlhome.emilydesigns.org/topic/metabolic-health` (`/api/library/filters` `description` + `image` pass-through, routes, `category` → `categories[]` upstream forwarding, 2-column hero with expandable multi-paragraph description and 4:3 image, content-type filter tab bar, and 3-column `ResourceCard` grid passing `from` breadcrumb context). (3) Search page matching `https://rlhome.emilydesigns.org/search`, with the topic tabs backed by Sanity (`siteSettings`).
- **Rulings folded in (1.0.1):** **E1** `/library/search`, with `/library` handoff in scope (**relayed**, Web Lead); **E2** BSI `meta.total` via `/api/library/search`, with `?query=` → `search` (**relayed**, Web Lead); **E3** single `searchTopics[]` string array on `siteSettings`, matched by slug/title against `/api/library/filters` (**relayed**, Web Lead); **E4** logged-out search shows locked items with a lock indicator, not hidden (**relayed**, Web Lead — **security-rule exception, needs Ethan's direct OK before merge**).
- **1.0.2:** folds in Web Lead's review (R1–R12, all **relayed**).
- **1.0.5:** folds in CQ's pre-build note (`metfix-pr-post-layout-search-cq-prebuild-1.0.4.md`, md5 `fd98439d61e260fe57a0996401d28a67`, items C1–C5) and Web Lead's rulings R13–R18 (all **relayed**).
- **1.0.6:** folds in Web Lead's scope rulings D1–D6 (all **relayed**) after Ethan's round-1 review. All QA test-list md5 pins are removed (lists are named by revision only; CQ note pin and reference-asset hashes are kept).
- **1.0.6+PL13 (branch `1129813`, 2026-10-23):** Ethan OQ-3 override — author-right sidebar (`PL13`) folded into `/posts/:id` and `/library/:type/:id`.
- **1.1.0 (2026-10-26):** folds in Ethan's PR #18 review additions (relayed via CEO and Web Lead, recorded as §0e E5–E12, all **relayed** until Ethan confirms directly) and CQ pre-build architecture notes (`metfix-pr18-post-taxonomy-cq-prebuild.md`, md5 `866f1df1441f99a9268857601de95d30`, `CQ-1`–`CQ-8`): detail video/thumbnail load-in (`PL6` re-enabled and expanded, superseding D3), category & content-type taxonomy links in `.post-detail-meta` (`PL5` updated, `PL14`, `PL15`), clickable Topic pills row above thumbnail/video (`PL16`), dynamic breadcrumbs with `?from=` context and primary-category default (`PL9` updated), post comments thread + Worker `/api/posts/:id/comments` proxy (`PL10` updated, `PL17`, `PL18`), dedicated taxonomy pages for Topics, Content Types, and Categories (`TX1`–`TX8`), threat/security criteria (`SEC8`–`SEC13`), tests (`TC5` updated, `TC9`–`TC14`), and post-deploy checks (`PD5` updated, `PD6`–`PD8`). **88 gating acceptance IDs** across `PL` (18), `TX` (8), `SR` (19), `SN` (7), `SEC` (13), `TC` (15: `TC1`, `TC1b`, `TC2`–`TC14`), and `PD` (8) (see §0f for exact breakdown).

## 0. Reference check (fetched 2026-10-22; bundle re-verified 2026-10-26)
- Both URLs serve the same Vite SPA shell (`index.html` md5 `19d203893b473aaefbd37fbbe09f6dc9`): `/assets/index-Cw2EZO4J.js` (719,844 B, md5 `e61ef4bf3da9bb4c31d81ec2f179c9d0`) and `/assets/index-BRGGIAaC.css` (131,878 B, md5 `57ac35d736e6188abdf4fa22a2a75cd9`). Google Fonts: `Playfair Display:ital,wght@0,700;0,800;1,700` and `DM Sans:opsz,wght@9..40,300;400;500;600;700`.
- **Post reference (`client/src/pages/ResourceDetail.tsx` in the bundle):**
  - Outer `.container.py-10` → 3-col grid at `lg` (`grid-cols-1 lg:grid-cols-3 gap-10`); the main column is `lg:col-span-2` (~797px at 1280 container), and the right column (`lg:col-span-1`, ~379px) holds the sticky "About the Author" card (`top-20`).
  - Breadcrumb (`ResourceDetail.tsx:52-69`): `Home / Resource Library / {Dynamic Source}` (`flex items-center gap-2 mb-6 text-xs flex-wrap`, DM Sans 12px).
  - Title `h1` (`ResourceDetail.tsx:76`): `Playfair Display, serif`, `clamp(22px, 3vw, 36px)`, weight `700`, `leading-tight` (1.25), `mb-4` (16px).
  - Meta row (`ResourceDetail.tsx:84-113`): `flex flex-wrap items-center gap-3 mb-6`, DM Sans `12px` (`text-xs`), `·` separators: calendar icon + date, content-type icon + uppercase tracking-wide label, and category/source.
  - Topic pills row (`ResourceDetail.tsx:115-133`): `flex flex-wrap gap-2 mb-8`, clickable pills (`flex items-center gap-1 text-xs px-2.5 py-1 rounded`, tag icon `size={10}` + topic name) rendered above the video/thumbnail load-in.
  - Video / featured thumbnail load-in (`ResourceDetail.tsx:138-199`): `max-width: 680px`, `aspect-ratio: 16/9`, `rounded overflow-hidden mb-8` (32px). Video/live-stream shows playable video/embed when unlocked (`!r.locked || r.access.show_video_in_preview`) or a locked preview overlay (`MetFix Professional Access Required` + lock icon) over the 16:9 thumbnail when `r.locked && !r.access.show_video_in_preview`; non-video resources render the 16:9 featured `image` thumbnail (with locked blur/overlay on locked infographic/resource previews).
  - Body wrapper (`ResourceDetail.tsx:201-215`): `max-width: 680px` (`max-w-[680px]`). Body `<p>`: `DM Sans, sans-serif`, `16px` (`text-base`), weight `400`, `leading-relaxed` (`1.625` = **26px**), `mb-4` (**16px**), lead `<p>` to body `mt-6` (24px).
  - Discussion / comments section (`ResourceDetail.tsx:358-372`): `mt-10 pt-10`, `max-width: 680px`, `border-top`, `Discussion` section label + comment thread below the article body.
- **Taxonomy reference (`client/src/pages/Topic.tsx` in the bundle, `https://rlhome.emilydesigns.org/topic/metabolic-health`):**
  - Hero section (`Topic.tsx:135-195`): `.py-10` with bottom border, `.container`:
    - Breadcrumb (`Topic.tsx:137`): `Home > Resource Library > {Term Name}` (`section-label mb-4`).
    - 2-column Hero grid (`Topic.tsx:141`): `grid grid-cols-1 lg:grid-cols-2 gap-8 items-start`.
    - Left column (`Topic.tsx:143-179`): `<h1>` Title (`Playfair Display, serif`, `clamp(28px, 3.5vw, 44px)`, weight `700`, `mb-2 leading-tight`), expandable `description` (`text-sm leading-relaxed space-y-3 mb-3`, DM Sans 14px, showing paragraph 1 by default and remaining paragraphs when expanded, with a `Read More ↓` / `Show Less ↑` toggle button when multi-paragraph).
    - Right column (`Topic.tsx:181-191`): 4:3 rounded hero `image` (`aspect-ratio: 4/3`, `rounded overflow-hidden`, `w-full h-full object-cover`) when `term.image` is present.
  - Content-type filter tab bar (`Topic.tsx:196-228`): horizontal scrollable tab strip (`flex items-center overflow-x-auto`, buttons `px-4 py-3.5 text-xs font-600 tracking-[0.04em] border-b-2`) with `All` plus content-type tabs (`Videos`, `Articles`, `Live Streams`, `Infographics`, etc.) that filter the term's resources on Topic and Category pages.
  - Resource grid (`Topic.tsx:230-262`): `.py-10 .container`, 3-column `ResourceCard` grid (`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5`), with an empty state (`No {type} resources yet` + `View all {term.name} content →` reset button when filtered).
- **Search reference (`client/src/pages/Search.tsx` in the bundle):**
  - Hero (`Search.tsx:86-210`): breadcrumb `Home / Resource Library / Search` (`section-label`, 11px uppercase, tracking `0.12em`, gold `oklch(75% 0.08 70)`); `h1` "Search All Resources" Playfair `clamp(24px, 3vw, 38px)` weight 700; form `max-w-2xl` (672px) with `Search` icon (16px), input (`placeholder="What are you looking for?"`, clear `×` button when non-empty) and gold `Search` submit button (`px-6 py-3`, 12px uppercase weight 700, tracking `0.08em`); type pills row (`All Types`, `Videos`, `Articles`, `Live Streams`, `Infographics`).
  - Topic tab bar (`Search.tsx:212-246`): full-width bar, horizontal scroll (`overflow-x-auto`, `scrollbar-width: none`), `border-b-2` active indicator in gold, `px-4 py-3.5`, 12px weight 600. Static list in the mockup (`Search.tsx:28-38`): `All`, `Metabolic Health`, `Special Populations`, `Women's Health`, `Professional Library`, `Whiteboards`, `Infographics`, `Coaches`, `BSI Education`.
  - Results area (`Search.tsx:249-325`): count line + `× Clear filters` link; 3-col grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5`) of `ResourceCard`; empty state "No results found" + "Try a different search term or browse by category above." + "Clear all filters".

## 0b. Findings from `main` (verified 2026-10-22; branch `1129813` verified 2026-10-26)
1. **`/api/library/search` drops `total`, `offset` and `has_more`.** BSI returns `meta: { count, total, per_page, offset, has_more }` (`bsi/app-apis.php:1371`), and `useInfiniteArchive.ts` already exists (`client/src/pages/library/useInfiniteArchive.ts`), with `hasMore = items.length < total`. Extending `LibrarySearchMeta` in `shared/library/types.ts`, `shared/library/map.ts`, and `shared/library/guards.ts` keeps the count line and pagination accurate (R2, R4).
2. **`/api/library/search` uses `?query=`, not `?search=`.** `worker/library.ts` reads `searchParams.get("query")` (`QUERY_MAX = 120`) and forwards it to BSI as `search`. E2's `?search=` is the BSI parameter name; the Worker parameter is `query` (SR8).
3. **`buildSearchUpstreamQuery` (`worker/library.ts:389-446`)** loops over `topics` and `categories` reading `searchParams.getAll("${name}[]")` and `searchParams.getAll(name)` (positive integers via ` parsePositiveInt`). To support singular `?category=` as requested in E10 (`worker/library.ts`), `buildSearchUpstreamQuery` also reads `searchParams.getAll("category")` alongside `categories[]` and `categories`, forwarding valid positive integer IDs as upstream `categories[]`.
4. **Card click on locked items.** `ResourceCard.tsx` opens `JoinModal` via `onOpenLocked` when `r.locked` is true, and navigates to `resourceHref(r)` (`/posts/:id` or `/library/:type/:id`) when unlocked. Under E4 + E9, `ResourceCard` accepts an optional `from?: string` context prop (e.g. `"topic:metabolic-health"`, `"category:metfix"`, `"content-type:videos"`) and appends `?from=<context>` to `resourceHref(r)` so detail pages render the dynamic 3rd breadcrumb (`PL9`, `TX7`).
5. **`siteSettings` in Sanity (`client/src/lib/contentTypes.ts`, `content.ts`).** Has `SITE_SETTINGS_QUERY`, `normalizeSiteSettings`, `DEFAULT_SITE_SETTINGS` and `useSiteSettings()`. Adding `searchTopics?: string[]` there is small and isolated.
6. **Current post styling on `1129813` (`client/src/styles/post-prose.css`, `PostDetailPage.tsx`, `LibraryDetailPage.tsx`).** `post-prose.css` already implements `PL1`–`PL3`, `PL7`, `PL11`–`PL13` (`.post-reader-grid`, `.post-author-card`, `.posts-detail-content`, `.library-reader-body` at `max-width: 680px`, `DM Sans` 16px/26px). However:
   - `LibraryDetailPage.tsx` does not render `r.image` or `r.video` at all (`PL6` was retired in 1.0.6 under D3 and is now re-enabled and expanded under E5).
   - `shared/library/map.ts:392-395` checks `typeof item.video === "string"` through `allowlistedHttpsUrl` (which only allows `IMAGE_HOST = "brokenscience.org"`), dropping BSI's `{ type: 'YouTube' | 'Vimeo' | 'Self Hosted', url, embed_url, video_id }` object from `bsi_get_post_video_url` (`bsi/app-apis.php:3152-3205`) and rejecting YouTube/Vimeo embeds. `shared/posts/map.ts` (`mapDetailPost`) also drops `video`, `content_types`, and `topics`.
   - `LibraryDetailPage.tsx` fetches `r.categories` and `r.topics` in `LibraryDetail`, but ignores `r.categories` in `.post-detail-meta`, does not link `r.content_types` or `r.categories` to taxonomy pages, and renders `r.topics` at the bottom as unlinked `<span className="library-chip">` instead of clickable Topic pills above the thumbnail/video.
   - Neither `LibraryDetailPage.tsx` nor `PostDetailPage.tsx` renders the post comments section below the article.
7. **BSI Post Comments (`bsi/app-apis.php:165-309, 2363-2637`).**
   - `GET /wp-json/bsi/v1/posts/(?P<id>\d+)/comments` (`app-apis.php:165-182`, callback `bsi_api_get_post_comments` `:2363-2439`) uses `permission_callback => 'bsi_require_api_key_or_bearer_oauth'`. It returns `{ comments: [{ id, user: { id, display_name, avatar_url }, content, date, parent_id, replies }], meta: { post_id, count } }` (and returns empty `comments: []`, `count: 0` when `bsi_check_content_access($post_id, $user_id) !== 'full'`, LM48).
   - `POST /wp-json/bsi/v1/posts/(?P<id>\d+)/comments` (`:188-221`, `bsi_api_add_post_comment` `:2444-2520`, body `{ content, parent_comment_id? }`), `PATCH /wp-json/bsi/v1/posts/(?P<id>\d+)/comments/(?P<commentId>\d+)` (`:227-263`, `bsi_api_edit_post_comment` `:2525-2588`, body `{ content }`), and `DELETE /wp-json/bsi/v1/posts/(?P<id>\d+)/comments/(?P<commentId>\d+)` (`:269-292`, `bsi_api_delete_post_comment` `:2593-2637`) exist on BSI. (Note: BSI has no `/like` route on `/bsi/v1/posts/{id}/comments`, and `PUT` is not registered on `:227` — only `PATCH` and `DELETE`; see §0e E10 and §3 OQ-14.)

## 0c. CQ pre-build note (`fd98439d61e260fe57a0996401d28a67`) and 1.0.5 rulings (all relayed from Web Lead)
- **C1** (`post-prose.css` would pull PL8 rules onto `/library/:type/:id`, which has no H2/H3/blockquote/list CSS today): **R17 — option (a).** `post-prose.css` holds only the shared rules (`max-width: 680px`, `DM Sans` 16px/26px body, `p` 16px bottom margin, first-child top margin 0, `img` `max-width: 100%; height: auto`, `overflow-wrap: anywhere`, 16:9 media frame, and `.post-reader-grid` / `.post-author-*`). The PL8 element rules (`.posts-detail-content h2`, `blockquote`) stay in `client/src/pages/posts/posts.css`. `LibraryDetailPage` gets no new H2/H3/blockquote/list rules until OQ-1 is answered.
- **C2** (`LibrarySearchMeta` has 3 consumers — `types.ts`, `map.ts`, `guards.ts` — and 5 inline test fixtures): **R18 — extend in place.** Add `total: number`, `offset: number`, `has_more: boolean` to `LibrarySearchMeta` in `shared/library/types.ts`, `shared/library/map.ts` and `shared/library/guards.ts`, and update the inline test fixtures in `client/src/pages/library/library.test.ts` and `worker/library.test.ts`. No second meta type.
- **C4** (URL-sync loop on `/library/search` — reading `window.location.search` in a mount effect while calling `setLocation` on state change re-fires the effect, and drops Back/Forward): **folded into SR8.** `SearchPage` derives its filter state from wouter's location/search hook (`useSearch`) as the single source of truth; user actions build the query string and call `setLocation` (push) or `replaceState` (clear), with no mount-effect state copy that writes back to the URL. Popstate (Back/Forward) updates the page state and triggers a single fetch for the restored URL.

## 0d. Round-1 scope rulings (2026-10-22, all relayed from Web Lead; D3 superseded in 1.1.0)
- **D1 (relayed).** Post typography on `/posts/:id` and `/library/:type/:id` is **in scope**. The two reader pages are the primary deliverable of this PR alongside the search page.
- **D2 (relayed).** `post-prose.css` is shared **only** by `PostDetailPage` (`/posts/:id`) and `LibraryDetailPage` (`/library/:type/:id`). Nothing else imports it (PL12).
- **D3 (relayed — SUPERSEDED by E5 in 1.1.0).** ~~The detail hero (`LibraryDetailPage.tsx:154-162`) is **out of scope**.~~ **1.1.0 update (E5, relayed via CEO + Web Lead):** Ethan explicitly wants the 16:9 featured image / video load-in on both detail pages matching the Emily mockup (`https://rlhome.emilydesigns.org/resource/a-body-of-lies-emily-kaplan`). `PL6` is re-enabled and expanded.
- **D4 (relayed).** Any font swap on the `/library` list page (`LibraryPage.tsx`, `ResourceCard.tsx`) is **out of scope**. Their fonts stay as on `main`.
- **D5 (relayed).** The search page's own hero (`SR6`: breadcrumb, `h1` "Search All Resources", search form, type pills) **stays in scope**.
- **D6 (relayed).** Locked items show with a lock indicator (`SR13`, E4), the result count comes from BSI `meta.total` (`SR11`, E2), and there is **no** `shared/library/visibility.ts` module (`SEC2`).

## 0e. Round-2 scope additions for PR #18 (2026-10-26, Ethan via CEO & Web Lead, all **relayed**)
- **E5 (relayed — supersedes D3).** **Post thumbnail / video load-in (`PL6`):** Map `video` properly in both `shared/library/map.ts` (`mapDetailFromPostLike`) and `shared/posts/map.ts` (`mapDetailPost`), supporting both BSI's object format (`{ type: 'YouTube' | 'Vimeo' | 'Self Hosted', url, embed_url, video_id }` from `bsi_get_post_video_url`) and string URL format, allowlisting YouTube/Vimeo embed URLs and `brokenscience.org` media (`SEC10`), and updating `worker/csp.ts` (`SEC11`). Render the 16:9 video player / embed / featured `image` thumbnail load-in in `LibraryDetailPage.tsx` and `PostDetailPage.tsx`, with the locked preview overlay when `r.locked && !r.access.show_video_in_preview`, playable video/embed when unlocked (`!r.locked || r.access.show_video_in_preview`), and falling back to the 16:9 featured `image` thumbnail when there is no video.
- **E6 (relayed).** **Category display in meta row (`PL5`, `PL14`):** Render the primary category in `.post-detail-meta` on both `LibraryDetailPage.tsx` (`r.categories[0]`) and `PostDetailPage.tsx` (`post.category` / `post.categories[0]`), linking to its category taxonomy page (`/library/category/:slug`).
- **E7 (relayed).** **Content Type in meta row (`PL5`, `PL15`):** Add `content_types` (`TermRef[]`) to `DetailPost` / `mapDetailPost` (`shared/posts/types.ts`, `shared/posts/map.ts`) and render the Content Type icon + label in `.post-detail-meta` on both `LibraryDetailPage.tsx` and `PostDetailPage.tsx`, linking to its content-type taxonomy page (`/library/content-type/:slug`).
- **E8 (relayed).** **Clickable Topic pills (`PL16`):** Add `topics` (`TermRef[]`) to `DetailPost` / `mapDetailPost` (BSI Lead is adding `topics` to `bsi_format_post_for_api` so `/bsi/v1/posts/{id}` includes it alongside `/resources/search` and `/exclusive-resources/{id}`) and render the clickable Topic pills row (`r.topics` / `post.topics`) above the thumbnail/video on both `LibraryDetailPage.tsx` and `PostDetailPage.tsx`, linking each pill to `/topic/:slug` (or `/library/topic/:slug`).
- **E9 (relayed).** **Dynamic Breadcrumbs (`PL9`):** Format `Home > Resource Library > {Dynamic Source}` on both detail pages. When the user navigated from a Topic, Category, or Content Type page (passed via validated `?from=topic:<slug>`, `?from=category:<slug>`, or `?from=content-type:<slug>` query parameter or router state from `ResourceCard`), the 3rd crumb shows and links that Topic, Category, or Content Type. When arriving directly or from the main library/home/search without a valid `from` taxonomy context, the 3rd crumb defaults to the post's primary **Category** (`r.categories[0]` / `post.category`), linking to `/library/category/:slug` (or omitting the 3rd crumb if the post has no category).
- **E10 (relayed).** **Post comments section & Worker proxy (`PL10`, `PL17`, `PL18`, `SEC8`, `SEC9`):** Wire up and render the comments section below the article on post detail pages (`PostDetailPage.tsx` and post-backed `LibraryDetailPage.tsx` items). Proxy `/api/posts/:id/comments` (`GET`, `POST`) and `/api/posts/:id/comments/:commentId` (`PATCH`, `DELETE`; `PUT` may alias to `PATCH` or return 405, see `PL17`) in the Worker to BSI's `/wp-json/bsi/v1/posts/{id}/comments` and `/wp-json/bsi/v1/posts/{id}/comments/{commentId}` with session Bearer auth via `runUserBsiCall` (Bearer-only on mutations and signed-in reads per DP45/BK3, W5 API key on anonymous `GET`), `isAuthHost` guard, CSRF (`Origin` + `Sec-Fetch-Site` + timing-safe `X-CSRF-Token`), `checkCommentWriteLimit` (5/60 s per `userId:ip`), and reCAPTCHA v3 `verifyRecaptcha` on `POST`, matching Daily Fix comments.
- **E11 (relayed).** **Taxonomy `description` and `image` in `/api/library/filters` (`TX1`):** Update `LibraryFilterTerm` (`shared/library/types.ts`), `mapFilterTerms` (`shared/library/map.ts`), and `isLibraryFiltersBody` (`shared/library/guards.ts`) to include `description: string | null` and `image: string | null` (BSI Lead is adding `description` and `image` to `/resources/topics`, `/resources/content-type-terms`, and `/resources/categories-for-filter`).
- **E12 (relayed).** **Dedicated Taxonomy Pages (`TX2`–`TX8`, `SEC12`, `SEC13`):** Support `/library/topic/:slug` and `/topic/:slug`, `/library/content-type/:slug`, and `/library/category/:slug` in the Worker (`worker/library.ts` `handleLibraryHtml` and `worker/index.ts`), `client/src/const.ts` (`KNOWN_ROUTES`), and `client/src/App.tsx`; forward `category` → `categories[]` in `buildSearchUpstreamQuery` (`worker/library.ts`); and render the taxonomy page layout matching Emily's `Topic.tsx` mockup (breadcrumbs `Home > Resource Library > {Term Name}`, 2-column hero with `<h1>`, expandable multi-paragraph `description` with `Read More ↓` / `Show Less ↑`, and 4:3 rounded hero `image`, content-type filter tab bar on Topic and Category pages, and 3-column `ResourceCard` grid passing `from` context).


## 0f. Gating ID Count & Breakdown (rev 1.1.0)
Total gating acceptance IDs: **88** (up from 59 in rev 1.0.6 / 60 in 1.0.6+PL13):
- **Post / Resource Detail (`PL1`–`PL18` — 18 IDs):**
  - Unchanged from 1.0.6+PL13 (8): `PL1`, `PL2`, `PL3`, `PL7`, `PL8`, `PL11`, `PL12`, `PL13`
  - Updated / re-enabled in 1.1.0 (5): `PL4` (title/meta/topics spacing), `PL5` (meta row with Date, Content Type link, Category link), `PL6` (re-enabled & expanded for 16:9 video/embed/thumbnail load-in + locked overlay, superseding D3), `PL9` (dynamic breadcrumbs with `?from=` and primary Category default), `PL10` (post comments enabled below article body)
  - New in 1.1.0 (5): `PL14` (Category display & link in meta row), `PL15` (Content Type icon+label & link in meta row + `DetailPost.content_types`), `PL16` (clickable Topic pills row above thumbnail/video + `DetailPost.topics`), `PL17` (Worker `/api/posts/:id/comments` and `/:commentId` proxy), `PL18` (post detail comments UI thread & write/edit/delete flow)
- **Dedicated Taxonomy Pages (`TX1`–`TX8` — 8 new IDs):** `TX1`–`TX8`
- **Search Page (`SR1`–`SR19` — 19 IDs):** all 19 unchanged from 1.0.6
- **Sanity Schema & Settings (`SN1`–`SN7` — 7 IDs):** all 7 unchanged from 1.0.6
- **Security & Threat List (`SEC1`–`SEC13` — 13 IDs):** `SEC1`–`SEC7` preserved (`SEC4` updated to include `/api/posts/:id/comments`); `SEC8`–`SEC13` new in 1.1.0 (6 new IDs)
- **Tests (`TC1`, `TC1b`, `TC2`–`TC14` — 15 IDs):** `TC1`, `TC1b`, `TC2`–`TC4`, `TC6`–`TC8` unchanged; `TC5` updated for `PL6`/`PL13`–`PL16`; `TC9`–`TC14` new in 1.1.0 (6 new IDs)
- **Post-Deploy Checks (`PD1`–`PD8` — 8 IDs):** `PD1`–`PD4` unchanged; `PD5` updated; `PD6`–`PD8` new in 1.1.0 (3 new IDs)

---

## 1. Measured reference values (post page `/resource/a-body-of-lies-emily-kaplan` & taxonomy page `/topic/metabolic-health`)
| Element | Measured value (1440px; 390px where it differs) | Source |
|---|---|---|
| Page container | max-width 1280px; padding-x 32px (16px at 390px); padding-top 40px | `.container{max-width:1280px;padding-left:2rem…}`, computed |
| Detail layout | grid, 3 columns at lg (main column `lg:col-span-2` = 797px, sidebar 379px), gap 40px (`gap-10`); 1 column on mobile | computed (`ResourceDetail.tsx`, `.post-reader-grid`) |
| **Body & media measure** | **max-width 680px** on body text, the 16:9 media stage (`video` / `image`), and the discussion section | `style:{maxWidth:"680px"}`, `max-w-[680px]` |
| Body paragraph | "DM Sans", sans-serif; 16px; line-height 26px (1.625, `leading-relaxed`); weight 400; spacing between paragraphs 16px (`mb-4`); the block after the body has mb 32px | computed + JS |
| Breadcrumb (detail) | DM Sans 12px–13px (`text-xs`); colour `oklch(55% 0.006 60)`; gap 8px (`gap-2`); mb 24px (`mb-6`); format `Home > Resource Library > {Dynamic Source}` | `ResourceDetail.tsx:52-69` |
| H1 (detail title) | "Playfair Display", serif; `clamp(22px, 3vw, 36px)` (36px at 1440px); line-height 1.25 (`leading-tight`); weight 700; mb 16px (`mb-4`) | `ResourceDetail.tsx:76` |
| Meta line (date · type · category) | DM Sans 12px–13px (`text-xs`); `flex flex-wrap items-center gap-3 mb-6`; date in gold `oklch(75% 0.08 70)`; content-type icon + uppercase label (`tracking-wide`); category link | `ResourceDetail.tsx:84-113` |
| Topic pills row | DM Sans 12px (`text-xs`); `flex flex-wrap gap-2 mb-8`; each pill `px-2.5 py-1 rounded` (padding 4px 10px), 1px border `oklch(100% 0 0 / 8%)`, tag icon (`size={10}`) + topic name, above media stage | `ResourceDetail.tsx:115-133` |
| Media stage (video / thumbnail) | max-width 680px; `aspect-ratio: 16/9`; `object-cover`; `rounded overflow-hidden`; `mb-8` (32px) | `ResourceDetail.tsx:138-199` |
| Discussion section | `max-width: 680px`; `mt-10 pt-10` (40px top margin/padding); 1px top border; `.section-label` `Discussion` + comment thread | `ResourceDetail.tsx:358-372` |
| Taxonomy hero | 2-col grid at lg (`grid-cols-1 lg:grid-cols-2 gap-8 items-start`); left `h1` Playfair `clamp(28px, 3.5vw, 44px)` weight 700 `mb-2 leading-tight`, description DM Sans 14px `leading-relaxed space-y-3 mb-3`, `Read More ↓` / `Show Less ↑` toggle when >1 paragraph; right 4:3 rounded hero `image` (`aspect-ratio: 4/3`) | `Topic.tsx:135-195` |
| Taxonomy content-type tab bar | Horizontal scrollable strip (`flex items-center overflow-x-auto`), buttons `px-4 py-3.5 text-xs font-600 tracking-[0.04em] border-b-2` with `All` + content-type tabs on Topic and Category pages | `Topic.tsx:196-228` |

---

## 2. Acceptance list

### A. Post & Resource Detail Template (`PL1`–`PL18`)
Applies to both `/posts/:id` (`PostDetailPage.tsx`) and `/library/:type/:id` (`LibraryDetailPage.tsx`), sharing presentational building blocks (`ResourceBreadcrumbs`, `ResourceMetaRow`, `ResourceTopicPills`, `ResourceMediaStage`, `PostCommentsSection`) and a normalized `DetailReaderModel` contract (`CQ-1`).
- **PL1** The body column's max-width is 680px at every viewport ≥ 768px. At narrower viewports it is the container width minus 16px padding on each side.
- **PL2** Body paragraphs use "DM Sans", sans-serif at 16px, line-height 26px (1.625), weight 400.
- **PL3** Paragraphs have 16px between them and none before the first block (keep `> *:first-child{margin-top:0}`).
- **PL4** The post title (H1) uses "Playfair Display", serif at `clamp(22px, 3vw, 36px)` (36px on desktop), line-height 1.25, weight 700, mb 16px.
- **PL5** The meta row (`.post-detail-meta`) uses DM Sans 12px–13px (`flex flex-wrap items-center gap-3 mb-6`) with `·` separators and renders: (1) formatted date, (2) Content Type icon + uppercase label linking to `/library/content-type/:slug` (`PL15`), (3) primary Category linking to `/library/category/:slug` (`PL14`), and (4) author byline when present.
- **PL6** **(Re-enabled & expanded, E5 / `CQ-2`, supersedes D3)** **16:9 Video / Thumbnail Load-in (`ResourceMediaStage`):**
  - Shared mapper `mapResourceVideo` in `shared/library/map.ts` (reused by `mapDetailFromPostLike` and `shared/posts/map.ts` `mapDetailPost`) supports both BSI's object format (`{ type: 'YouTube' | 'Vimeo' | 'Self Hosted', url?, embed_url?, video_id? }`) and legacy string URLs, returning a structured `ResourceVideo | null` (`{ kind: "youtube" | "vimeo" | "self_hosted", embedUrl: string | null, url: string | null, videoId: string | null }`, or `null` when absent/invalid).
  - Rendered above the article body (`max-width: 680px`, `aspect-ratio: 16/9`, `rounded overflow-hidden`, `mb: 32px` / `mb-8`) on both `LibraryDetailPage.tsx` and `PostDetailPage.tsx`:
    1. When `locked && !access.show_video_in_preview`: renders the 16:9 `image` thumbnail (or dark stage fallback) with the locked preview overlay (`"MetFix Professional Access Required"` + lock icon + Join/Sign-in CTA matching `ResourceDetail.tsx:145-160`), and mounts **no** `<iframe>` or `<video src>` in the DOM (`SEC10`).
    2. When unlocked (`!locked || access.show_video_in_preview`) and `video` is present: renders a lazy-loaded responsive 16:9 `<iframe>` (`embedUrl` for YouTube/Vimeo) or `<video controls preload="metadata" poster={image ?? undefined} src={video.url}>` (for Self Hosted `brokenscience.org` media).
    3. When no `video` is present and `image` is non-null: renders the 16:9 featured `image` (`object-fit: cover`). When both `video` and `image` are `null` (and not a locked video preview), no empty media box is rendered.
- **PL7** Inline body images are `max-width:100%`, `height:auto`, and never wider than the 680px measure.
- **PL8** Body H2/H3, blockquote, figure/figcaption and lists keep their existing styles on `main`, scaled to the PL2 base (`C1`/`R17`).
- **PL9** **(Updated, E9 / `CQ-5`)** **Dynamic Breadcrumbs (`ResourceBreadcrumbs`):**
  - Rendered at top of the main reader column (`DM Sans` 12px–13px, `mb: 24px`) on both `LibraryDetailPage.tsx` and `PostDetailPage.tsx` in the format `Home > Resource Library > {Dynamic Source}` (`Home` links to `/`, `Resource Library` links to `/library`).
  - When the user navigated from a Topic, Category, or Content Type page via a valid `?from=<kind>:<slug>` query parameter (validated against `/^(topic|category|content-type):([a-z0-9]+(?:-[a-z0-9]+)*)$/`, `<= 80` chars) or router state:
    - `topic:<slug>` → 3rd crumb links to `/topic/<slug>` (or `/library/topic/<slug>`).
    - `category:<slug>` → 3rd crumb links to `/library/category/<slug>`.
    - `content-type:<slug>` → 3rd crumb links to `/library/content-type/<slug>`.
  - Display label for `?from=<kind>:<slug>` is resolved with **0 extra network requests** (`CQ-5.2`): first from `r.topics` / `r.categories` / `r.content_types` (or `CONTENT_TYPE_CHIPS`), then router state or synchronous `peekLibraryFilters()`, then humanized slug (`metabolic-health` → `Metabolic Health`).
  - **Default:** When `?from=` is absent or fails validation, the 3rd crumb defaults to the post's primary **Category** (`r.categories[0]` / `post.category`), linking to `/library/category/${r.categories[0].slug}` (or omits the 3rd crumb if `r.categories` is empty).
- **PL10** **(Updated, E10)** Locked/preview/join UX, `SafeHtml` sanitising, and head/meta tags behave as on `main`, while the post comments section is enabled below the article body per `PL17` and `PL18`.
- **PL11** No horizontal scroll at 390px. Long URLs or code in the body wrap (`overflow-wrap:anywhere` on the body).
- **PL12** (D2) Shared post styles live in `post-prose.css`, imported only by `PostDetailPage.tsx` and `LibraryDetailPage.tsx` (or their shared detail subcomponent). The `/library` list and `ResourceCard` fonts are unchanged from `main`, and the dead `.library-reader-hero` selector is removed or bound to `ResourceMediaStage` (`CQ-1.1`). Also remove tracked `docs/post-layout-search/` CQ notes from git (`CQ-0`).
- **PL13** (1129813, OQ-3 override) 2-column desktop reader grid (`.post-reader-grid`, main column + sticky `AuthorAside` right column when `author` is non-empty) on both `/posts/:id` and `/library/:type/:id`.
- **PL14** **(New, E6 / `CQ-4`)** **Category Display & Taxonomy Link:**
  - `DetailPost` (`shared/posts/types.ts`, `shared/posts/map.ts`, `shared/posts/guards.ts`) includes `categories: TermRef[]` (mapped via shared `mapTerms` from `shared/library/map.ts`, keeping `category: { name, slug } | null` for list backward compatibility).
  - Both `LibraryDetailPage.tsx` and `PostDetailPage.tsx` render the primary category (`r.categories[0]` / `post.categories[0]` or `post.category`) in `.post-detail-meta` as a link to `/library/category/:slug`.
- **PL15** **(New, E7 / `CQ-4`)** **Content Type Icon + Label & Taxonomy Link:**
  - `DetailPost` includes `content_types: TermRef[]` (mapped via shared `mapTerms`).
  - Both `LibraryDetailPage.tsx` and `PostDetailPage.tsx` render the Content Type icon + uppercase label in `.post-detail-meta` (using `r.content_types[0]` or falling back to resource `type`), linking to `/library/content-type/:slug`.
- **PL16** **(New, E8 / `CQ-4`)** **Clickable Topic Pills Row (`ResourceTopicPills`):**
  - `DetailPost` includes `topics: TermRef[]` (mapped via shared `mapTerms` from BSI `/bsi/v1/posts/{id}` `topics`).
  - `DETAIL_POST_KEYS` and `isDetailPost` (`shared/posts/guards.ts`) and `isLibraryDetailBody` (`shared/library/guards.ts`) are updated in lockstep, and cache version prefixes in `shared/posts/cache.ts` and `shared/library/cache.ts` are bumped (`CQ-4.2`).
  - When `topics.length > 0`, both `LibraryDetailPage.tsx` and `PostDetailPage.tsx` render the clickable Topic pills row (`flex flex-wrap gap-2 mb-8`, tag icon + topic name) **above** the 16:9 media stage (`PL6`), with each pill linking to `/topic/:slug` (or `/library/topic/:slug`). The old unlinked bottom topic chip list on `LibraryDetailPage.tsx` is removed.
- **PL17** **(New, E10 / `CQ-7`)** **Worker Post Comments Proxy (`/api/posts/:id/comments` & `/api/posts/:id/comments/:commentId`):**
  - Routes handled in the Worker (reusing the shared comment gate helpers from `worker/comments.ts`, `CQ-7.3`):
    - `GET /api/posts/:id/comments`: validates `:id` as a positive integer (`parsePositiveInt`), calls BSI `GET /wp-json/bsi/v1/posts/{id}/comments` (using session Bearer via `runUserBsiCall` with anonymous fallback when signed in, or API key when signed out; `Cache-Control: no-store`, `Vary: Cookie` when session cookie is present), sanitizes comment user objects via `stripCommentPii` / `sanitizePublicName`, and returns `{ comments, meta: { post_id, count } }`.
    - `POST /api/posts/:id/comments`: enforces `isAuthHost`, `readSessionContext` (401 when signed out), `checkOrigin` + `Sec-Fetch-Site` + constant-time `X-CSRF-Token`, `checkCommentWriteLimit` (`COMMENT_WRITE_LIMITER` `27104`, 5/60 s per `userId:ip`), body `{ content, parent_comment_id? }` validation (`1..2000` trimmed code points, optional positive int `parent_comment_id`), reCAPTCHA v3 `verifyCommentRecaptcha`, and Bearer-only `runUserBsiCall` to BSI `POST /wp-json/bsi/v1/posts/{id}/comments`.
    - `PATCH /api/posts/:id/comments/:commentId` (and `PUT` aliased to `PATCH`): enforces `isAuthHost`, session, CSRF, `checkCommentWriteLimit`, content validation (`1..2000` code points), and Bearer-only `runUserBsiCall` to BSI `PATCH /wp-json/bsi/v1/posts/{id}/comments/{commentId}`.
    - `DELETE /api/posts/:id/comments/:commentId`: enforces `isAuthHost`, session, CSRF, `checkCommentWriteLimit`, and Bearer-only `runUserBsiCall` to BSI `DELETE /wp-json/bsi/v1/posts/{id}/comments/{commentId}`.
  - Update the PR #3 `PW2` unknown-subpath test fixture from `/api/posts/1/comments` to `/api/posts/1/unknown` (`CQ-7.1`).
- **PL18** **(New, E10 / `CQ-7.6`)** **Post Detail Comments Section UI (`PostCommentsSection` / parameterized `CommentThread`):**
  - Parameterize `CommentThread.tsx` (`target: { kind: "daily-fix", ... } | { kind: "post", postId: number, returnPath: string }`) instead of duplicating it:
    - When `target.kind === "post"`, hide the Daily Fix Belly/Body/Brain pillar dropdown and pillar badge, fetch `GET /api/posts/${postId}/comments` at most once per `postId` mount via a module-level single-flight cache (`Map<number, CacheEntry>`), reuse `loadMe()` for session state, and pass `returnPath` (`window.location.pathname + window.location.search`) to `getMetfixLoginUrl(returnPath)`.
    - Supports viewing nested replies, posting top-level comments and replies (with reCAPTCHA v3), editing own comments (`PATCH`), and deleting own/moderated comments (`DELETE`). No automatic POST retry on write failure (`CT-P1`).
    - Rendered below the article body (`max-width: 680px`, `mt-10 pt-10`, top border, `Discussion` heading) on `PostDetailPage.tsx` and `LibraryDetailPage.tsx` (when the resource is locked, shows the locked discussion prompt or read-only state matching `ResourceDetail.tsx:358-370`).

### B. Dedicated Taxonomy Pages (`TX1`–`TX8`)
Modeled on `https://rlhome.emilydesigns.org/topic/metabolic-health` (`Topic.tsx`), implemented via a single parameterized `LibraryTaxonomyPage.tsx` (`CQ-6`).
- **TX1** **(E11 / `CQ-4.3`)** **Taxonomy `description` and `image` in `/api/library/filters`:**
  - Extend `LibraryFilterTerm` in `shared/library/types.ts` with `description: string | null` and `image: string | null`.
  - In `mapFilterTerms` (`shared/library/map.ts`), sanitize `image` via `pickImage` (`https://brokenscience.org` allowlist, else `null`), and sanitize `description` by converting paragraph breaks (`</p>`, `<br>`, `
?
\s*
?
`) to `

`, stripping all HTML tags and decoding entities per paragraph via `cleanText`, and joining non-empty paragraphs with `

` (or `null` when empty). Update `isLibraryFiltersBody` (`shared/library/guards.ts`) and bump the filters cache key in `shared/library/cache.ts`.
- **TX2** **(E12 / `CQ-6.2`)** **4-Place Route & SSR Parity for Taxonomy Pages:**
  - Supported routes:
    - Topic: `/topic/:slug` and `/library/topic/:slug`
    - Content Type: `/library/content-type/:slug`
    - Category: `/library/category/:slug`
  - Wired in all 4 places:
    1. `wrangler.jsonc` `assets.run_worker_first` includes `"/topic/*"` alongside `"/library/*"`.
    2. `worker/index.ts` routes `/topic/*` to `handleLibraryHtml`, and `worker/library.ts` `handleLibraryHtml` matches `/topic/:slug`, `/library/topic/:slug`, `/library/content-type/:slug`, and `/library/category/:slug` (validating `:slug` against `SLUG_RE`, returning 404 on invalid slugs) **before** `/library/:type/:id`.
    3. `client/src/const.ts` `KNOWN_ROUTES` includes `"topic"` (in addition to `"library"` from `SR19`) so `getRouterBase()` returns `""` on `/topic/:slug`.
    4. `client/src/App.tsx` places `/topic/:slug`, `/library/topic/:slug`, `/library/content-type/:slug`, and `/library/category/:slug` **above** `/library/:type/:id` in `<Switch>`, rendering the single `LibraryTaxonomyPage` component (`taxonomyKind: "topic" | "category" | "content-type"`).
- **TX3** **(E12 / `CQ-6.3`)** **Upstream `category` → `categories[]` Forwarding:**
  - In `worker/library.ts` `buildSearchUpstreamQuery`, accept singular `category` (in addition to `categories[]` and `categories`), validate positive integer term IDs via `parsePositiveInt`, and forward them to BSI `/wp-json/bsi/v1/resources/search` as `categories[]` (included deterministically in the Worker search cache key).
- **TX4** **(E12 / `CQ-6.1`)** **Taxonomy Breadcrumbs & 2-Column Hero:**
  - Breadcrumb at top of hero: `Home > Resource Library > {Term Name}` (`Home` links to `/`, `Resource Library` links to `/library`, `{Term Name}` has `aria-current="page"`).
  - 2-column Hero (`grid-cols-1 lg:grid-cols-2 gap-8 items-start`):
    - Left column: `<h1>` term title in Playfair Display (`clamp(28px, 3.5vw, 44px)`, weight 700); when `term.description` is non-null, splits on `

` into `<p>` elements (never `dangerouslySetInnerHTML`), shows paragraph 1 by default, and when `paragraphs.length > 1` renders a `Read More ↓` / `Show Less ↑` `<button type="button">` that toggles the remaining paragraphs.
    - Right column: when `term.image` is non-null, renders the 4:3 rounded hero image (`aspect-ratio: 4/3`, `rounded overflow-hidden`, `object-cover`).
- **TX5** **(E12 / `CQ-6.1`)** **Content-Type Filter Tab Bar on Topic & Category Pages:**
  - On `taxonomyKind === "topic"` and `taxonomyKind === "category"`, renders the horizontal scrollable content-type filter tab bar (`All`, `Videos`, `Articles`, `Live Streams`, `Infographics`, etc., mapped to `content_type_terms[]`).
  - On `taxonomyKind === "content-type"`, the content-type tab bar is omitted (since the page is already scoped to one content type).
- **TX6** **(E12 / `CQ-6.4`)** **Single-Fetch Discipline on Taxonomy Page Mount:**
  - `LibraryTaxonomyPage` resolves the term from the shared `getLibraryFilters()` promise (`<= 1` `/api/library/filters` call per session) and waits for `filtersReady` before activating `useInfiniteArchive`, firing **at most 1 `/api/library/search` request** on initial mount (and **0** `/api/library/search` requests when `:slug` is not found in filters, showing a NotFound / empty state with a link back to `/library`).
- **TX7** **(E9, E12 / `CQ-5.1`)** **3-Column `ResourceCard` Grid with `from` Context Propagation:**
  - Renders matching resources in the 3-column `ResourceCard` grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5`) with infinite scroll / load-more via `useInfiniteArchive`.
  - Passes `from={`${taxonomyKind}:${term.slug}`}` (e.g. `"topic:metabolic-health"`, `"category:bsi"`, `"content-type:videos"`) to each `ResourceCard` so card links include `?from=<taxonomyKind>:<slug>` (and unlocked card clicks navigate to the detail page with that breadcrumb context).
- **TX8** **(E12)** **Filtered Empty State on Taxonomy Pages:**
  - When a content-type tab filter returns 0 items on a Topic or Category page, displays `"No {type} resources yet"` and a `"View all {term.name} content →"` reset button that clears the content-type tab back to `All`.

### C. Search page (`SR1`–`SR19`)
Route: **`/library/search`** (E1). Unchanged from rev 1.0.6:
- **SR1** Breadcrumb `HOME / RESOURCE LIBRARY / SEARCH`. The reference uses `.section-label` (11px, 600, 0.12em, uppercase, `#cfa576`), mb 16px. HOME links to `/`, RESOURCE LIBRARY links to `/library`, SEARCH is the current page (`aria-current="page"`). The page lives at `/library/search` and must not be matched by `/library/:type/:id`.
- **SR2** H1 "Search All Resources", centred, in "Playfair Display", serif; font-size `clamp(28px, 4vw, 48px)`, weight 700, colour `oklch(95% 0.006 60)`, mb 24px.
- **SR3** Search box: centred, max-width 42rem (`max-w-2xl`). It is a dark field, background `oklch(11% 0.004 60)` with a 1px border in gold at 25% alpha (`#…40`), padding 12px 16px, rounded, with a search icon in gold. The input's placeholder is exactly "What are you looking for?" and it has an `aria-label`. Text is 14px DM Sans.
- **SR4** A gold SEARCH button (background gold `oklch(75% 0.08 70)`, text `oklch(9% 0.004 60)`, weight 700, 12px uppercase, letter-spacing 0.08em, padding 6px 16px). Pressing Enter or clicking the button submits. A clear (×) control appears when the input has text. **(B2)** Search is submit-only. The input is local state, only a submit writes `?query=` to the URL, and only the URL drives the fetch. Typing makes 0 requests, with no debounce-on-type. × clears the input only, with no fetch until submit.
- **SR5** Content-type pills in this order: All Types, Videos, Articles, Live Streams, Infographics. The selected pill is gold background with dark text and a gold border. Others are background `oklch(11% 0.004 60)`, text `oklch(80% 0.006 60)` and border `oklch(100% 0 0 / 8%)`. Pills are 12px, weight 600, padding 6px 12px. "All Types" is selected on load. Mapping to the existing slugs in `CONTENT_TYPE_CHIPS`: Videos→`videos`, Articles→`articles`, Live Streams→`webinars`, Infographics→`infographic`, sent as `content_type_terms[]`. Exactly one pill is lit (E3: pills are the only type control). Pills and topic tabs are independent: changing one doesn't reset the other.
- **SR6** A full-width topic tab bar below the hero: background `oklch(10% 0.004 60)` with a 1px bottom border at 8% white, sticky at top. Tabs are 12px, weight 600, letter-spacing 0.04em, padding 14px 16px, `white-space:nowrap`, and the bar scrolls horizontally with the scrollbar hidden. The active tab has gold text and a 2px gold bottom border. Inactive tabs have text `oklch(80% 0.006 60)` and a transparent border. "All" is always first and active when `topic` is unset. When `topic` is set, the tab with that id is active. When `topic` isn't in the resolved list, **no** tab is active (C1, SR13). At most one tab is ever active.
- **SR7** (E2) The tabs after "All" are: Sanity `searchTopics` entries in Sanity order, then `/api/library/filters` `topics` in API order, deduped by topic id. The first occurrence wins, so the Sanity label overrides the API `name`. No hardcoded list and no cap.
- **SR8** (E2, E3) Selecting a tab sets `topic=<id>` and sends `topics[]=<id>`, combined with the query and the current pill. Clicking "All" clears `topic`. A tab never changes the pill.
- **SR9** The count line is left-aligned, 14px, colour `oklch(80% 0.006 60)`. It reads `{n} resource(s)`, plus ` for "{q}"` when a query is set and ` in {Tab label}` when a topic tab is active. "resource" is singular at n=1. n is `meta.total`.
- **SR10** "× Clear filters" is right-aligned on the same row and shows only when a query, a non-All tab or a non-All pill is set. It resets all three and refetches.
- **SR11** Results use the existing `ResourceCard` in a grid of 1 column (mobile), 2 (sm) and 3 (md+), with a 20px gap. Paging reuses `useInfiniteArchive`.
- **SR12** Empty results show "No results found" (Playfair, 18px) and "Try a different search term or browse by category above." A fetch error shows a retry and never shows a blank page.
- **SR13** (R4, E3) State lives in the URL (`/library/search?query=&type=&topic=`). `type=` holds one `CONTENT_TYPE_CHIPS` slug, set only by a pill. `topic=` holds a positive integer topic id. Reload and back/forward restore it. Invalid values fall back to All.
- **SR14** Mobile at 390px: no horizontal page scroll (only the tab bar scrolls), and the pills wrap.
- **SR15** Keyboard and a11y: the pills and tabs are buttons with `aria-pressed` or `aria-selected`, focus is visible, and Enter in the input submits.
- **SR16** (E1) **`/library` search hands off:** submitting the existing `/library` search form navigates to `/library/search?query=<trimmed q>` (SPA navigation, no full reload), carrying the active `/library` type chip as `type=<slug>` when it's one of the SR5 pill slugs. An empty submit goes to `/library/search` with no query.
- **SR17** **(B3)** Results go through `useInfiniteArchive({kind:"search", params}, resetKey)`, which aborts on reset. `resetKey` is the canonical URL query string (sorted query, type, topic).
- **SR18** (E1) A direct load of `/library/search` and of `/library/search?query=x` serves the SPA and renders the page, on the deployed Worker as well as locally, never NotFound or a Worker 404.
- **SR19** (C3, extended by `TX2`) `client/src/const.ts` `KNOWN_ROUTES` includes `"library"` and `"topic"`. `getRouterBase()` returns `""` for `/library`, `/library/search`, `/library/post/1`, `/library/topic/metabolic-health`, and `/topic/metabolic-health` at the root.

### D. Sanity: editable topic list (`SN1`–`SN7`)
Unchanged from rev 1.0.6:
- **SN1** (E2) `siteSettings.searchTopics`: ordered `array` of objects `{topic_id: number (required, integer > 0), label: string (optional)}`.
- **SN2** Ethan can reorder, rename, add and remove items in Studio.
- **SN3** (B1) Read via the existing token-free `sanityClient` through the single memoised `SITE_SETTINGS_QUERY` request per page load.
- **SN4** (E2) Fallback: Sanity missing/empty/failing → API topics only; API failing/empty → Sanity entries only (`Topic {id}` when unlabelled); both empty/failing → only `"All"`.
- **SN5** (E2, B4) Topics come from one module-level cached `getLibraryFilters` promise shared across library/search/taxonomy pages.
- **SN6** (E2) No seeding in `scripts/seed-sanity.ts` and no hardcoded topic list.
- **SN7** Retired (E2, E3); kept as an ID placeholder for numbering stability.

### E. Security & Threat List (`SEC1`–`SEC13`)
- **SEC1** The browser never calls `brokenscience.org/wp-json`. All data goes through same-origin `/api/*`. Built-bundle scan: no `wp-json` URL is reachable from client code.
- **SEC2** (B6) No token in the client. Use only the existing token-free `sanityClient`. No new `VITE_*` secret. `sanity.vite-guard.test.ts` passes and `dist/` grep finds no Sanity token.
- **SEC3** (E4) Logged out, locked, exclusive and gated items show in `/library/search` and taxonomy grids **with a lock**, using `ResourceCard` with `isLockedCard` / `onOpenLocked` → `JoinModal`. No hide filter (`searchVisibility.ts` stays deleted).
- **SEC4** Upstream headers follow the Worker's strict separation: anonymous upstream reads (`GET /api/library/*`, anonymous `GET /api/posts/*`) send `X-API-Key` only; signed-in user-acting requests (`POST`/`PATCH`/`DELETE` `/api/posts/:id/comments*` and Bearer-backed reads via `runUserBsiCall`) send `Authorization: Bearer <token>` without `X-API-Key` (`BK3`/`DP45`) and never forward `Referer`, `Origin`, or client IP headers (`BK12`).
- **SEC5** The search query string is length-capped at `QUERY_MAX` (120) client-side and in the Worker. Nothing user-typed is rendered as unsanitized HTML.
- **SEC6** No token values, passwords, or credentialed URLs in logs, test output, error bodies, or the PR body.
- **SEC7** (E4 guard) Locked cards and locked detail pages withhold gated body `content` and playable `video` URLs (`SEC10`).
- **SEC8** **(New, E10 / `CQ-7.3`)** **Post Comments Auth, Host, Origin & CSRF Gate:**
  - Every write to `/api/posts/:id/comments` (`POST`) and `/api/posts/:id/comments/:commentId` (`PATCH`/`PUT`/`DELETE`) enforces:
    1. `isAuthHost(request, env)` (rejecting disallowed hosts with `403 { error: "forbidden" }`).
    2. Valid session cookie via `readSessionContext(request, env)` (rejecting missing/invalid sessions with `401 { error: "unauthorized" }` and `0` upstream calls).
    3. `checkOrigin(request)` (`Origin` and `Sec-Fetch-Site` check) plus constant-time `X-CSRF-Token` comparison against `csrfForSid(env.CSRF_SECRET, ctx.sid)` (rejecting mismatches with `403 { error: "invalid_csrf" }` and `0` upstream calls).
- **SEC9** **(New, E10 / `CQ-7.3`)** **Post Comments Rate Limiting, reCAPTCHA v3, & PII Stripping:**
  - Write routes enforce `checkCommentWriteLimit` using the existing bound `COMMENT_WRITE_LIMITER` (`27104`, 5/60 s per `userId:ip`); `POST /api/posts/:id/comments` enforces `verifyCommentRecaptcha` (`RECAPTCHA_SECRET_KEY`, action `"comment"`, score threshold) before calling BSI; all comment responses strip email/IP/PII fields via `stripCommentPii` and `sanitizePublicName` and return `Cache-Control: no-store`.
- **SEC10** **(New, E5 / `CQ-2.2`, `CQ-2.3`)** **Video / Embed URL Allowlisting & Locked Video Suppression:**
  - `mapResourceVideo` parses URLs strictly with `new URL(...)`, requiring `protocol === "https:"`, empty `username`/`password`, and empty `port`. Rejects `javascript:`, `data:`, `vbscript:`, `file:`, `http:`, path traversal, and untrusted hosts.
  - Canonicalizes YouTube embeds to `https://www.youtube.com/embed/<videoId>` (or `https://www.youtube-nocookie.com/embed/<videoId>`) with `videoId` matching `/^[A-Za-z0-9_-]{6,32}$/`, Vimeo embeds to `https://player.vimeo.com/video/<videoId>` with `videoId` matching `/^[0-9]{1,20}$/`, and allows Self Hosted `<video>` only on `https://brokenscience.org`.
  - When `locked && !access.show_video_in_preview`, playable `url` / `embedUrl` / `videoId` values are withheld (not leaked in mapped detail payloads or mounted in DOM `<iframe>` / `<video>` elements).
- **SEC11** **(New, E5, E10 / `CQ-3`)** **Detail Page CSP & reCAPTCHA Site-Key Injection (`worker/csp.ts`):**
  - HTML responses from `handlePostsHtml` (`/posts/:id`) and `handleLibraryHtml` (`/library/:type/:id`) include `Content-Security-Policy` with `frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`, `media-src 'self' https://brokenscience.org`, `script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`, `connect-src 'self' https://www.google.com/recaptcha/`, and `frame-ancestors 'none'`, and inject `window.__MFX_RECAPTCHA_SITE_KEY__` when `env.RECAPTCHA_SITE_KEY` is configured.
- **SEC12** **(New, E9 / `CQ-5.1`, `CQ-5.3`)** **Breadcrumb `?from=` Validation & Cache-Key Isolation:**
  - `?from=` is validated against `/^(topic|category|content-type):([a-z0-9]+(?:-[a-z0-9]+)*)$/` (`<= 80` chars); any malformed, scheme-bearing (`javascript:`, `data:`, `http:`), or unknown value is ignored and falls back to `r.categories[0]`.
  - `?from=` is never forwarded to `/api/library/item/:type/:id` or `/api/posts/:id`, never included in Worker cache keys, and never emitted into `<link rel="canonical">` or `og:url`.
- **SEC13** **(New, E11, E12 / `CQ-4.3`, `CQ-6.1`)** **Taxonomy Description & Image Sanitization:**
  - Taxonomy `description` from `/api/library/filters` has all HTML tags stripped in `mapFilterTerms` and is rendered as plain text inside `<p>` elements (never `dangerouslySetInnerHTML`). Taxonomy `image` is allowlisted to `https://brokenscience.org` via `pickImage`. Taxonomy `:slug` params are validated against `SLUG_RE` (`/^[a-zA-Z0-9_-]{1,64}$/`).

### F. Tests and checks (`TC1`, `TC1b`, `TC2`–`TC14`)
- **TC1** Unit: the search tab resolver (E2, SN4).
- **TC1b** Mount (B1, B2, B3): `sanityClient.fetch` called once across nav + footer + `/library/search`; submit-only search; abort on tab click.
- **TC2** Unit: `/library/search` params, URL sync, and `meta.total` count line (`SR5`, `SR8`, `SR9`, `SR13`).
- **TC3** Mount (E4, SEC3, SEC7): logged-out search renders locked cards with lock badge, `JoinModal` on click, and no leaked `content` or `video`.
- **TC4** Mount: `/library/search` renders `SR1`–`SR10` in order and Clear filters resets state.
- **TC5** **(Updated)** Computed style & DOM checks for `PL1`, `PL2`, `PL4`, `PL5`, `PL6` (16:9 media stage), `PL13` (`.post-reader-grid` + `AuthorAside`), `PL14`–`PL16` (category link, content-type link, topic pills row above media stage), `SR2`, `SR5`, and `SR6`.
- **TC6** `npm test`, `tsc`, `check:worker`, `npm run test:workers`, and `npm run build` pass.
- **TC7** Bundle & repo scan for `SEC1`, `SEC2`, `PL12` (`post-prose.css` import sites), no `dangerouslySetInnerHTML` in taxonomy components (`SEC13`), and no tracked `docs/post-layout-search/` CQ notes (`CQ-8.3`).
- **TC8** (`SR16`, `SR18`) Mount: `/library` search form handoff to `/library/search?query=q&type=videos`.
- **TC9** **(New, `PL6`, `SEC10`, `CQ-2`, `CQ-8.2`)** Unit + mount: `mapResourceVideo` table test covering YouTube object/string, Vimeo object/string, Self Hosted `brokenscience.org` object/string, rejected schemes/hosts (`javascript:`, `data:`, `http:`, untrusted domain, path traversal), and locked suppression (`locked: true, access.show_video_in_preview: false` → no playable URLs and 0 `<iframe>`/`<video>` nodes in DOM; `show_video_in_preview: true` or unlocked → renders `<iframe>` or `<video>`).
- **TC10** **(New, `PL14`–`PL16`, `TX1`, `CQ-4`, `CQ-8.2`)** Guard lockstep unit test: `mapDetailPost(fixture)` passes `isDetailPost` (`DETAIL_POST_KEYS`) and `mapDetailFromPostLike(fixture)` passes `isLibraryDetailBody` with `video`, `categories`, `content_types`, and `topics` populated; `mapFilterTerms` passes `isLibraryFiltersBody` with `description` (HTML stripped, `

` preserved) and `image` (`brokenscience.org` allowlisted).
- **TC11** **(New, `PL9`, `SEC12`, `CQ-5`)** Unit + mount: dynamic breadcrumbs on `LibraryDetailPage` and `PostDetailPage` for `?from=topic:metabolic-health`, `?from=category:bsi`, `?from=content-type:videos`, invalid/malicious `?from=javascript:alert(1)` falling back to `r.categories[0]`, and asserting **0** `/api/library/filters` requests on detail page mount and no `?from=` in `<link rel="canonical">`.
- **TC12** **(New, `TX2`–`TX8`, `CQ-6`)** Worker + client mount tests for `LibraryTaxonomyPage`:
  - `wrangler.jsonc` includes `"/topic/*"`; `getRouterBase()` returns `""` on `/topic/metabolic-health`; Worker `handleLibraryHtml` and client `<App />` route `/topic/:slug`, `/library/topic/:slug`, `/library/content-type/:slug`, and `/library/category/:slug` to `LibraryTaxonomyPage` (never `LibraryDetailPage` 404); invalid `:slug` returns Worker 404.
  - `buildSearchUpstreamQuery` forwards `category` → `categories[]`.
  - Mount of `LibraryTaxonomyPage` renders breadcrumbs, 2-col hero, multi-paragraph `Read More ↓` / `Show Less ↑` toggle, 4:3 image, content-type tab bar on Topic/Category (hidden on Content Type), and `ResourceCard` links with `?from=<kind>:<slug>`, making **<= 1** `/api/library/filters` call and **exactly 1** `/api/library/search` call on initial mount.
- **TC13** **(New, `PL17`, `PL18`, `SEC8`, `SEC9`, `CQ-7`)** Worker + client tests for Post Comments:
  - Worker `/api/posts/:id/comments` (`GET`, `POST`) and `/api/posts/:id/comments/:commentId` (`PATCH`, `DELETE`): tests anonymous `GET`, signed-in `GET` (Bearer-only), `POST` auth/host/CSRF/rate-limit (`27104`)/reCAPTCHA/validation/PII-stripping, `PATCH` edit, `DELETE` delete, and single-flight 401 refresh via `runUserBsiCall`.
  - Client `CommentThread` (`target.kind === "post"`): hides pillar dropdown, fetches `GET /api/posts/:id/comments` once per `postId`, posts/edits/deletes comments, and does not auto-retry failed `POST`.
- **TC14** **(New, `SEC11`, `CQ-3`)** Worker HTML test: `handlePostsHtml` (`/posts/42`) and `handleLibraryHtml` (`/library/post/42`) return `Content-Security-Policy` allowing YouTube (`www.youtube.com`, `www.youtube-nocookie.com`), Vimeo (`player.vimeo.com`), Google reCAPTCHA (`frame-src`, `script-src`, `connect-src`), and `media-src 'self' https://brokenscience.org`, and inject `window.__MFX_RECAPTCHA_SITE_KEY__`.
- **Mutation (advisory only, gating at 0, no full runs, no reruns):** small targeted set on changed high-risk code (`mapResourceVideo` locked guard, `isDetailPost` guard key set, `?from=` validator regex, taxonomy `filtersReady` search gate, and post comments CSRF check).

### G. Box / post-deploy checks (`PD1`–`PD8`)
- **PD1** On the preview deploy, open `/library/search` (direct load and from `/library` search box) and confirm tabs, pills, placeholder, and count line.
- **PD2** Network tab: only same-origin `/api/*` and `*.apicdn.sanity.io` requests, with no direct `brokenscience.org/wp-json` calls from the browser.
- **PD3** In Studio (preview dataset only): test `searchTopics` ordering and label override.
- **PD4** Logged out, verify locked items show with a lock badge and open `JoinModal` without leaking body or video URLs.
- **PD5** **(Updated)** On `/posts/:id` and `/library/:type/:id`, verify the 16:9 video/thumbnail stage (`PL6`), meta row category & content-type links (`PL14`, `PL15`), clickable topic pills row above the media stage (`PL16`), `AuthorAside` right column (`PL13`), and body typography at 1440px and 390px.
- **PD6** **(New)** On `/topic/metabolic-health`, `/library/topic/metabolic-health`, `/library/category/:slug`, and `/library/content-type/:slug`, verify the 2-column hero, `Read More ↓` / `Show Less ↑` description toggle, 4:3 hero image, content-type filter tabs, and 3-column `ResourceCard` grid.
- **PD7** **(New)** Click a `ResourceCard` from a Topic, Category, and Content Type page and verify the detail page's 3rd breadcrumb reflects and links back to that Topic, Category, or Content Type (`?from=`), while loading the detail page directly defaults the 3rd breadcrumb to its primary Category.
- **PD8** **(New)** On a post detail page (`/posts/:id` and post-backed `/library/post/:id`), verify the `Discussion` comments thread loads below the article, and when signed in, posting, editing, and deleting a comment succeeds end-to-end through `/api/posts/:id/comments`.

---

## 3. Open questions
- **OQ-1** (held to `main` styles per R6/C1) Body H2/H3, blockquote, figure/figcaption and list styles stay as on `main`.
- **OQ-2** Theme colours stay as on `main`.
- **OQ-3** **Closed (Ethan override at `1129813` + 2026-10-26 review):** Both `/posts/:id` and `/library/:type/:id` are in scope, including the `AuthorAside` right column (`PL13`) and the full detail template (`PL6`, `PL9`, `PL14`–`PL18`).
- **OQ-4** Desktop/mobile H1 uses `clamp(22px, 3vw, 36px)` on detail pages (`PL4`) and `clamp(28px, 3.5vw, 44px)` on taxonomy pages (`TX4`).
- **OQ-5** **Closed (E1):** `/library/search` with `/library` handoff.
- **OQ-8** **Closed (E2):** Tabs come from `/api/library/filters` + Sanity `searchTopics`.
- **OQ-9** **Ruled (E4, relayed):** Locked items show with a lock; merge still requires Ethan's direct go.
- **OQ-13** **Closed (C3 + E12):** `KNOWN_ROUTES` includes `"library"` and `"topic"`.
- **OQ-14 (Resolved in `PL17`):** BSI `app-apis.php` registers `GET/POST /wp-json/bsi/v1/posts/{id}/comments` and `PATCH/DELETE /wp-json/bsi/v1/posts/{id}/comments/{commentId}` (no `/like` endpoint on post comments). The Worker aliases `PUT` to `PATCH` on `/api/posts/:id/comments/:commentId` so both `PUT` and `PATCH` work cleanly, and uses the configured BSI API key that has access to `/bsi/v1/posts/{id}/comments` (preferring `env.BSI_API_KEY || env.DAILY_FIX_API_KEY || env.BSI_POSTS_API_KEY` as appropriate for anonymous `GET`).

---

## 4. Changelog
- **1.1.0 (2026-10-27):** Folds in Ethan's PR #18 review additions (relayed via CEO & Web Lead, §0e E5–E12) and CQ's pre-build architecture notes (`metfix-pr18-post-taxonomy-cq-prebuild.md`, md5 `866f1df1441f99a9268857601de95d30`, `CQ-1`–`CQ-8`). Total gating IDs: **88** (`PL1`–`PL18`, `TX1`–`TX8`, `SR1`–`SR19`, `SN1`–`SN7`, `SEC1`–`SEC13`, `TC1`+`TC1b`+`TC2`–`TC14`, `PD1`–`PD8`).
  - Re-enabled and expanded `PL6` (16:9 video/embed/thumbnail stage + locked overlay, superseding D3).
  - Updated `PL5`, `PL9`, `PL10`, `PL12`, `SR19`, `SEC4`, `TC5`, `TC7`, `PD5`; recorded `PL13` (`1129813`).
  - Added `PL14`–`PL18` (category link, content-type icon+label link, clickable topic pills row above media stage, Worker post comments proxy, post detail comment thread).
  - Added `TX1`–`TX8` (taxonomy `description` + `image` in `/api/library/filters`, 4-place routing for `/topic/:slug`, `/library/topic/:slug`, `/library/content-type/:slug`, `/library/category/:slug`, `category` → `categories[]` upstream forwarding, 2-col hero with `Read More ↓` / `Show Less ↑` and 4:3 image, content-type tab bar, single-fetch discipline, and `from` breadcrumb propagation).
  - Added `SEC8`–`SEC13`, `TC9`–`TC14`, and `PD6`–`PD8`.
- **1.0.6 (2026-10-22):** Scope rulings D1–D6 (59 IDs).
