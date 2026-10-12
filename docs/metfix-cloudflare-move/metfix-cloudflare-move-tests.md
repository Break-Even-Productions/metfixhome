# MetFix Cloudflare move: final test list (spec rev 2.2)

**Spec check:** I read all of `/workspace/specs/metfix-cloudflare-move.md` (216 lines). The md5 is `2a17aa8529f7fb15cf5d8a498111fb43`, which matches. Section 9 is the acceptance base, and the Rev 2.1 and 2.2 amendments override earlier text. This is a plan only: no code or repo changes.

**Where the spec overrides your draft:**
- **400 body:** it is `{"error":"bad_date"}`, not `invalid_date`.
- **Cache-Control on stored entries:** the spec only says `s-maxage={ttl}`. It never mentions `public`.
- **Sitemap failure:** the response is 503 and nothing is cached.
- **Sitemap cache key:** it is `https://metfix.org/__dfcache/sitemap`.
- **Deploy:** it goes through Workers Builds. The CI build step is `build:cf`.
- **Retry-After:** the value is 300.

**One real defect to fix first (B3):** `scripts/assert-liquidglass-chunk.mjs` breaks once Vite `base` is `"/"`. I ran it in the PR #5 review. With base `/`, the entry src `/assets/x.js` resolves to the filesystem root and the script exits with "entry chunk not found". It only passed with `GITHUB_PAGES=true` (base `./`). The script has to strip the leading `/` before CI can go green.

Notation: `fetchMock` is the upstream fetch, `ASSETS` is `env.ASSETS.fetch`, and "cache" is `caches.default`. The frozen clock is 2026-10-12 12:00 Etc/GMT-2 unless a test says otherwise. `{ISO}` is the content date and `{ymd}` is its `yymmdd`.

---

## W: Worker vitest (mocked ASSETS, upstream fetch, cache, `ctx.waitUntil`, frozen clock)

**Routing and config**
- **W1.** `wrangler.jsonc`: `run_worker_first` deep-equals `["/the-daily-fix","/the-daily-fix/*","/api/*","/sitemap-daily-fix.xml"]`.
  - Also: `not_found_handling:"single-page-application"`, `binding:"ASSETS"`, `directory:"./dist/public"`, `main:"worker/index.ts"`.
  - Also: wrangler is pinned to an exact version ≥4.20.0, with no `^` or `~`.
- **W2.** GET `/the-daily-fix/261004` with `Accept: application/json` (and again with no Accept):
  - ASSETS called 1×, upstream 0×, cache.match 0×.
  - The response is ASSETS' response unchanged.
- **W3.** POST `/the-daily-fix/261004` with `Accept: text/html`: ASSETS 1×, upstream 0×.
- **W4.** A 301-form path with non-HTML Accept (`/the-daily-fix/2026-10-04`, `Accept: */*`): ASSETS 1×, no 301, upstream 0×. This follows §2 literally (see open question Q3).
- **W5.** `/api/daily-fix?date=2026-10-04` with `Accept: application/json`: handled by the worker, ASSETS 0×. Same for `/sitemap-daily-fix.xml` with `Accept: application/xml`.
- **W6.** GET `/__dfcache/2026-10-04` passed directly to the worker handler:
  - ASSETS 1×, upstream 0×, cache.match 0×.
  - The body does not equal the cached upstream JSON, even when the cache is pre-seeded for that key.
  - Also assert the path does not match `run_worker_first`.

**301s** (`Accept: text/html`, upstream 0×, `Location` exact, empty body)
- **W7.** `/the-daily-fix/26/10/04?x=1`, `/the-daily-fix/20261004?x=1`, and `/the-daily-fix/2026-10-04?x=1` each return 301 to `/the-daily-fix/261004?x=1`.
- **W8.** Path pillars:
  - `/the-daily-fix/261004/brain?x=1` → `/the-daily-fix/261004?x=1&tab=brain`. Fix the exact param order in the shared table; the spec doesn't define it.
  - `/the-daily-fix/261004/body` → `/the-daily-fix/261004?tab=body`.
  - `/the-daily-fix/261004/belly` → `/the-daily-fix/261004`.
