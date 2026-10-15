# Spec: move metfix.org from GitHub Pages to Cloudflare, with an edge SEO head for The Daily Fix (rev 2)

Status: rev 2.2 (final), for CQ and QA. Ethan approved the move on 2026-10-12 (via MetFix Web Lead).
Production repo: https://github.com/Break-Even-Productions/metfixhome. No repo changes, deploys, or DNS changes come from this Spec.

## Changelog
- rev 2.2 (2026-10-12): Final. Deploy path is Workers Builds (Lead decision). Adds Ethan's checklist. No open items remain.
- rev 2.1 (2026-10-12): Sitemap is unblocked using the existing BSI list route. Adds CQ approval notes: a `hasContent` field, the mapper-fail case, and client unavailable tests.
- rev 2 (2026-10-12): Folded in Web Lead decisions 1-15 and CQ adds. The ?tab= scheme supersedes the hash-pillar lock, and the SEO head reverses the old no-canonical lock. There is one shared normalizeDailyFixPath(), one shared mapper, and one shared status module. df-initial now carries raw upstream JSON. TTLs mirror BSI. The cache key is https://metfix.org/__dfcache/{ISO}. Upstream timeout is 3 s. The /api/daily-fix contract is explicit. The rule for "has content" is defined. New tests cover escaping, HEAD, non-HTML, rest days, and the legacy hash. Wrangler is pinned and the worker has its own tsconfig. Section 10 wording on over-limit failures is corrected. The Sanity token is moved out of scope. Lead decisions are moved into their sections, and stale open items are removed.
- rev 1 (2026-10-12): First draft.

