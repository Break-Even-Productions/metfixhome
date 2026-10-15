# MetFix sitemap timeout and stale cache: QA test list for PR #8 (spec rev 1.1.1, FINAL)

**Spec check:** `/workspace/specs/metfix-sitemap-timeout-acceptance.md` is rev 1.1.1, md5 `e70f1a1c0dbe4bb5edbf8de5f4efc4c2`, a match. Diffed against rev 1.1 (`8a8acb3d`). The base is `main` @ `9f7129d7`. This is a plan only. The earlier lists (`tests.md` on 1.2, `tests.rev1.1.md` on 1.1) are unchanged.

**What 1.1.1 changes from 1.1** (gap IDs use the spec's G numbering, which differs from the 1.1 list's):
- **G1:** fresh-until is taken once at build **start** (S5).
- **G2:** a missing, empty or unparseable fresh-until is stale.
- **G3:** the format is `toISOString()`.
- **G4 and CQ8:** no test-only production exports, so `resetSitemapBuildForTests`, the `SharedDailyFix` namespace import and the `ARCHIVE_PAGE_TIMEOUT_MS` export are all removed.
- **G5:** a cap pre-check from page 0's `meta.total`. If more than 38 pages are needed, the build fails with no further call.
- **G6:** a 60 s backoff after a failed stale rebuild, which doesn't apply to cold misses.
- **G7:** boundary and budget tests.
- **CQ2:** a waiter time-box, using `Promise.race` against the build's remaining budget.
- **CQ5:** cold `cpuTime` recorded in the PR body before merge.
- **CQ7:** the S3 wording matches the per-page clamp `min(8000, remaining)`.
- **CQ9:** HEAD on a hit doesn't read the stored body.
- **Excluded:** CQ4.
- **Changed or new tests:** T2 and T10 (via S6), T4, T6, T8, T11, T12, T13, T19, T21 and T22.

**Web Lead S6–S9 applied:**
- **S6:** exactly `22:00:00.000Z` rolls to the next day.
- **S7:** no PR4 security headers. Pin only `Content-Type` and `Cache-Control`.
- **S8:** page 0 also respects the deadline. With an 8 s timeout and a deadline 20 s later, the two are behaviorally equal.
- **S9:** exactly 20 000 ms counts as a budget failure.

**Forbidden (review fail):** any test-only production export or hook, `?nocache`, `X-Test-*`, or a timeout-shortening env flag. **Allowed:** `vi.resetModules()` plus a dynamic `import()`, `vi.mock`, an injected timeout factory or the clock through the existing dependency parameter, and fake timers.

## Tests
- **T1 (S1).** Cold, 7 pages at 4.3 s: 200, the pinned `<loc>` count plus the bare URL, 7 calls, and an 8000 ms per-page timeout (factory or 7.9 s / 8.1 s).
- **T2 (S1, G4).** `/api/daily-fix` and `/the-daily-fix/<ymd>` at 3.1 s give 503. The list default aborts at 3000 ms. Archive's 20 000 is proved **by behavior** (19.9 s page succeeds, 20.1 s page fails) or a factory, **not** by importing an exported constant.
- **T3 (S5).** A fresh hit gives 200 with the stored body, 0 fetches, 0 puts and 0 `waitUntil`.
- **T4 (S5, G7).** A stale hit returns the stale body immediately with exactly 1 `waitUntil`, then 7 fetches and 1 put with a new body and a new fresh-until. **Boundary:** `now === fresh-until` to the ms is stale (1 rebuild). `fresh-until − 1 ms` is fresh (0 rebuilds).
- **T5 (S5).** A failed stale rebuild (500, 8.1 s timeout, thrown fetch, 429) gives the stale 200, with 0 puts and the entry byte-equal.
- **T6 (S5, G7).** Cold page-3 failure (500, timeout, thrown) or a missing key (0 fetches) gives 503 with `Retry-After: 300`, `no-store`, 0 puts and no `<url>`. **Budget case:** page 0 at 12.5 s and parallel pages at 8 s give 503 with 0 puts and no partial. The cap case is in T12.
- **T7.** After a cold failure, the next cold request fetches again. The backoff doesn't apply to cold misses (G6).
- **T8 (S6, G6).** 2 concurrent stale hits make 7 calls, and so do 2 concurrent cold misses, with the same results. **Backoff:** after a failed stale rebuild, a stale hit at +59 s serves stale with 0 calls and 0 rebuild `waitUntil`. A stale hit at +60 s starts exactly 1 rebuild.
- **T9 (S2).** Page 0 is first and alone. Offsets 100–600 all start before any resolves.
- **T10 (S4, G4).** Using `vi.mock` of `shared/daily-fix` (not a production namespace import), the sitemap build makes 0 `mapDailyFixDay` calls and the archive makes more than 0.
- **T11 (S5, G1, G3, S6).**
  - The client response has exactly `Content-Type: application/xml` and `Cache-Control: public, max-age=3600`, with no fresh-until.
  - The stored response has `s-maxage=604800` and a fresh-until matching `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`.
  - With the clock at 21:59:30Z, fresh-until is `22:00:00.000Z` (+30 s).
  - **Midnight crossing:** a build starting at 21:59:55Z and finishing at 22:00:05Z stores `…T22:00:00.000Z` (the start day's midnight), and the next request is stale and rebuilds.
  - Exactly `22:00:00.000Z` at start rolls to the next day (S6).
  - HEAD equals GET (W49).
- **T12 (G5).** W45, W46, W49 and "reads `days`" pass unedited. **The cap test changes by design:** total 10000 gives 503, 0 puts and **exactly 1** upstream call. **W48** stores `s-maxage=604800` plus fresh-until and the client gets `max-age=3600`. It must fail on `9f7129d7` and pass on the head. `rg "s-maxage=86400"` in the tests gives 0.
- **T13 (S7, CQ5).** **Before merge:** the PR body records cold `cpuTime` from Workers Logs on a preview or staging deploy, and it must be ≤ 8 ms. **After the prod deploy (manual):** curl gives 200 cold and under 1 s warm, and Ethan re-checks `cpuTime`.
- **T14 (S3, CQ7, S9).** Each parallel page's timeout equals `min(8000, deadline − now)`. At exactly 20 000 ms the build fails as budget. There's no partial result.
- **T16.** The stale response resolves with no timer advance.
- **T17.** `X-API-Key` goes only to `brokenscience.org`, and the key appears in no response or stored data.
- **T18.** `?x=1` on a fresh hit gives 0 fetches.
- **T19 (G2).** Entries with no fresh-until, `""` or `"garbage"` give 200 with the stored body and exactly 1 rebuild. Never a 503, and never a throw.
- **T20 (S6, G4; static).** `rg` over `worker` and `shared` (excluding tests) finds no `ForTests` symbol, no `import * as SharedDailyFix`, and no `export` of `ARCHIVE_PAGE_TIMEOUT_MS`. Tests reset state with `vi.resetModules()` plus a dynamic `import()`.
- **T21 (S6, CQ2, pool-workers).** Two overlapping requests in one isolate. The first request's build hangs past the budget, or its client disconnects. The second request resolves by the build's deadline: stale 200 when an entry exists, otherwise 503 with `Retry-After: 300` and `no-store`. It never hangs past the deadline. The code must race with `Promise.race`.
- **T22 (CQ9).** HEAD on a stale hit gives 200, the client headers and an empty body. With `text()` and `arrayBuffer()` spied on the stored Response, there are 0 calls. Exactly 1 rebuild is registered. (Same for HEAD on a fresh hit, with 0 body reads.)
- **T24 (§7).** The PR body carries the §7 risk text.