- **W9.** Tab redirects:
  - `?tab=belly&x=1`, `?tab=xyz&x=1`, `?tab=&x=1`, and `?tab=body&tab=brain&x=1` → tab-less `?x=1`.
  - `?a=%2F&tab=BRAIN&b=c+d` → `?a=%2F&tab=brain&b=c+d`, with the other pairs kept byte for byte.
- **W10.** Single hop: for every 301 in W7–W9, feeding the `Location` back in gives a 200 path with no further 301.

**404s** (`Accept: text/html`)
- **W11.** `/the-daily-fix/260231`, `/the-daily-fix/261301`, `/the-daily-fix/26/10/04/x`, `/the-daily-fix/2026/1/04`, and `/the-daily-fix/19991004`:
  - 404, with the body built from ASSETS `index.html`.
  - `<meta name="robots" content="noindex">` present, no `<link rel=canonical>`, no `#df-initial`.
  - upstream 0×, cache 0×.

**Status rules** (shared status module; HTML route)
- **W12.** Dated 200 that maps, with `date === ISO`:
  - 200, full head, `df-initial` present.
  - upstream 1× to exactly `https://brokenscience.org/wp-json/metfix/v1/daily-fix?date=2026-10-04`.
- **W13.** Dated, upstream 404: 404, noindex generic head, no canonical, no `df-initial`, `cache.put` 0×.
- **W14.** Dated, upstream 200 but body `date` is `2026-10-03`: 404 noindex, `cache.put` 0× (see Q6).
- **W15.** Bare `/the-daily-fix`:
  - upstream 1× with `date=` today in Etc/GMT-2 (clock 2026-10-12T23:30Z, so request `date=2026-10-13`).
  - 200. Title `{ymd}` comes from the response `date`. Canonical is `https://metfix.org/the-daily-fix`.
- **W16.** Bare, upstream 200 that fails the mapper (and bare upstream 404): 200, generic head, no `df-initial`, `cache.put` 0×.
- **W17.** 503 cases, each:
  - Triggers: upstream 500, upstream 502, fetch throws, `AbortSignal.timeout(3000)` fires (fake timers; assert the signal is passed), `DAILY_FIX_API_KEY` unset.
  - Result: 503, `Retry-After: 300`, `Cache-Control: no-store`, body is `index.html` with a generic head, no `df-initial`, `cache.put` 0×.
  - The missing-key case makes 0 upstream calls.
- **W18.** Upstream response headers (`Set-Cookie`, `X-WP-Total`, `Server`, `Access-Control-*`) are absent from every HTML and API response.
- **W19.** HEAD for each of W12, W13, W15, W17, and W11: status and headers deep-equal the matching GET, and the body is empty.

**Key isolation**
- **W20.** `X-API-Key` goes only to `brokenscience.org`.
  - Spy on all fetch calls over every W case: each one carrying `X-API-Key` has host exactly `brokenscience.org`.
  - With the upstream base overridden to `https://evil.example/...` (or `brokenscience.org.evil.example`), the worker throws or returns 503 before fetching. fetch 0× and the key is never sent.
- **W21.** The key value never appears in any response body or header, across all W cases.

**HTMLRewriter head**
- **W22.** Dated 200: head tags appear in exactly this order:
  1. title
  2. description
  3. canonical
  4. `og:type=website`
  5. og:title
  6. og:description
  7. og:url
  8. og:image (+alt; width/height only for the fallback)
  9. `twitter:card=summary_large_image`
  10. twitter:title
  11. twitter:description
  12. twitter:image

  Site JSON-LD is unchanged and there is no CollectionPage.
- **W23.** Title: `The Daily Fix - 261004` in all three title tags. With `?tab=brain` and brain `hasContent:true`: `The Daily Fix - 261004 | Brain` ×3.
- **W24.** Rest day (`body.body` null, title "Rest", excerpt "Rest day") with `?tab=body`:
  - title has no ` | Body`.
  - og:url is `https://metfix.org/the-daily-fix/261004`.
  - image falls back to the belly photo.
