# CQ pin check 13 (final, delta): PR2 spec 1.6.4 + QA list r1.22
2026-10-20, about 2:50 PM PT. CQ, read-only. No repo changed, no messages sent.

## Verdict: CONFIRMED. 0 blocking, 4 non-blocking. All 11 combined items from pin check 12 and the 1.6.2 delta landed. PR2 can freeze at spec 1.6.4 `aef149a1…` with list r1.22 `6251553a…`. The handoff must quote the list's counts: 269 gate / 12 box / 14 post-deploy / 271 mutations.

## Inputs
- **Spec 1.6.4:** md5 `aef149a19d6f8b067666b363fb313822`. **Matches.** The 1.6.3 intermediate is `2d15e1f5…`.
- **List r1.22** (`metfix-pr2-comments-login-tests.md`): md5 `6251553af01c93f06e80fe16d6d98634`. **Matches.** The r1.21 base is `cc066d8b…`.
- **One-way pin holds.** l.5 pins `rev 1.6.4, md5 aef149a1…313822` exactly once. The spec contains no `6251553a`.
- **QA sign-off:** l.6 names the full md5.
- **My recount:**
  - `gate-ids` **269**, `box-ids` **12**, `post-deploy-ids` **14**. Each block has one fence and no duplicates.
  - §M has **271** rows, with no duplicates.
  - These equal the header.
- **Orphan check:** every ID in every §M red set exists in a block. **0 orphans.**
- **r1.20 → r1.22:**
  - Gate: +AU7.6, +AU26.11 → 267 + 2 = 269 ✓.
  - Mutations: +M42c, M42e, M95b, M-WL14b/c/d, M-WL17, M-RA2, M-RA3 → 262 + 9 = 271 ✓. None removed.
  - Red-set changes: only M42 → {AU7.4, AU7.6} and M42d → {AU7.5, AU7.6}, which is stricter.
