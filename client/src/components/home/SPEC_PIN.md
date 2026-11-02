# PR E build pin

- Acceptance: **rev1.0.12** (MD5 `022cd09bed09c4516c7aac2fa85fe65e`) — skip 1.0.11
- Errata precedence: **e4** (`9246c805c6f4aa7fabb31034dbb81043`) → e3 (`3114a262…`) → e2 (`f56bc7af…`) → e1 (`35e50ade…`) → spec
- e4: ER-13 `-u` only on playwright/vitest/jest segments (+ wrappers); ER-14 `/library/search` must render unshadowed else `/library`
- e3: ER-12 wrapper one-level expand + pnpm/yarn `--` forwarding on snapshot-update check
- e2: ER-9 vendor advisory = `navigator.webdriver` only; ER-10 full-command `-u` scan; ER-11 literal `/library/search`
- Order: **#22 → #20 → E** (staging-only until both land; no draft PR yet)
- Tokens: muted `#686158`; `--color-backdrop`; `--color-footer-band: #100e0c`
- LR-4: no overlay; Search `<a>` visible text; `SEARCH_HREF` = `/library` until literal unshadowed `/library/search`
- Footer: `siteFooterLinks.ts`; Home-only mount; terms `/terms-and-conditions/`
- App.tsx: target 0 route lines