- **W25.** Canonical is always `https://metfix.org/the-daily-fix/261004` (or the bare URL). og:url is canonical plus `?tab=brain` only when that tab is allowed and has content.
- **W26.** Description:
  - Exact form `The Daily Fix 261004: Belly - A. Body - B. Brain - C.`
  - A pillar with no title is left out.
  - No titles at all gives the generic description.
  - The same string goes into all 3 description tags.
- **W27.** Truncation:
  - Fixture of >155 code points with emoji and astral characters: take 154 code points, cut back to the last space, trim trailing `.,:;-` and spaces, append `…`.
  - Result length ≤155 code points, exact expected string.
  - Boundary fixtures at 155 (no cut) and 156 (cut).
- **W28.** Image:
  - Uses the active tab's `photo_url`, else the belly photo, else the logo with `width=1336` and `height=1336`.
  - An `http://` photo is emitted as `https://`.
  - No width or height on non-fallback images.
- **W29.** Escaping: a title `Tom "&" <b>Jerry</b> 's &amp;#8211; x` is stripped of tags, decoded exactly once (→ `&#8211;`, not `–`), then attribute-escaped. The exact expected string appears in every tag and there is no raw `<`.
- **W30.** `df-initial`:
  - Upstream body contains `</script>`, `<`, `>`, `&`, U+2028, and U+2029.
  - The script text contains none of those raw, and has `\u003c`, `\u003e`, `\u0026`, `\u2028`, and `\u2029`.
  - The page has exactly one `</script>` closing that tag.
  - `JSON.parse(text)` deep-equals the raw upstream JSON (not the mapped output).

**Cache**
- **W31.** A miss calls `cache.put` 1× through `ctx.waitUntil`:
  - The key request URL is `https://metfix.org/__dfcache/2026-10-04`, method GET.
  - The stored `Cache-Control` contains `s-maxage={ttl}`.
  - The stored response has no `Set-Cookie`.
- **W32.** A second same-ISO request (HTML, then HTML): upstream 0×.
- **W33.** HTML then `/api/daily-fix?date=` for the same ISO (and the reverse): upstream 1× total.
- **W34.** TTL boundaries (DFX = Etc/GMT-2):
  - Today at 23:58:00 DFX: `s-maxage=120`. Today at 12:00 DFX: `300` (capped).
  - Bare: the same cap.
  - today−1 at 12:00 DFX: `43200` (until midnight, no 300 cap).
  - today−7 at 12:00 DFX: `43200`.
  - today−8: `86400`.
  - Clock at 23:59:59 vs 00:00:00 DFX moves the today−7/today−8 boundary.
- **W35.** No `cache.put` for any of: 404, 5xx, timeout, thrown fetch, mismatch, unmappable 200 (HTML or API).
- **W36.** The HTML response itself is never put in the cache. Every `cache.put` key starts with `/__dfcache/`, and the HTML response has no `s-maxage`.
- **W37.** A cache hit with a mismatching date on the dated route (seeded) returns 404. This keeps W14 consistent when the bare route wrote that entry.

**`/api/daily-fix` (§5.4)**
- **W38.** GET `?date=2026-10-04&x=1`:
  - 200, body byte-equal to upstream.
  - `Content-Type: application/json; charset=utf-8`, `Cache-Control: public, max-age=60`, `X-Content-Type-Options: nosniff`.
  - No `Access-Control-*` headers.
- **W39.** HEAD: same status and headers, empty body.
- **W40.** POST, PUT, DELETE, OPTIONS, and PATCH: 405, `Allow: GET, HEAD`, upstream 0×.
- **W41.** Missing date, `date=2026-02-31`, `date=261004`, and `date=2026-13-01`: 400 `{"error":"bad_date"}`, upstream 0×.
- **W42.** Upstream 404: 404 `{"error":"not_found"}`, `Cache-Control: public, max-age=60`.
- **W43.** Upstream 5xx, timeout, throw, and missing key: 503 `{"error":"unavailable"}`, `Retry-After: 300`, `Cache-Control: no-store`, `cache.put` 0×.
- **W44.** Unmappable upstream 200: raw 200 body, `cache.put` 0×.

