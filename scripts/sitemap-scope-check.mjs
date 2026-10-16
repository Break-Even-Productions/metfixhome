/**
 * One-time scope check for the consolidated sitemap PR (#8).
 * Not part of CI and not imported by any test. Run: node scripts/sitemap-scope-check.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATIC_ALLOW = new Set([
  "client/public/sitemap.xml",
  "client/public/sitemap-pages.xml",
  "client/public/robots.txt",
  "client/public/_redirects",
]);
const INDEX_TESTS = new Set([
  "tests/sitemap-index.build.test.ts",
  "tests/sitemap-index.dev.test.ts",
]);
const CI_FILE = ".github/workflows/ci.yml";
const B7_FILE = "worker/build.config.test.ts";
const TIMEOUT_ALLOW = new Set([
  "docs/metfix-sitemap-timeout/metfix-sitemap-timeout-acceptance.md",
  "docs/metfix-sitemap-timeout/metfix-sitemap-timeout-tests.md",
  "shared/daily-fix/cacheTtl.ts",
  "worker/index.ts",
  "worker/index.test.ts",
  "worker/upstream.ts",
  "worker/sitemap.timeout.test.ts",
  "worker/sitemap.workers.test.ts",
]);
const SCRIPT_FILE = "scripts/sitemap-scope-check.mjs";

const failures = [];

function fail(message) {
  failures.push(message);
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function diffBase() {
  const sha = process.env.PR_BASE_SHA?.trim();
  if (sha) return sha;
  return "origin/main";
}

function changedPaths() {
  const chunks = [
    git(["diff", "--name-only", `${diffBase()}...HEAD`]),
    git(["diff", "--name-only", "HEAD"]),
    git(["diff", "--name-only", "--cached"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [
    ...new Set(
      chunks.flatMap((chunk) =>
        chunk
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ),
  ];
}

function allowed(name) {
  return (
    STATIC_ALLOW.has(name) ||
    INDEX_TESTS.has(name) ||
    name === CI_FILE ||
    name === B7_FILE ||
    TIMEOUT_ALLOW.has(name) ||
    name === SCRIPT_FILE
  );
}

const names = changedPaths();
for (const name of names) {
  if (!allowed(name)) fail(`not on allowlist: ${name}`);
  if (name === "wrangler.jsonc") fail("wrangler.jsonc is banned");
  if (name === "client/public/_headers") fail("client/public/_headers is banned");
  if (name.startsWith("worker/") && name !== B7_FILE && !TIMEOUT_ALLOW.has(name)) {
    fail(`other worker/** banned: ${name}`);
  }
}

const prod = [
  ".",
  ":(exclude)tests",
  ":(exclude)docs",
  ":(exclude)worker/*.test.ts",
  `:(exclude)${B7_FILE}`,
  `:(exclude)${SCRIPT_FILE}`,
];
const base = diffBase();
const diffText = [
  git(["diff", `${base}...HEAD`, "--", ...prod]),
  git(["diff", "HEAD", "--", ...prod]),
  git(["diff", "--cached", "--", ...prod]),
].join("\n");
const added = diffText
  .split("\n")
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .join("\n");

if (/ForTests|forTests|onlyForTests|__testOnly|testOnlyHook/.test(added)) {
  fail("production diff contains a test-only hook");
}
if (/\bvi\.mock\b/.test(added)) fail("production diff contains vi.mock");
if (/cloudflare:test/.test(added)) fail("production diff contains cloudflare:test");

const workerPaths = [...diffText.matchAll(/^diff --git a\/(\S+) b\//gm)]
  .map((match) => match[1])
  .filter((file) => file.startsWith("worker/"));
for (const file of workerPaths) {
  if (!TIMEOUT_ALLOW.has(file)) fail(`worker diff not on the timeout allowlist: ${file}`);
}
if (/^diff --git a\/wrangler\.jsonc/m.test(diffText)) fail("diff touches wrangler.jsonc");

const ciDiff =
  git(["diff", `${base}...HEAD`, "--", CI_FILE]) + git(["diff", "HEAD", "--", CI_FILE]);
const ciAdded = ciDiff
  .split("\n")
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .join("\n");
if (/CLOUDFLARE_API_TOKEN/.test(ciAdded)) fail("ci.yml adds CLOUDFLARE_API_TOKEN");
if (/secrets\./.test(ciAdded)) fail("ci.yml adds secrets.");
if (/wrangler login/.test(ciAdded)) fail("ci.yml adds wrangler login");
if (/--remote/.test(ciAdded)) fail("ci.yml adds --remote");

if (failures.length > 0) {
  for (const message of failures) console.error(message);
  process.exit(1);
}

console.log("sitemap-scope-check: ok");
console.log(`base: ${base}`);
console.log(`paths (${names.length}):`);
for (const name of names) console.log(name);
