# PR2 QA tooling

## Mutation runner (r1.25)

```bash
node tools/pr2/run-mutations.mjs
node tools/pr2/run-mutations.mjs --only M-JL1,M-CW19
node tools/pr2/run-mutations.mjs --out tools/pr2/mutation-results.json
```

Each mutant runs the **full** gate suites (`vitest` via `vitest.gate.config.ts`, `npm run build:cf`, `npm run test:workers`), records failing test titles, and restores with `git checkout -- .`.

## CK-P1 (pin + gate count)

```bash
node tools/pr2/ck-p1.mjs
```

## CI / install

Repository `packageManager` is **pnpm** (`pnpm@10.4.1`). GitHub Actions in this PR branch still uses `npm ci` per gate scope (PR2 does not edit `.github/workflows/ci.yml`). Local QA and mutation runs may use `pnpm install` / `pnpm test` equivalently.