**Sitemap** (`/sitemap-daily-fix.xml`)
- **W45.** Paging: mock `meta.total=250`.
  - Upstream calls go to `/metfix/v1/daily-fix?limit=100&offset=0`, `offset=100`, and `offset=200`, each with `X-API-Key` and no `date` param.
  - Exactly 3 calls, stopping when the offset reaches total.
  - Also: `total=200` gives exactly 2 calls, and `total=0` gives 1.
- **W46.** Output:
  - 200 XML containing the bare URL plus one `https://metfix.org/the-daily-fix/{YYMMDD}` with `<lastmod>{ISO}</lastmod>` per item.
  - No `?tab=`. An item dated tomorrow (DFX) is excluded.
  - Only `date` is read from each item.
- **W47.** Page 2 returns 500 (or throws or times out): 503, `cache.put` 0×, the body contains no `<urlset>` entries.
- **W48.** Cache:
  - A success does `cache.put` under `https://metfix.org/__dfcache/sitemap` with `s-maxage=86400`.
  - The second request makes 0 upstream calls.
- **W49.** HEAD sitemap: same status and headers as GET, no body.

---

## S: shared module table tests

- **S1.** `normalizeDailyFixPath` exhaustive table. Each row is input path+query → `{serve: bare|dated ISO+tab}`, `{redirect: target}`, or `{notFound}`. Run each row with no query, with `?x=1`, and with an encoded byte query `?a=%2F&b=c+d`. Rows:
  - bare
  - dated
  - YY/MM/DD, YYYYMMDD, YYYY-MM-DD
  - path pillars ×3
  - leap day 280229 (serve) and 270229 (404)
  - 260231, 261301, 261000
  - 4+ segments, non-2-digit slash parts (`26/1/04`, `026/10/04`)
  - years 1999 and 2100 in 8-digit and hyphen forms
  - tab rules: belly, xyz, empty, repeated, array `tab[]=`, `BRAIN`, `Body`
  - unknown path pillar (Q4)
  - trailing slash (decide and pin)
- **S2.** Single hop: for every redirect row, `normalize(target)` is a serve result.
- **S3.** Import identity: the worker and the client modules import the very same function (`expect(workerNormalize).toBe(clientNormalize)`, via a re-export).
- **S4.** Mapper `hasContent`:
  - The rest-day fixture gives `body.hasContent === false`, and the mapped body text is "Rest day".
  - Belly gets `hasContent` from a recipe or body text, and brain from its article body.
  - The output has no `comment_counts`.
- **S5.** Mapper identity: the worker and the client use the same mapper export. Same raw JSON gives deep-equal `DailyFixDay` output.
- **S6.** Status module table, (route, upstream result) → (status, head kind):
  - dated: 200, 404, mismatch, unmappable
  - bare: 200, unusable
  - 5xx, timeout, throw, nokey

---

## C: client mounted vitest

- **C1.** `/the-daily-fix/250210?tab=brain`: Brain is shown, 1 GET. This is the migrated `data.test` case and the count is still exactly one.
- **C2.** `/the-daily-fix/250210#brain`:
  - The first committed render shows Brain. A render spy on the Belly content records 0 renders before the Brain commit.
  - The URL becomes `?tab=brain` with no hash, via replace (history length unchanged).
  - 1 GET for the ISO.
- **C3.** `#belly`: no param and no hash. `#bogus` and `?tab=xyz` (client-side) fall back to Belly and drop the param.
- **C4.** A tab click writes `?tab=body` with replace. No reload, and the fetch count is unchanged.
- **C5.** `df-initial` present (dated, ISO equal to the shown day):
  - Shown day: 0 `/api` calls, and the content renders from the raw JSON through the shared mapper.
  - Prefetch follows Q1.
  - The tag is read 1× (spy).
  - In-app Next/Prev causes no re-seed, and the other days load via `/api`.
