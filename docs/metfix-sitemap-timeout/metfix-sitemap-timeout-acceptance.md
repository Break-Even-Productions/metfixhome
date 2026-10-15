# metfix.org: /sitemap-daily-fix.xml timeout and stale cache, acceptance spec (rev 1.1)

- Changelog: rev 1.1 (2026-10-15) adds the required PR-body risk note (§7). Rev 1.0 (`44cb55c0`) backed up at `metfix-sitemap-timeout-acceptance.rev1.0.md`.

- Owner: MetFix Web Spec. Consumer: MetFix Web Lead, Web QA Tests, Web Code Quality. One PR.
- Read from `Break-Even-Productions/metfixhome` `main` at head **`9f7129d72c81cbb3dd70e62becf3692be1301e02`** (2026-10-15). No repo changes.
- Problem: `/sitemap-daily-fix.xml` returns 503. 613 days at 100 per page is 7 BSI list calls, and each takes 3.7-4.3 s against a 3 s per-page timeout.

## 1. Current code (evidence)
- `worker/index.ts:416-511` `handleSitemap`: one `cache.match(sitemapCacheKeyRequest())` (`https://metfix.org/__dfcache/sitemap`). On a miss it fetches pages **sequentially** with `fetchDailyFixListPage(offset, env, fetchImpl, { baseUrl })`, so **no `timeoutMs`** and the default 3000 ms applies. It stops at `SITEMAP_MAX_SUBREQUESTS - 1` (40, `worker/upstream.ts`). Any failed page returns `sitemapUnavailable` (503, `Retry-After: 300`, `no-store`). On success it puts with `Cache-Control: s-maxage=86400` via `ctx.waitUntil`.
- `worker/upstream.ts` `fetchDailyFixListPage(..., opts?: { baseUrl?; timeoutMs? })` already accepts `timeoutMs` (`AbortSignal.timeout(opts?.timeoutMs ?? 3000)`). `fetchDailyFixDay` hard-codes `AbortSignal.timeout(3000)`. The parameter needed exists; the sitemap just doesn't pass it.
- `handleArchive` (`/api/daily-fix/archive`) already uses `ARCHIVE_PAGE_TIMEOUT_MS = 20_000`, fetches page 0 and then the rest **in parallel**, and caches until `secondsUntilNextDfxMidnight()` (`shared/daily-fix/cacheTtl.ts`, next 00:00 Etc/GMT-2).
- Each list row is run through `mapDailyFixDay` (full day payload) even though the sitemap only needs `date` and `status`.