- **Gap explanation checks out.** 271 = 264 (spec) + 7 QA-only (M-CW28–33, M-CC1) − 2 (M137/M138, still counted by the spec) − 2 (the spec's M42c/M42e double count) + 4 QA-only (M-RA1, M-SC1, M-RA2, M-RA3). Gate 269 = 264 + CC1 + CW12.3 + 1 (CK-W4 was only an alias in the list) + AU26.10 + AU26.11. Both reconcile.

## The 11 combined items
| # | Item | Landed? | Evidence |
|---|---|---|---|
| 1 | B: AU7.6 restored, non-rotating | **Yes** | Spec §0s.13 AU7.6, plus list l.271: real DO, two isolates, stale KV; variants N (same refresh token, required), N0 (none) and R; each exactly 1 BSI-C3 call. M42c and M42e are back; M42 and M42d regain AU7.6. |
| 2 | B: R8c reason, stale BSI-C1 text | **Yes** | R8c is now "metfix.org's own site-wide breaker, far below BSI-C10's 600/min". BSI-C1 asks are struck at the R8 block, l.620/625, the residuals, the §5b BSI-C1 entry and A-T10. §0r.1 now reads BSI-C10. The BSI-C1 route cite is marked historical. |
| 3 | B: token and password not logged, plus a mutation | **Yes** | AU20.1 extended: every §0s.4 outcome, BSI error bodies echo `TOK`/`PW`, and it checks raw, base64, base64url, URL-encoded and JSON-escaped forms; the `bsi_client_not_allowed` line has no `client_id` or key. M-WL17 → {AU20.1}. |
| 4 | Retry-After bound and shared parser | **Yes** | `parseRetryAfter` (`^[0-9]+$`, ≥1, clamp 600, else 60). AU26.11 has a one-definition `rg` and a spy on every 429 branch for login and the four comment routes. CW13.1 has the clamp table. M-RA2 and M-RA3 cover it. |
| 5 | AU26.8 runtime / fetch injection | **Yes** | `upstream.ts` injects `fetch` and the base URL; `globalThis.fetch` sees 0 BSI-host requests. M-WL14b (`globalThis`), c (alias) and d (`new Request`) are added. |
| 6 | A-T41 cites the replacement for PKCE | **Yes** | It names the API-key-gated token proxy and BSI-C8's secret. BSI-C8 is now a PR2 merge dependency. |
| 7 | Per-username lockout residual | **Yes** | A-T43 is an accepted residual (CEO, relayed). Row 20 is updated. |
| 8 | Stale text (check order, BSI-C3 4 keys, §0r.1) | **Yes** | The order R8a → R8b → shape → R8c → BSI-C10 appears everywhere it's stated. BSI-C3's code body is exactly 4 keys, with the comma fixed. |
| 9 | AU5.z (e) non-rotating | **Yes** | The spec and list run case (e) in two variants, and both must put. M-CW33 was re-reasoned; red set unchanged {CW12.3, AU5.z}. CW12.2/12.3 hold. |
| 10 | X-Forwarded-For mutant on web-login | **Yes** | M95b → {AU2.1} (see N2). |
| 11 | A-T38r adopted | **Yes** | The spec text is byte-equal to QA's. |

Tooling lints (orphan-mutant CI, retired-ID doc lint, `no-restricted-globals: fetch`) are deferred by Web Lead to a follow-up PR. That's fine under Rule 6; see the tooling section.

**Nothing weakened.** No gate ID or mutation was removed since r1.20. Red sets only grew. AU26.3, AU26.7 and CW13.1 were tightened, and AU20.1 gained the web-login rows.

## Findings (one combined list)
1. **N1 (non-blocking): M137 was sound to drop, but its signup counterpart is untested.**
   - **Why dropping is sound.** M137 and M138 sabotage login siteverify. Login now makes 0 siteverify calls, and M-WL2 is the inverse guard. So "skip siteverify on login" is now required behaviour, not a bug.
   - **What's left untested.** R8c still says signup and comment take a slot only **after** Worker reCAPTCHA passes. AU18.1 asserts siteverify runs before the BSI call, but nothing asserts "a signup that fails reCAPTCHA takes 0 R8c slots".
   - **Fix (QA, next allowed cut or round 1):** add a mutant "signup takes the R8c slot before siteverify", and an AU17-style assertion that the R8c counter is unchanged after a failed signup reCAPTCHA.
2. **N2 (non-blocking): M95b having one killer is not a weakness.** AU2.1 asserts the exact upstream header set and names `x-forwarded-for` explicitly, so a single direct killer is enough. QA is right that WT2 maps to W5.1 here, which only covers comment reads. **Fix:** Spec corrects M95b's red set to {AU2.1} at the next cut. The R-mutation run confirms it in round 1.
3. **N3 (non-blocking): the "over-long digits" bound is unstated.**
   - **Where it shows up.** The spec says over-long digits → 60. AU26.11 asserts `99999` → 600 and a 30-digit value → 60, so somewhere between 5 and 30 digits the answer flips from "clamp" to "invalid", and neither doc says where. A natural implementation (`Number(v)`, then `Math.min`) returns 600 for 30 digits, and `parseInt` gives 600 too. So the test's 60 depends on an unwritten length rule.
   - **Fix (wording):** choose one rule: digit strings longer than N (e.g. 6) → 60, or every `^[0-9]+$` ≥1 → min(v, 600) with the 30-digit case changed to 600. QA's own changelog lists this as open.
4. **N4 (non-blocking): the spec's own mutation count (264) is off by the M42c/M42e double count** and still counts M137/M138. The list governs, by agreement. **Fix:** Spec states 262 by named delta (or "list governs") at the next cut. The handoff quotes 269/271.

## What a lint rule, type, test or CI check could catch
- **N1:** **test/mutation** (a signup R8c-slot-order case).
- **N2:** **CI** (the round-1 R-mutation run proves the exact red set).
- **N3:** **test**. AU26.11 already pins both ends. A boundary row (6 and 7 digits) would force the rule to be written down. A **type** helps too: one exported `parseRetryAfter(v: string | null): RetrySeconds` (branded 1..600).
- **N4:** none. CK-P1 doesn't compare against the spec, by design; it's a handoff item.
- **Deferred follow-up PR (Web Lead ruling):**
  - an orphan-mutant CI self-check, which would have caught the 1.6.2 AU7.6 drop at once;
  - a retired-dependency-ID doc lint (`BSI-C1`, `BSI-C7` outside struck/history lines);
  - `no-restricted-globals: ["fetch"]` in `worker/**`, with an override for `worker/upstream.ts` (backs up AU26.8 and M-WL14b–d);
  - `noUnusedLocals` and a lint config, carried from the #10 review.