## 0. Branch
- Start a new branch from `cursor/the-daily-fix-8836` at `5b94dcbacf17c3d8af1441f9a939fc96922e33ea` (the #1 head). The new PR uses `cursor/the-daily-fix-8836` as its base.
- #5 (MealPhoto) is already in 5b94dcba as a squash merge from 2026-10-05, so there is no merge-order item.
- Do not merge #1, #2, or #3. Do not touch the BSI repo or the app.

## 1. Architecture
Use one Worker with static assets in metfixhome, on the free plan. Do not use Pages. The Worker is named `metfixhome`.
- Static asset requests are free and unlimited. Only requests that run the Worker count against the free tier.
- The `metfix-bff` `/daily-fix` handler (`src/index.ts` at `587dc0a`) is ported into the metfixhome Worker and served same-origin at `/api/daily-fix` (contract in section 5.4).
  - There is one secret, `DAILY_FIX_API_KEY`. Ethan sets it with `wrangler secret put`. It never goes in the client.
  - Same-origin calls need no CORS.
  - `metfix-bff` stays live until cutover is verified, then gets retired. Retiring it is not part of this PR.
  - The client `DAILY_FIX_BFF_URL` becomes `/api/daily-fix`.
- The edge embeds the day it already fetched. The Worker injects the **raw upstream JSON** (not mapped output) as `<script type="application/json" id="df-initial">`. The client runs it through the same shared mapper it uses for `/api/daily-fix`, and seeds its day cache from it. The first view makes no `/api/daily-fix` call for the shown day. Prefetch of −1 and −2 stays (data only).
  - Escaping for script context: after `JSON.stringify`, replace `<` with `\u003c`, `>` with `\u003e`, `&` with `\u0026`, U+2028 with `\u2028`, and U+2029 with `\u2029`. The result is still valid JSON, so `JSON.parse` returns the same value.
- Shared modules, imported by both the worker and the client, with no DOM or Worker globals:
  - `normalizeDailyFixPath()`: pure path and query normalizer (section 4).
  - The mapper: upstream JSON to `DailyFixDay`, including the has-content rule (section 6.1).
  - The status module: upstream result plus route to status and head kind (section 5.2).
- The client rewrite code for in-app navigation stays, and it calls the same `normalizeDailyFixPath()`.

## 2. wrangler.jsonc and build
- `main`: `worker/index.ts`. `compatibility_date` is the build date or later.
- `assets`: `directory: "./dist/public"`, `binding: "ASSETS"`, `not_found_handling: "single-page-application"`, and `run_worker_first: ["/the-daily-fix", "/the-daily-fix/*", "/api/*", "/sitemap-daily-fix.xml"]`.
- Pin wrangler to an exact version, 4.20.0 or later, in devDependencies. The array form of `run_worker_first` needs it.
- The worker gets its own `worker/tsconfig.json` with Workers types. The client tsconfig does not include Workers types, and the worker tsconfig does not include DOM types. Shared modules compile under both.
- The worker passes anything that is not a GET or HEAD request with `Accept` including `text/html` straight to `env.ASSETS.fetch(request)`, with no BSI call. The exceptions are `/api/daily-fix` and `/sitemap-daily-fix.xml`, which the worker handles itself.
- Custom domain: `metfix.org` on the Worker. `www.metfix.org` becomes a free Single Redirect rule with a 301 to `https://metfix.org${path}${query}`. Ethan does this in the dashboard.
- Do not add `_redirects` for Daily Fix. The Worker owns those redirects.
- Vite `base` goes back to `"/"`. Add `build:cf`, which is `vite build` (same command as `build:pages`).
- CI stays green: `npm ci --legacy-peer-deps`, the liquidglass chunk assert, and vitest. Add `wrangler deploy --dry-run`.
- Deploy runs from main only, through a GitHub Action or Workers Builds. Web Lead and Ethan pick. This PR only adds config.

## 3. Cutover and retiring GitHub Pages
Ethan does these in order:
1. Deploy the Worker.
2. Test it on workers.dev. The Cache API is not trusted there.
3. Attach `metfix.org` and add the www redirect rule.
4. Verify section 9 on the live site.
5. Disable Pages in the repo settings.

The Pages fallback files stay in this PR. A separate post-cutover commit removes the root `CNAME`, `.github/workflows/deploy-pages.yml`, and the `cp index.html 404.html` step. Rollback means pointing DNS back to GitHub Pages before that commit lands. Done in PR #7 (2026-10-15).

## 4. Edge routing: normalizeDailyFixPath()
One pure function takes a path and query and returns one of: serve (bare or dated ISO plus tab), redirect (301 target), or not-found. The worker and the client both use it.
- `/the-daily-fix` is the bare page. It is not rewritten to a date.
- `/the-daily-fix/YYMMDD` is the dated canonical form. YY maps to 2000–2099.
- `/YY/MM/DD`, `/YYYYMMDD`, and `/YYYY-MM-DD` forms get a 301 to `/the-daily-fix/YYMMDD`, keeping the query.
- An old path pillar `/the-daily-fix/{date}/{belly|body|brain}` gets a 301 to `/the-daily-fix/{YYMMDD}?tab={pillar}`. Belly drops the param.
- Four or more segments, an impossible date (`260231`, month 13), non-two-digit slash parts, and years outside 2000–2099 are not-found. The worker returns 404 with `index.html` as the body, a generic head with `noindex`, no canonical, and no BSI call.
- `?tab=`: the allowlist is `body` and `brain`. `tab=belly`, unknown, empty, repeated, or array values get a 301 to the tab-less URL. A case-only difference (`BRAIN`) gets a 301 to lowercase. Every other query pair is kept byte for byte.
- No 301 ships until an exhaustive table test of `normalizeDailyFixPath()` exists and passes. It covers every form above, valid and invalid, with and without other query params.

## 5. Data, status, cache, and the API
### 5.1 Upstream
- Dated route: one `GET https://brokenscience.org/wp-json/metfix/v1/daily-fix?date={ISO}`.
- Bare route: one GET with `date=` set to today in Etc/GMT-2. If the day BSI's own bare head chooses differs, the BSI GET is the source of truth (agreed with BSI Lead).
- `X-API-Key` is sent only when the request URL's host is exactly `brokenscience.org`. The worker asserts this before the fetch.
- Timeout: 3 seconds through `AbortSignal.timeout(3000)`. A timeout follows the 503 rules.

### 5.2 Status rules (shared status module)
- Dated, upstream 200, maps, and the top-level `date` equals the URL date: **200** with the full head.
- Dated, upstream 404, or a 200 whose `date` differs: **404** with the noindex generic head.
- Bare, 200 that maps: **200**. The head uses the response `date`.
- Bare, unusable: **200** with the generic head. The client shows Not available.
- Upstream 5xx, a timeout, a thrown fetch, or a missing key: **503** with `index.html`, `Retry-After: 300`, a generic head, and `Cache-Control: no-store`. The SPA still renders.
- HEAD gets the same status and headers as GET, with no body.

### 5.3 Edge cache
- Cache API, per data center, on the custom domain. Cache key: `https://metfix.org/__dfcache/{ISO}`. It is a GET request on our own zone and is never routed to users.
- Only upstream 200s that map are cached. Never 404, 5xx, timeouts, or error bodies.
- Writes use `ctx.waitUntil(cache.put(...))`, with an explicit `Cache-Control: s-maxage={ttl}` on the stored response.
- TTLs mirror BSI:
  - Today, the bare route, and every day from today−7 through today (Etc/GMT-2): short. The TTL runs until the next DFX midnight (00:00 Etc/GMT-2), and is never more than 300 seconds for today and the bare route.
  - Days older than today−7: long, 86400 seconds.
- comment_counts: at 5b94dcba, `client/src/pages/the-daily-fix/data.ts` (the mapper) and `client/src/pages/the-daily-fix/DayContent.tsx` do not reference `comment_counts`. The mapper drops it, so the UI does not show it and no extra cap is needed. If a later change shows it, it must use the short TTL.
- `/api/daily-fix` and the HTML route read and write the same entry. That is one upstream call per ISO per data center per TTL.
- The HTML itself is not cached.

### 5.4 /api/daily-fix contract
- Methods: GET and HEAD. Any other method returns 405 with `Allow: GET, HEAD`.
- Params: `date` is required and must be a real `YYYY-MM-DD`. Missing or invalid returns 400 with `{"error":"bad_date"}`. Other params are ignored.
- 200: the raw upstream JSON body, `Content-Type: application/json; charset=utf-8`, `Cache-Control: public, max-age=60`, `X-Content-Type-Options: nosniff`.
- 404: upstream 404, body `{"error":"not_found"}`, `Cache-Control: public, max-age=60`.
- 503: upstream failure or timeout, body `{"error":"unavailable"}`, `Retry-After: 300`, `Cache-Control: no-store`.
- No CORS headers. No upstream headers are passed through. The key never appears in any response.
- The client maps the body with the shared mapper. A dated mismatch is handled in the client, as it is today.

## 6. HTMLRewriter head (BSI daily-fix-seo-head rev 1.3.x, PR #10, metfix target)
This head **reverses the old metfix.org lock** (static homepage canonical, no per-page canonical, no og:url, no sitemap) for Daily Fix pages. Tests that assert the old head get updated to the new head. They must not be "fixed" back. Other pages keep the canonical `https://metfix.org/`.
- Replace the site-wide title, description, canonical, og:url, og:title, og:description, og:image (+alt), twitter:title, twitter:description, and twitter:image tags in `client/index.html`.
- Tag order follows BSI: title, description, canonical, og:type `website`, og:title, og:description, og:url, og:image (width and height only when known), `twitter:card=summary_large_image`, twitter:title, twitter:description, twitter:image.
- The site JSON-LD stays. No CollectionPage JSON-LD is added.
- `{ymd}` is the content date as `yymmdd`.

### 6.1 Has content (shared mapper)
- A pillar has content when the shared mapper's output for it has a non-empty main field: belly has a recipe or body text, body has non-empty `body` text before the excerpt fallback, and brain has non-empty article body.
- A rest day comes back with `body.body` null, `body.title` "Rest", and excerpt "Rest day". Under this rule, body on a rest day has **no content**. The head and the page both read this from the mapper's output, so they agree. No separate edge check exists.
- CQ and the implementer should confirm the exact field names against `data.ts`. The rule is stated in terms of the mapper output, so field renames do not change it.

### 6.2 Values
- **Title:** `The Daily Fix - {ymd}`. With an allowed tab whose pillar has content, add ` | Body` or ` | Brain`. No dish name. `<title>`, og:title, and twitter:title are identical.
- **Description:** `The Daily Fix {ymd}: Belly - {t}. Body - {t}. Brain - {t}.` Pillars with no title are left out. Titles are stripped of tags, HTML-decoded exactly once, then attribute-escaped. Over 155 code points: take 154, cut back to the last space, trim trailing `.,:;-` and spaces, then append `…`. With no titles, use the generic description. The same string goes into all three description tags.
- **Image:** the active tab's `photo_url`, then `belly.photo_url`, then the MetFix logo fallback (1336×1336, with width and height only for the fallback). Force https.
- **canonical:** always tab-less. Bare is `https://metfix.org/the-daily-fix`. Dated is `https://metfix.org/the-daily-fix/{YYMMDD}`.
- **og:url:** the canonical plus `?tab=body|brain` when that tab is allowed and has content. BSI Lead agreed to this in #10.
- Every value is attribute-escaped. Raw BSI HTML is never interpolated.

## 7. Client tab scheme: ?tab= supersedes the hash-pillar lock
The hash-pillar lock is superseded by `?tab=`, because Ethan wants per-tab share previews (Web Lead decision).
- The page reads the pillar from `?tab=` (`body`, `brain`). No param means belly.
- Tab clicks write `?tab=` with replace (wouter replace). No reload and no refetch. The same ISO cache key applies.
- Legacy `#belly`, `#body`, and `#brain` links are turned into `?tab=` with replace (belly means no param), and the hash is dropped.
  - This replace runs before the first render reads the pillar, so there is no Belly flash followed by a switch.
  - The edge never sees the hash, so the first HTML head is tab-less in that case. That is acceptable.
- The hash-sync listener is replaced by a query-sync listener. Its tests are updated.
- `dailyFixPath` and `dailyFixHref` emit `?tab=`. `canonicalHash` becomes a `tab` field. In-app navigation calls the shared `normalizeDailyFixPath()`.
- Unchanged: the YYMMDD contract, the bare path, and the dated-mismatch and closer-day locks.
- Tests that move from `#` to `?tab=`:
  - `model.test.ts`: "keeps YYMMDD as canonical and hashes pillars", "rewrites hyphenated, 8-digit, and slash dates to YYMMDD", "lets a path pillar win over a hash…", and "drops a bad pillar hash or path…".
  - `data.test.ts`: the `/the-daily-fix/250210#brain` one-GET test becomes `?tab=brain` and still makes exactly one GET.
  - `page.mount.test.tsx`: tests 6, 12, and C6.
  - `document-base.test.ts`: check against base `"/"`.
- New tests: `#brain` becomes `?tab=brain`; `#belly` is dropped; an unknown client-side `?tab` falls back to belly and drops the param; a legacy hash renders the target pillar on the first render with no Belly frame, and still makes exactly one GET for the ISO.

## 8. Sitemap
- `client/public/sitemap.xml` keeps its URLs and references `https://metfix.org/sitemap-daily-fix.xml`, which the Worker serves.
- Until a BSI published-dates read is confirmed, `/sitemap-daily-fix.xml` lists only `https://metfix.org/the-daily-fix` (Lead decision).
- No fixed date range is used (MetFix CEO). Later, the dated entries come only from real published dates up to today in Etc/GMT-2, tab-less, with `lastmod`. BSI Lead owns any dates route. This PR does not build it.
- Never list `?tab=` URLs or future days. Edge-cache the sitemap for one day.

## 9. Acceptance (QA)
- `curl -I https://metfix.org/the-daily-fix/261004` returns 200. The GET body has title `The Daily Fix - 261004`, canonical `…/the-daily-fix/261004`, og:image set to the belly photo, and `df-initial` present.
- `HEAD /the-daily-fix/261004` returns the same status and headers as GET, with no body.
- A request to a `run_worker_first` path without `Accept: text/html` goes straight to `env.ASSETS`, with no BSI call.
- `?tab=brain` adds ` | Brain` and the brain photo. Canonical stays tab-less, and og:url keeps `?tab=brain`.
- A rest day with `?tab=body` has no ` | Body` suffix and a tab-less og:url, and the page shows the same no-content state.
- `?tab=belly` and `?tab=xyz` get a 301 to the tab-less URL, keeping other params. `?tab=BRAIN` gets a 301 to `?tab=brain`.
- Date-form and path-pillar 301s work as in section 4. The `normalizeDailyFixPath()` table test passes.
- `/260231`, `/261301`, and four-segment paths return 404 with noindex and no BSI call.
- A dated mismatch returns 404. Bare returns 200 with `{ymd}` from the response.
- Upstream failure and a 3-second timeout both return 503 with Retry-After, and the SPA still renders.
- Escaping: a pillar title containing `" < > &` and `&amp;#8211;` is decoded exactly once and attribute-escaped in every tag.
- Escaping: `df-initial` with `</script>` and U+2028 inside WordPress HTML stays inside the script, and the client parses it back to the same day.
- `/api/daily-fix` follows the section 5.4 contract for 200, 400, 404, 405, and 503.
- `X-API-Key` is never sent to any host but `brokenscience.org`.
- `/classes`, `/courses`, `/`, and assets do not run the Worker (request count does not rise).
- `www.metfix.org/x?y` gets a 301 to `metfix.org/x?y`.
- A second request for the same ISO in one data center makes no upstream fetch.
- A first client view makes zero `/api/daily-fix` calls for the shown day, then two prefetch calls.
- No API key anywhere in `dist/public`.
- CI stays green, including `wrangler deploy --dry-run`.

## 10. Cost notes (free plan)
- Free plan: 100,000 Worker requests a day, reset at 00:00 UTC. 10 ms CPU per request. 50 subrequests, and Cache API calls count.
- Static assets are free. What counts: each Daily Fix HTML navigation, each `/api/daily-fix` call, each sitemap fetch, and each 301. A typical visit is about 3 requests, so the free tier covers about 30,000 Daily Fix visits a day.
- Request count is a watch item. Add a Cloudflare usage notification at about 70,000 requests a day if it is free. Workers Paid at $5 a month is the fallback, and that is Ethan's decision.
- Over the limit, Daily Fix paths and `/api/daily-fix` fail until 00:00 UTC. The failure may be Cloudflare's own error page rather than a clean 429. This is unverified. The rest of the site keeps working.
- CPU budget: measure it. Record `wrangler tail` CPU time for a dated page, a bare page, and an API call on a real day before cutover. Each must stay under 10 ms.

## Out of scope
- `VITE_SANITY_API_READ_TOKEN` in the client bundle is a separate follow-up slice.
- Retiring `metfix-bff`, the post-cutover cleanup commit, and any BSI dates route.

## Open items
- Deploy path (GitHub Action or Workers Builds): Web Lead and Ethan.
- A BSI published-dates read for the sitemap: BSI Lead.


## Rev 2.1 amendments
**Section 6.1:** the shared mapper output carries an explicit `hasContent: boolean` per pillar. The head and the page read only this field and never work it out from the displayed text, because body falls back to the excerpt. Add a mapper unit test: a rest-day body gives `hasContent: false` and still renders "Rest day".

**Section 5.4:**
- An upstream 200 that fails the mapper is returned as a raw 200 and is not edge-cached. The client shows Not available.
- The client treats 400, 404, 405, and 503 as Not available, the same as today. Add one test per status.

**Section 8 (unblocked, per BSI Lead):** use the existing `GET /metfix/v1/daily-fix` with no `date`, sending X-API-Key.
- It returns published days only (status scheduled, date at or before today in +02:00), newest first, with `meta.total`.
- Send `limit=100`. Page by `offset` until `meta.total` is reached. That is about 7 subrequests today, well under the limit of 50.
- Keep only `date` from each item. Build tab-less `https://metfix.org/the-daily-fix/{YYMMDD}` with `lastmod`, plus the bare URL.
- Edge-cache the finished XML for one day under `https://metfix.org/__dfcache/sitemap`.
- If any page fails, return 503 and cache nothing. Never serve a partial sitemap.
- **Risk:** each item is a full day payload, so parsing about 700 days may exceed the 10 ms CPU limit on the free plan. Measure the sitemap miss with `wrangler tail` before cutover. If it runs over, the fallback is BSI's optional additive `GET /metfix/v1/daily-fix/dates` route, which is Web Lead's and Ethan's call.
- BSI PR 10 moves BSI day URLs to YY/MM/DD. That does not change metfix.org URLs, and the section 4 `/YY/MM/DD` 301 already covers links copied from BSI.
- Remove the sitemap from Open items.


## Rev 2.2 amendments (final)
**Deploy path (Lead decision; this replaces the section 2 deploy bullet and the open item):**
- Deploys use Cloudflare Workers Builds, Cloudflare's Git integration, connected to `Break-Even-Productions/metfixhome`.
- Production deploys from `main`. Non-main branches get preview URLs.
- No Cloudflare API token goes into GitHub secrets.
- GitHub Actions runs CI only: `npm ci --legacy-peer-deps`, vitest, the liquidglass chunk assert, the build, and `wrangler deploy --dry-run`.
- The Pages workflow is removed in the post-cutover commit. Done in PR #7 (2026-10-15).

**Ethan's checklist (dashboard steps, in order):**
1. In Workers Builds, connect `Break-Even-Productions/metfixhome`. Worker name `metfixhome`, production branch `main`, build command `npm ci --legacy-peer-deps && npm run build:cf`, deploy command `npx wrangler deploy`. Assets come from `./dist/public`, which `wrangler.jsonc` sets.
2. Add the secret `DAILY_FIX_API_KEY` on the Worker, in the dashboard or with `wrangler secret put DAILY_FIX_API_KEY`.
3. Check the workers.dev or preview URL against section 9.
4. Add the custom domain `metfix.org` to the Worker.
5. Add a Single Redirect rule that sends `www.metfix.org/*` to `https://metfix.org${path}${search}` with a 301 (path already starts with `/`; no double slash).
6. Add a usage notification for Workers requests at about 70,000 a day, if the free plan allows it.
7. Disable GitHub Pages, then land the post-cutover cleanup commit. Done in PR #7 (2026-10-15).

**Open items:** none. The sitemap CPU fallback stays as written in rev 2.1.