## 2. Cloudflare limits (docs, checked 2026-10-15)
- CPU: 10 ms per HTTP request on Workers Free. "Waiting on network requests … does not count toward CPU time." (developers.cloudflare.com/workers/platform/limits/#cpu-time). JSON parsing, row mapping and XML building do count.
- Wall time: "There is no hard limit on duration for HTTP-triggered Workers" while the client stays connected (limits/#duration).
- `ctx.waitUntil`: "can extend execution for up to 30 seconds after the response is sent or the client disconnects", shared across all `waitUntil` calls in the request (developers.cloudflare.com/workers/runtime-apis/context/#waituntil).
- Subrequests: 50 per invocation on Free. Cache API `put`/`match`/`delete` "shares the same quota as subrequests" (limits/#subrequests, limits/#cache-api-limits).

## 3. Decisions
- S1. **Per-page timeout for the sitemap only: `SITEMAP_PAGE_TIMEOUT_MS = 8000`**, passed as `{ baseUrl, timeoutMs: SITEMAP_PAGE_TIMEOUT_MS }`. Why 8 s: the observed worst case is 4.3 s, so 8 s gives about 1.9× headroom without letting one stuck page eat the whole background budget. 20 s, the archive value, would leave no room for a second round inside `waitUntil`'s 30 s. `fetchDailyFixDay` (3000) and the `fetchDailyFixListPage` default (3000) stay unchanged. Archive stays at 20 000.
- S2. **Parallel after page 0, same shape as archive.** Page 0 (sequential) gives `meta.total`, then pages `100..total` are fetched with `Promise.all`. Typical wall time is about 2 × 4.3 ≈ 9 s, worst about 16 s (2 × 8). Sequential would be about 30 s typical and up to 56 s worst, past `waitUntil`'s 30 s for background rebuilds. Key budget: one build is 7 calls (8 at 701+ days). BSI's limit is 60/min per key per route, and the Worker shares the key with Daily Fix and archive. A rebuild happens at most once per DFX day per data center (S5), plus the S6 single-flight. Even a simultaneous cold sitemap and archive is 14 list calls, well inside 60/min. The existing cap (`SITEMAP_MAX_SUBREQUESTS = 40`, counting the match and reserving the put) stays, and limits pages per build to 38.
- S3. **Overall budget: 20 s** per build (`SITEMAP_BUILD_BUDGET_MS = 20_000`, checked with a deadline before starting the parallel round and passed as an outer abort). It's under `waitUntil`'s 30 s with 10 s margin. Over budget, the build fails; there is no partial result.
- S4. **No row mapping for the sitemap.** Add `opts.mapDays?: boolean` (default `true`) to `fetchDailyFixListPage`. The sitemap passes `false`, so rows keep `date` and `status` with `day: null`. This saves CPU on about 700 full-day payloads. Archive and other callers are unchanged.
- S5. **Cache with stale-ok.** The store copy keeps the same key `__dfcache/sitemap` with `Cache-Control: s-maxage=604800` (7 days retention) and a header `X-Sitemap-Fresh-Until: <ISO of next 00:00 Etc/GMT-2 at build time>`, from `secondsUntilNextDfxMidnight()`. That ties freshness to the DFX day, when a new date appears.
  - Hit, fresh: serve it, with no upstream call.
  - Hit, stale (now ≥ fresh-until): serve the stale body immediately and start a rebuild in `ctx.waitUntil` (S6). A successful rebuild overwrites the entry. A failed one leaves the stale entry in place, untouched.
  - Miss (cold, or after 7 days): build inline (awaited). Success: respond 200 and `waitUntil(put)`. Any failure (page error, timeout, cap, budget, nokey): **503**, `Retry-After: 300`, `Cache-Control: no-store`, and nothing is put. A partial set of pages is never written and never served.
  - Client-facing headers (fresh or stale): `Content-Type: application/xml`, `Cache-Control: public, max-age=3600`. `X-Sitemap-Fresh-Until` is stripped from the client response.
- S6. **Single-flight, per isolate.** A module-scope `let sitemapBuild: Promise<BuildResult> | null`. Concurrent stale hits and cold misses in one isolate share one build, and it resets on settle (success or failure). A cross-isolate or cross-data-center lock isn't feasible without a Durable Object or KV, which are out of scope. Duplicate builds across isolates are bounded by S2's budget math.
- S7. CPU check: after deploy, Web Lead reads `cpuTime` for a cold sitemap invocation in Workers Logs (limits doc: "CPU time and wall time appear in the invocation log"). It must be ≤ 8 ms. If it's over, see Q1.

## 4. QA test list (rule 2)
Use the existing `worker/index.test.ts` harness (`fetchImpl` stub, fake `cache`, `ctx.waitUntil` collector). Use fake timers for the delays.
- T1. **Slow upstream succeeds:** every list page resolves after 4.3 s with total 613. The sitemap returns 200 with 613 dated URLs plus the bare URL, makes exactly 7 upstream calls, and the `AbortSignal` passed to each has an 8000 ms timeout (assert via an injected timeout factory or by observing that a 7.9 s page succeeds and an 8.1 s page fails).
- T2. **Other routes still time out at 3 s:** a `/api/daily-fix?date=…` upstream and a `/the-daily-fix/<YYMMDD>` HTML upstream each delayed 3.1 s produce today's timeout outcome (503 per W17). `fetchDailyFixListPage` called without `timeoutMs` aborts at 3000 ms. Archive still uses 20 000.
- T3. **Cache hit makes no upstream call:** a fresh cached entry gives 200 with zero `fetchImpl` calls and no `put`.
- T4. **Stale served while rebuilding:** an entry with `X-Sitemap-Fresh-Until` in the past is returned immediately (body equals the stale body). Exactly one rebuild is registered via `waitUntil`, and after it resolves the cache holds the new body with a new fresh-until.
- T5. **Stale kept on failure:** same as T4, but the rebuild has one page returning 500 (and separately a timeout). The response is still the stale 200, the cache entry is unchanged (no `put`), and the next request again serves stale and retries.
- T6. **Partial never cached:** a cold miss where page 3 of 7 fails (500, timeout, thrown) gives 503, `Retry-After: 300`, `no-store`, with **zero `put`**. A cold miss that hits the 40 cap or the 20 s budget gives the same.
- T7. **503 never cached:** after T6, the next request makes upstream calls again; there is no cached 503.
- T8. **Single-flight:** two concurrent stale hits, and separately two concurrent cold misses, in one isolate cause one set of 7 upstream calls. Both callers get the same result.
- T9. **Parallel shape:** page 0 is called first, and pages 100-600 are all started before any of them resolves.
- T10. **No row mapping:** with `mapDailyFixDay` spied, the sitemap build makes zero calls. The archive build still maps rows.
- T11. **Headers:** the client response has `Content-Type: application/xml` and `Cache-Control: public, max-age=3600`, with no `X-Sitemap-Fresh-Until`. The stored response has `s-maxage=604800` and a fresh-until equal to the next 00:00 Etc/GMT-2 (fake clock at 23:59:30 Etc/GMT-2 → fresh-until is 30 s later). HEAD matches GET headers with no body (W49 kept).
- T12. **Existing tests:** W45, W46, the cap test, W49 and "reads `days`" pass. **W48 changes by design** from `s-maxage=86400` to the S5 store headers. QA confirms it fails on the old code and passes on the new.
- T13 (manual, post-deploy): `curl -s -o /dev/null -w '%{http_code} %{time_total}' https://metfix.org/sitemap-daily-fix.xml` returns 200 cold and under 1 s warm. The Workers Logs cold `cpuTime` is ≤ 8 ms (S7).

## 5. Threat note
- **Amplification:** an anonymous request can trigger up to 7 BSI calls only on a cold miss or a stale hit, at most about once per DFX day per data center (stale-ok plus single-flight). There's no query input and the key is fixed, so the cache can't be busted.
- **Key budget:** worst case about 14 list calls in a minute, shared with Daily Fix (60/min/key/route). A 429 counts as a page failure: stale is served, or 503 if cold. Nothing gets cached.
- **Correctness:** no partial sitemap is ever cached or served, and draft and future dates stay excluded (`isPublicListItem`, W46).
- **No new secrets or headers.** `X-API-Key` still goes only to `brokenscience.org` (`assertBsiHost`).

## 6. Open questions
- Q1 (Web Lead, only if S7 fails): if a cold build is over 8 ms CPU on Free, either move the sitemap build to a daily Cron Trigger (still 10 ms CPU on Free) or accept Workers Paid. Not expected after S4. The move doc says "The sitemap CPU fallback stays as written in rev 2.1"; that rev wasn't in the repo, so I couldn't check it.
- Q2 (Web Lead): the archive and the sitemap fetch the same 7 list pages separately. Should the sitemap be built from the cached archive? That's a later optimization and isn't specced here.

## 7. PR body (required text)
"Risk: the Workers Free plan allows 10 ms CPU per request. A cold sitemap build parses 7 BSI list pages and builds about 600 URLs. S4 removes row mapping to stay under the limit, and S7 checks `cpuTime` after deploy. Plan B if it doesn't fit: a daily Cron Trigger that builds the sitemap shortly after 00:00 Etc/GMT-2 and writes it to the cache. It is not built in this PR."
