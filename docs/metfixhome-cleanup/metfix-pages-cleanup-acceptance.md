# metfix.org: remove GitHub Pages leftovers, acceptance spec (rev 1.4.1)

- Changelog: rev 1.4.1 (2026-10-18, Web Lead) replaces only the provisional §6 "Manus removal (pending Ethan's order via CEO)" with the record of Ethan's order as relayed by MetFix CEO. Nothing else changes. Rev 1.4 (rebuilt, `d2933460`) backed up at `metfix-pages-cleanup-acceptance.rev1.4-rebuilt.md`.
- Changelog: rev 1.4 (Web Lead) cuts the copy committed on #7 at `46e43022` (md5 `03face13`), which had been edited in place under the rev 1.3 title, as a proper revision. Its 8 in-place edits for the Manus removal are kept unchanged: the 2026-10-16 changelog line, the rev 1.1 changelog line, F4, E2, the removed out-of-scope line, the "Must not change" line, A2 and §5. The record of Ethan's order goes in §6, which is provisional. Rev 1.3 (`119c0f51`) backed up at `metfix-pages-cleanup-acceptance.rev1.3.md`; the `03face13` copy backed up at `metfix-pages-cleanup-acceptance.pr7-46e43022.md`. (Rebuilt on 2026-10-18 after the box copy was lost; the original rev 1.4 md5 `5b90320f` is not recoverable, so this file's md5 differs.)
- Changelog: Ethan (2026-10-16) overrides the earlier line that kept the preview-runtime plugins. Those plugins, the debug collector, the storage proxy, their assets, and image URLs that only that proxy served are removed. Every other check in this document stays.
- Changelog: rev 1.3 (2026-10-16, Web Lead, for #7 head 962d27d0). Removes the `git ls-files CNAME` check from A5, and drops the requirement for the ci.yml "No Pages leftovers in dist" step from A1. Nothing else changes. Rev 1.2 (`7165abdf`) backed up at `metfix-pages-cleanup-acceptance.rev1.2.md`.
- Changelog: rev 1.2 (2026-10-15, Web Lead) changes only A5: the leftover-grep allowlist is `docs/`, `.github/workflows/ci.yml`, `worker/build.config.test.ts`, and deferred `client/src/const.ts`. Rev 1.1 (`2d6b656a`) backed up at `metfix-pages-cleanup-acceptance.rev1.1.md`.
- rev 1.1 (2026-10-15) adds Web Lead's answers: og:image/twitter:image move to metfix.org (E9, A9). Rev 1.0 (`2d414d40`) backed up at `metfix-pages-cleanup-acceptance.rev1.0.md`.

- Owner: MetFix Web Spec. Consumer: MetFix Web Lead, Web QA Tests, Web Code Quality. One PR.
- Read from `Break-Even-Productions/metfixhome` `main` at head **`9f7129d72c81cbb3dd70e62becf3692be1301e02`** (2026-10-15), read-only through the GitHub connector. No repo changes.
- Basis: the repo's own move doc, `docs/metfix-cloudflare-move/metfix-cloudflare-move.md` §3, says: "A separate post-cutover commit removes the root `CNAME`, `.github/workflows/deploy-pages.yml`, and the `cp index.html 404.html` step." Its Ethan checklist item 7 says to disable Pages and then land this cleanup. metfix.org is now live on the `metfixhome` Worker.

## 1. Findings (evidence at 9f7129d7)
| # | Path | Evidence | Pages-only? |
|---|---|---|---|
| F1 | `CNAME` | Contains `metfix.org`. Only GitHub Pages reads it. Not under `client/public`, so Vite never copies it to `dist/public`. | Yes |
| F2 | `.github/workflows/deploy-pages.yml` | "Deploy to GitHub Pages" on push to main: `npm run build:pages` with `GITHUB_PAGES: "true"`, then `cp dist/public/index.html dist/public/404.html` (the 404 copy step lives **here**, not in package.json or the Vite config), `upload-pages-artifact`, `deploy-pages`. No `peaceiris` or `gh-pages` branch action anywhere. | Yes |
| F3 | `package.json` `scripts.build:pages` | `"vite build"`, the same as `build:cf`. Only F2 calls it. `scripts/assert-liquidglass-chunk.mjs` mentions it in a comment and an error message. No `homepage` field. | Yes |
| F4 | `vite.config.ts:209-221` | `const isPagesBuild = process.env.GITHUB_PAGES === "true"`; when true it drops the preview-runtime plugins and sets `base: "./"` ("fixes mixed-content on GitHub Pages"). Only F2 sets `GITHUB_PAGES`. CI and Workers Builds (`npm run build:cf`, per the move doc checklist) leave it unset, so production used `base: "/"` with those plugins. Ethan later ordered those plugins removed. | The `isPagesBuild` branch is Pages-only |
| F5 | `worker/build.config.test.ts` B1 | Asserts the literal regex `base:\s*isPagesBuild\s*\?\s*"\.\/"\s*:\s*"\/"`, so it breaks when F4 changes. | Test tied to F4 |
| F6 | `client/index.html:6-11` | Comment "GitHub Pages copies index.html to 404.html…" above `<base href="/" />`. The `<base>` itself still sets the root for relative URLs, which is harmless and correct on the Worker. | Only the comment is |
| F7 | `client/src/document-base.test.ts` | `describe("GitHub Pages document base")`, helper `pagesAssetPath`. The assertions (base is `/`, assets resolve from root on nested paths) are still valid for the Worker. | Only the names are |
| F8 | `scripts/assert-liquidglass-chunk.mjs:6,22` | "Run after `npm run build:pages`", "run npm run build:pages first". | Text only |
| F9 | `docs/metfix-cloudflare-move/*.md` | Move spec §3 and checklist 7 describe this cleanup as pending; the tests doc mentions `build:pages` as identical to `build:cf`. | Historical docs |
| F10 | `.github/workflows/ci.yml` "Build static site" env `GITHUB_REPOSITORY` | Not read by `vite.config.ts` (only `GITHUB_PAGES` is read). Likely a Pages base-path leftover. | Probably; confirm by grep (A7) |
| F11 | `client/index.html:32,41` `og:image`/`twitter:image` = `https://metfixbybsi.github.io/metfixlanding/social-preview.jpg` | This is a **different** repo's Pages site, not this repo's. Turning off this repo's Pages doesn't affect it. `client/public/social-preview.jpg` exists here. | In scope as E9 (Web Lead) |

Worker check: `wrangler.jsonc` has `assets.not_found_handling: "single-page-application"` and `run_worker_first: ["/the-daily-fix", "/the-daily-fix/*", "/api/*", "/sitemap-daily-fix.xml"]`. In SPA mode the assets layer serves `index.html` for unmatched navigations, and `worker/index.ts` builds its own 404/503 HTML from `index.html` (`htmlNotFound`, `htmlServiceUnavailable`). **Nothing reads `404.html` or `CNAME`.** Neither is in today's `build:cf` output, because only the Pages workflow created `404.html`.

## 2. Changes (one PR)
Delete:
- D1. `CNAME`.
- D2. `.github/workflows/deploy-pages.yml` (removes the 404 copy step with it).

Edit:
- E1. `package.json`: remove `scripts.build:pages`. Keep `build:cf` unchanged (`"vite build"`). Workers Builds runs `npm run build:cf`.
- E2. `vite.config.ts`: remove `isPagesBuild`. Keep `base: "/"`. Plugin list is `asteriskGlass(), react(), tailwindcss(), jsxLocPlugin()` in that order. Drop the Pages comment. The preview-runtime, debug-collector, and storage-proxy plugins are removed (Ethan, 2026-10-16).
- E3. `worker/build.config.test.ts` B1: assert `base: "/"` literally (`/base:\s*"\/"/`) and assert `vite.config.ts` contains no `GITHUB_PAGES` and no `isPagesBuild`.
- E4. `client/index.html`: replace the comment above `<base href="/" />` with "Keeps relative URLs resolving from the site root on nested routes." Keep the `<base>` element as is.
- E5. `client/src/document-base.test.ts`: rename the describe to "Document base" and the helper to `assetPathFor`. Assertions unchanged.
- E6. `scripts/assert-liquidglass-chunk.mjs`: `build:pages` → `build:cf` in the comment and the error text.
- E7. `.github/workflows/ci.yml`: drop the `GITHUB_REPOSITORY` env line, only if A7's grep shows no other reader. Otherwise leave it and note why in the PR body.
- E9. `client/index.html:32,41`: set `og:image` and `twitter:image` content to `https://metfix.org/social-preview.jpg`. The file exists at `client/public/social-preview.jpg` at 9f7129d7. Vite copies `client/public/*` to `dist/public/`, and Workers static assets serve it at `/social-preview.jpg` (the path isn't in `run_worker_first`). Related tags (`og:image:width`/`height`/`alt`, if present) stay as they are. The Worker's Daily Fix head (`worker/head.ts`) sets its own image and is unchanged.
- E8. `docs/metfix-cloudflare-move/metfix-cloudflare-move.md` §3 and checklist item 7: add "Done in PR #<n> (2026-10-xx)". Don't rewrite history. In `metfix-cloudflare-move-tests.md`, add a note that `build:pages` is removed.

Must not change: `wrangler.jsonc`, `worker/**` runtime code, `build:cf`, CI's typecheck, test, build, B2 key-grep, liquidglass-assert, `test:workers` and `wrangler deploy --dry-run` steps, `client/public/**` except deleting the debug-collector directory, Sanity config.

PR body (required text): "After merge, Ethan turns off GitHub Pages in the repo settings (Settings → Pages → Source: None) as a manual step. Workers Builds is unaffected. Rollback via Pages is no longer available after this PR; rollback is a Worker version rollback in the Cloudflare dashboard."

## 3. QA test list (rule 2)
- A1. `npm run build:cf` succeeds. `dist/public` has no `CNAME` and no `404.html`. A ci.yml step for this is no longer required.
- A2. `dist/public/index.html` matches the build at `9f7129d7` for the same env apart from the E4 comment, the E9 image URLs, and removal of the inlined preview-runtime script. Asset URLs are absolute `/assets/…`. Base stays `/`. QA diffs the two builds.
- A3. Updated B1 passes. A mutant with `base: "./"`, or with `GITHUB_PAGES` reintroduced, fails it.
- A4. `npm test`, `npm run check:worker`, `npm run test:workers`, `npm run assert:liquidglass-chunk` and `npx wrangler deploy --dry-run` all pass in CI. `.github/workflows/` contains only `ci.yml`.
- A5. `git grep -nIiE 'gh-pages|github pages|GITHUB_PAGES|build:pages|deploy-pages|upload-pages-artifact|peaceiris|404\.html'` finds hits only in these paths and nowhere else: `docs/` (all of it; history and specs); `.github/workflows/ci.yml` (the A1 guard's own pattern); `worker/build.config.test.ts` (B1); `client/src/const.ts` (deferred exception, removed with the later getRouterBase removal PR, not this one). Any hit outside this list fails.
- A6. Worker routing is unchanged: the existing W-tests pass unmodified (SPA fallback for `/not-a-route` via ASSETS, Worker 404 HTML for bad Daily Fix paths, `/api/foo` JSON 404).
- A7. `git grep -n GITHUB_REPOSITORY` before E7: the only hit is `ci.yml`. Record the result in the PR.
- A8. After merge (manual, Web Lead): the Workers Builds run for the merge commit is green, and `curl -sI https://metfix.org/` and `https://metfix.org/the-daily-fix/<recent YYMMDD>` return 200. Then Ethan disables Pages.

- A9. og:image: `dist/public/index.html` contains `property="og:image" content="https://metfix.org/social-preview.jpg"` and `name="twitter:image" content="https://metfix.org/social-preview.jpg"`; `git grep -n 'github.io'` finds no hit outside `docs/`; `client/public/social-preview.jpg` exists and `dist/public/social-preview.jpg` exists after `build:cf` (CI `test -s`). Pool-workers test: `GET /social-preview.jpg` through the Worker plus ASSETS returns 200 with a `Content-Type` starting `image/jpeg`. Post-deploy (manual): `curl -sI https://metfix.org/social-preview.jpg` gives 200 and `content-type: image/jpeg`.

## 4. Threat note
- Removing `CNAME` and the workflow means a stray push can't re-publish an old Pages build or re-claim `metfix.org` on Pages (the custom domain stays on the Worker). Leaving Pages enabled with no workflow is harmless but untidy, hence the manual step.
- Rollback through Pages DNS goes away. Worker version rollback stays available.
- No secrets touched. `VITE_SANITY_API_READ_TOKEN` stays only in `ci.yml`. Deleting `deploy-pages.yml` removes one more place the token was used.
- Production build output doesn't change (A2), so no new runtime surface.

## 5. Open questions
- None. Q1 (og:image) is resolved as E9. Q2 is closed: Ethan ordered the preview-runtime plugins removed.

## 6. Manus removal
- Ethan's order confirmed, as relayed by MetFix CEO: asked whether he told the Project to strip Manus from #7, Ethan replied in CEO's chat on Sun 2026-10-18 at 2:46 PM PT: "yeah that was me".
