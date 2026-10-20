# CQ pin check 14 (delta glance): PR2 QA list r1.23, spec 1.6.4 unchanged
2026-10-20, about 2:50 PM PT. CQ, read-only. No repo changed, no messages sent.

## Verdict: OK. 0 blocking, 3 non-blocking.

## Checks
- **List r1.23:** md5 `c02acb4675f0a98f1b4af82c8237148c`. **Matches.**
- **Backup r1.22:** `metfix-pr2-comments-login-tests.r1.22.md` = `6251553a…`. It's byte-identical to the `.r1.22-draft.md` copy.
- **Pin and sign-off:**
  - l.5 pins spec 1.6.4 `aef149a19d6f8b067666b363fb313822` exactly once; the spec is unchanged.
  - l.6 is QA's sign-off for rev 1.23, naming that md5.
  - The title says rev 1.23.
- **My recount:**
  - `gate-ids` **270**, `box-ids` **12**, `post-deploy-ids` **14**. Each block has one fence and no duplicates.
  - §M has **275** rows, with no duplicates.
  - These equal the header.
- **Orphan check: 0.** Every ID in a §M red set exists in a block.
- **Delta vs r1.22:**
  - Gate: +AU17.14 only.
  - Mutations: +M-RA4, M-RA5, M-RA6, M-SU1 only. None removed.
  - Rows edited: the header, sign-off and changelog, plus AU26.3, AU26.7, AU26.10, AU26.11 and CW13.1 (Retry-After cases).
  - Red sets changed: M-RA1, M-RA2, M-WL6, M-CW18, M103, M104, M105.
  - **Nothing else changed.**

### Retry-After ruling (any all-digit value → clamp 1..600)
| Boundary | Where | Expected | OK |
|---|---|---|---|
| `0`, `000` | AU26.10, AU26.11, AU26.3, CW13.1 | 1 (was 60) | ✓ |
| `1` | AU26.10 | 1 | ✓ |
| `600` / `601` | AU26.10, AU26.11, CW13.1 | 600 / 600 | ✓ |
| `99999`, `999999`, `1000000` | AU26.10, AU26.11, CW13.1 | 600 | ✓ |
| 30-digit (> MAX_SAFE_INTEGER), 400-digit (`Number` → `Infinity`) | AU26.10, AU26.11 | 600 | ✓ |
| Leading zeros `017` | AU26.11 | 17 | ✓ |
| Non-digits: `1e30`, `+17`, `0x11`, `1.5`, `17abc`, `-5`, `""`, missing | AU26.10, AU26.11 | 60 | ✓ |
| HTTP-date | AU26.10, AU26.11, CW13.1 | 60 | ✓ |
| Output grammar | AU26.10 | `^[1-9][0-9]*$`, ≤600 | ✓ |

**Mutants:**
- **M-RA4** (overflow → 60) red {AU26.3, AU26.7, AU26.10, AU26.11, CW13.1}.
- **M-RA5** (return type widened to `number`) red {AU26.11}, via the tsc `.test-d.ts`.
- **M-RA6** (no lower clamp) red {AU26.3, AU26.10, AU26.11, CW13.1}.

All are killed by rows that assert the exact value.

**Safe parsing.** The 400-digit row forces correct output whatever the implementation: `Number`/`Math.min` gives `Infinity` → 600, which is correct, and `parseInt` gives 600. `BigInt` isn't needed. See N1 for cost.

### AU17.14 + M-SU1
- **Setup:** a DO with real storage, R8c pre-filled to 24, and 15 failing signups (score, action, `success:false`; distinct IPs).
- **Asserts:** each gets 403 `try_again` with 0 BSI calls; the R8c count reads 24 before and after; **0 `idFromName("login:global")` calls**. Then one login takes slot 25 and the next gets 429.
- **Kill:** M-SU1 (a failed signup takes a slot) is killed exactly. This closes pin check 13's N1.

### Red-set corrections
Every changed set is a **superset** of its r1.22 set. No ID was lost, so each mutant stays killed by its original rows, and none is weakened.
- **M-RA1:** {AU26.3, AU26.10} → +AU26.7, AU26.11.
- **M-RA2:** {CW13.1} → +AU26.11.
- **M-WL6:** +AU26.11.
- **M-CW18:** +AU26.11.
- **M103:** {AU17.8, AU17.11} → +AU17.9, AU17.14, AU26.5, AU26.6.
- **M104:** → +AU17.9, AU17.14, AU26.6.
- **M105:** {AU17.11} → +AU17.14, AU26.5, AU26.6.

QA marks these as reasoned, to be verified in round 1. The R-mutation rule requires exact sets, so the round-1 run must confirm the additions really go red. If any doesn't, the set shrinks back, never below the r1.22 set.

## Findings
1. **N1 (non-blocking): parsing cost on huge values is unbounded in the spec.** Correctness is pinned, but nothing stops the implementation from running `Number()` or a regex over a multi-kilobyte header. Workers caps header size, so this is low risk.
   - **Suggestion:** `if (!/^[0-9]+$/.test(v)) return 60; if (v.length > 3) return 600; return clamp(Number(v))`. This avoids any big-number path.
   - **Optional row:** a ~8 KB digit string → 600 in under 5 ms.
2. **N2 (non-blocking): the list now contradicts the spec text, not just exceeds it.** Spec 1.6.4 §0s.13 (5) still says `0` and "over-long digits" → 60. The list says 1 and 600 under Web Lead's ruling. CK-P1 can't see this.
   - **Fix:** Spec cuts a wording-only 1.6.5 adopting the ruling, then QA re-pins.
   - **Until then:** the handoff must cite the ruling and say the list governs.
3. **N3 (non-blocking): the type test proves "not plain `number`", not the range.** With a brand, the `@ts-expect-error` lines for `0` and `601` pass because *every* literal is rejected, so the type doesn't encode 1..600. The runtime rows carry the range, which is fine.
   - **Placement:** make sure the `.test-d.ts` sits where CI's `check:worker` include covers it. Root `npm run check` isn't in CI, and its tsconfig excludes `worker/`. AU26.11's vacuity line says the step must list the file, so check that in round 1.

## Tooling note
- **N1:** a **test** (timed huge-input row), or a **lint** rule banning `Number(`/`parseInt(` outside `parseRetryAfter`.
- **N2:** **process.** A spec-vs-list text diff isn't automatable with CK-P1; it's a handoff item.
- **N3:** **CI.** The `.test-d.ts` must be inside a tsconfig that CI checks. The deferred follow-up (`tsconfig.node.json` plus `noUnusedLocals` and lint) is the home for it.
- **Already covered:** the type mutation (M-RA5), the overflow and lower-bound mutations (M-RA4, M-RA6), and the signup slot mutation (M-SU1).
