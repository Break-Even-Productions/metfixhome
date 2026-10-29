# Advisory targeted mutants (QA r1.3) — gating 0

Run each alone against the named red set; revert after. Not CI gates.

| ID | Patch | Red set |
|---|---|---|
| LM2 | Re-introduce `isFreeOpen` hide filter on search results | SC-T3, CQ-T2 |
| LM3 | Count line always plural (`resources`) | SS9, TC-T2 |
| LM4 | Live Streams maps to `videos` instead of `webinars` | SS5, TC-T2 |
| LM17 | Second effect calls `fetchLibrarySearch` directly on tab change | SS17, TC-T1b, CQ-T1 |
| LM23 | Locked card renders item link/media (`href` / video / content) | SC-T7, SC-T3, TC-T3 |
| LM24 | Merge concatenates Sanity + API without dedupe | SS7, SN-T3 |
| LM25 | Merge puts API topics first, Sanity after | SS7, SN-T3, SS9 |
| LM26 | Handoff navigates without `query` (or untrimmed) | SS16, TC-T9 |
| LM27 | Both sources empty → hardcoded topic list | SN-T3, SN-T4, SN-T6 |
| LM28 | Selecting a tab resets the pill to All Types | SS8, SS18, TC-T2 |

Spec's core 5 = LM27, LM29 (catalogue), LM3, LM4, LM26.