- **C6.** `df-initial` present on the bare route: 0 calls for today, then exactly 2 prefetch calls (−1 and −2). This is §9 line 161.
- **C7.** No `df-initial`: the dated route makes 1 `/api` call (and the bare route keeps its existing counts).
- **C8.** `/api` returns 400, 404, 405, or 503: one mounted test each, rendering Not available.
- **C9.** An unmappable 200 renders Not available.
- **C10.** Rest day with `?tab=body`: the page shows "Rest day" (`hasContent:false` state), matching W24.
- **C11.** The migrated `#`→`?tab=` tests in §7 exist and are not weakened:
  - `model.test`: canonical YYMMDD, rewrites, path pillar wins, drops bad pillar.
  - `page.mount`: tests 6, 12, and C6.
  - `document-base` passes against base `"/"`.
  - Diff these against the old assertions.
- **C12.** `dailyFixPath` and `dailyFixHref` emit `?tab=`. `canonicalHash` is replaced by a `tab` field.

---

## B: build and CI

- **B1.** `vite.config` base is `"/"` for `build:cf`. `build:cf` is `vite build` (identical to `build:pages`).
- **B2.** After the build, `rg -n "DAILY_FIX_API_KEY|X-API-Key|<test key value>" dist/public` returns 0 hits.
- **B3.** `assert:liquidglass-chunk` passes with base `"/"`. This needs the leading-slash fix above.
- **B4.** CI workflow steps, in order:
  1. `npm ci --legacy-peer-deps`
  2. vitest
  3. build (`build:cf`)
  4. liquidglass assert
  5. `wrangler deploy --dry-run`

  The run is green.
- **B5.** The Actions workflows contain no `wrangler deploy` (except `--dry-run`), no `CLOUDFLARE_API_TOKEN`, and no `cloudflare/wrangler-action` deploy. The Pages workflow is still present until the post-cutover commit.
- **B6.** `worker/tsconfig.json` has Workers types and no DOM. The client tsconfig has no Workers types. `tsc --noEmit` passes for both.
- **B7.** `client/public/sitemap.xml` still has its 6 URLs and references `https://metfix.org/sitemap-daily-fix.xml`.
- **B8.** No Daily Fix rule in `_redirects`.

---

## L: live (after deploy; workers.dev first, Cache API checks on the custom domain only)

- **L1.** `curl -sI https://metfix.org/the-daily-fix/261004` returns 200.
  - `curl -s` the same URL: title `The Daily Fix - 261004`, canonical `…/the-daily-fix/261004`, og:image is the belly photo, `df-initial` present.
- **L2.** `curl -sI -X HEAD` gives the same status and headers as GET.
- **L3.** `curl -s "...261004?tab=brain"`: title has ` | Brain`, og:image is the brain photo, canonical is tab-less, og:url has `?tab=brain`.
- **L4.** Rest-day `?tab=body`: no suffix, tab-less og:url.
- **L5.** `-sI` checks:
  - `?tab=belly&x=1` and `?tab=xyz&x=1` → 301 to the tab-less URL with `?x=1`.
  - `?tab=BRAIN` → `?tab=brain`.
  - Date forms and pillars give a 301, then a single hop to 200.
- **L6.** `/the-daily-fix/260231`, `/261301`, and a 4-segment path: 404. A GET shows noindex.
- **L7.** `curl -sI https://www.metfix.org/x?y=1` → 301 `Location: https://metfix.org/x?y=1`. Check for a double slash (see Q9).
- **L8.** `/api/daily-fix`:
  - 200, 400 (`bad_date`), 404, and 405 (with `curl -X POST`) per §5.4 headers.
  - 503 is not forced live; it is covered by W43.
- **L9.** `curl -s https://metfix.org/__dfcache/2026-10-04`:
  - Must not contain the BSI JSON (no `"belly"` or `"brain"` keys).
  - Expect the SPA `index.html` with 200 (SPA fallback), or a 404.
- **L10.** Workers analytics: request count is flat while hitting `/`, `/classes`, `/courses`, and `/assets/*`.
- **L11.** `wrangler tail`: CPU <10 ms for a dated page, a bare page, an API call, and a sitemap miss, recorded before cutover. A sitemap over budget triggers the `/dates` fallback decision.
- **L12.** Two requests for the same ISO from one data center: the second makes no upstream fetch. Check via `wrangler tail` subrequest count, or BSI-side logs.
- **L13.** `curl -s /sitemap-daily-fix.xml` is valid XML with tab-less, non-future URLs. `/sitemap.xml` references it.

---

## Contradictions and open questions in rev 2.2

**Resolved by the spec text**
- **Retry-After:** `Retry-After: 300` (§5.2 and §5.4).
- **400 body:** `{"error":"bad_date"}`. Your draft's `invalid_date` is wrong.
- **Sitemap failure:** "If any page fails, return 503 and cache nothing" (Rev 2.1). The response body is unspecified; the test only asserts no `<url>` entries.
- **Sitemap source:** §8's "lists only the bare URL" is superseded by Rev 2.1, which builds it from the BSI list route.
- **Deploy:** "Deploys use Cloudflare Workers Builds… GitHub Actions runs CI only" (Rev 2.2).
- **`hasContent`:** "The head and the page read only this field" (Rev 2.1).
- **Unmappable 200 on `/api`:** "returned as a raw 200 and is not edge-cached" (Rev 2.1).

**Still open (recommended answer in brackets)**
- **Q1. Dated prefetch vs the old one-GET lock.** §1 says "Prefetch of −1 and −2 stays". §9 says "zero `/api/daily-fix` calls for the shown day, then two prefetch calls". Meanwhile §7 keeps the dated `?tab=brain` "exactly one GET" test. [Apply "then two prefetch" to bare only; dated keeps 0 calls with `df-initial` and 1 without.]
- **Q2. Bare cache key on closer-day.** The key is the requested ISO (today DFX), but BSI may return another date. [Key on the request ISO. A dated hit with a date mismatch returns 404 (W37).]
- **Q3. Redirects for non-HTML Accept.** Read literally, §2 sends non-HTML Accept to ASSETS, so there's no 301 and no 404. [Accept, as in W4.] The §2 sentence is also ambiguous: "not a GET or HEAD request with Accept including text/html". [Read it as (method ∉ {GET, HEAD}) OR (Accept lacks text/html).]
- **Q4. Unknown path pillar** (`/the-daily-fix/261004/foo`) isn't specified. [404.] Trailing slash also isn't specified.
- **Q5. noindex on bare-unusable and 503.** The spec says "generic head" there and puts noindex only on 404. Whether those pages get a canonical or `og:url` is also unspecified. [No noindex, no canonical.]
- **Q6. Dated mismatch caching.** §5.3 caches "200s that map", and a mismatched 200 does map. [Don't cache it (W14). If the spec intends otherwise, W37 covers it.]
- **Q7. Cache-Control on HTML 200/404 isn't specified**, and §5.3 says only `s-maxage`, without `public`. [Use `s-maxage` only for stored entries. HTML gets no `s-maxage` (W36).]
- **Q8. Sitemap details.** `lastmod` source, Content-Type, and 503 `Retry-After` aren't specified. [`lastmod` = item date; `application/xml`; `Retry-After: 300`.] §8 also says to filter future days, but the BSI list already returns ≤ today; keep the filter test (W46).
- **Q9. www redirect target.** §2 says `https://metfix.org${path}`, but Rev 2.2 says `https://metfix.org/${path}`, which risks a double slash. Verify with L7.
- **Q10. Param order when a path pillar adds `?tab=` to an existing query** isn't specified. [Append `tab` last.]
- **Q11. The liquidglass assert script breaks with base `/`.** This isn't an open spec question but a defect that blocks CI (B3).
