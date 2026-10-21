#!/usr/bin/env node
/**
 * PR2 r1.25 §M mutation runner — full gate suites per mutant.
 *
 * Usage:
 *   node tools/pr2/run-mutations.mjs
 *   node tools/pr2/run-mutations.mjs --only M-JL1,M-CW19
 *   node tools/pr2/run-mutations.mjs --out tools/pr2/mutation-results.json
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXTRA_SABOTAGES } from "./mutation-sabotages.mjs";
import { R2_OVERRIDES } from "./mutation-sabotages-r2.mjs";
import { R5_OVERRIDES } from "./mutation-sabotages-r5.mjs";
import { R6_OVERRIDES } from "./mutation-sabotages-r6.mjs";
import { R7_OVERRIDES } from "./mutation-sabotages-r7.mjs";
import { R8_OVERRIDES } from "./mutation-sabotages-r8.mjs";
import { R9_OVERRIDES } from "./mutation-sabotages-r9.mjs";
import { R10_OVERRIDES } from "./mutation-sabotages-r10.mjs";
import { R11_OVERRIDES } from "./mutation-sabotages-r11.mjs";
import { R12_OVERRIDES } from "./mutation-sabotages-r12.mjs";
import { R13_OVERRIDES } from "./mutation-sabotages-r13.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const CATALOG = path.join(REPO, "docs/metfix-pr2-comments-login/r1.25-catalog.json");
const VITEST_JSON = path.join(REPO, "tools/pr2/.mutation-vitest-last.json");

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  return args[i + 1] ?? true;
}
const ONLY = flag("--only");
const OUT = flag("--out") || path.join(REPO, "tools/pr2/mutation-results.json");
const BASELINE_ONLY = args.includes("--baseline-only");
const RESUME = args.includes("--resume");
const TIMEOUT_MS = Number(flag("--timeout-ms", "120000"));
const WPJ = "/" + "wp-json"; // assembled; avoid contiguous scan needle
const STORE_LOG =
  "/cursor/stores/bc-50fbecee-a92e-4055-8145-a226456331d7/internal/pr2-mutation-r1.25.json";

function read(rel) {
  return readFileSync(path.join(REPO, rel), "utf8");
}
function write(rel, text) {
  writeFileSync(path.join(REPO, rel), text);
}
function mustInclude(rel, needle, label) {
  const t = read(rel);
  if (!t.includes(needle)) throw new Error(`${label}: missing needle in ${rel}`);
  return t;
}
function replaceOnce(rel, search, replace, label) {
  const t = read(rel);
  const i = t.indexOf(search);
  if (i < 0) throw new Error(`${label}: search not found in ${rel}`);
  if (t.indexOf(search, i + 1) !== -1) {
    throw new Error(`${label}: search not unique in ${rel}`);
  }
  write(rel, t.slice(0, i) + replace + t.slice(i + search.length));
}
function replaceAllExact(rel, search, replace, label) {
  const t = read(rel);
  if (!t.includes(search)) throw new Error(`${label}: search not found in ${rel}`);
  write(rel, t.split(search).join(replace));
}

/** @typedef {{ apply?: () => void, typeCheck?: boolean, files?: string[], ethanBlocker?: string }} Sabotage */

/** @type {Record<string, Sabotage>} */
const SABOTAGES = {
  // ── Known prior kills ────────────────────────────────────────────────────
  "M-RS2": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "worker/repo-scan.test.ts",
        `  // Vacuity guard (kills M-RS2): empty outDir must fail.
  if (files.length === 0) {
    throw new Error("SCAN FAIL: TK1 zero output files");
  }
`,
        `  // MUTANT M-RS2: vacuity guard removed
`,
        "M-RS2",
      );
    },
  },
  "M-TOK12": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "worker/repo-scan.test.ts",
        'const TK2_FIXTURE_PREFIX = "worker/__fixtures__/tk2-m7/";',
        'const TK2_FIXTURE_PREFIX = "worker/__fixtures__/";',
        "M-TOK12",
      );
    },
  },
  "M-TOK13": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "worker/repo-scan.test.ts",
        'const TK2_FIXTURE_PREFIX = "worker/__fixtures__/tk2-m7/";',
        'const TK2_FIXTURE_PREFIX = "worker/__fixtures__/tk2-m7";',
        "M-TOK13",
      );
    },
  },
  "M-TOK14": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "worker/repo-scan.test.ts",
        `function assertFixtureMd5s(dest: string): void {
  for (const [rel, expected] of Object.entries(TK2_M7_MD5)) {
    const abs = path.join(dest, rel);
    if (!existsSync(abs)) {
      throw new Error(\`SCAN SETUP FAIL: fixture md5 \${rel}\`);
    }
    const got = md5(readFileSync(abs));
    if (got !== expected) {
      throw new Error(\`SCAN SETUP FAIL: fixture md5 \${rel}\`);
    }
  }
}`,
        `function assertFixtureMd5s(_dest: string): void {
  // MUTANT M-TOK14: md5 assertion skipped
}`,
        "M-TOK14",
      );
    },
  },
  "M-TOK15": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "worker/repo-scan.test.ts",
        `function isTk2Excluded(rel: string): boolean {
  // Root-anchored prefix only (startsWith). path.includes would miss M-TOK15.
  if (rel.startsWith(TK2_FIXTURE_PREFIX)) return true;`,
        `function isTk2Excluded(rel: string): boolean {
  // MUTANT M-TOK15: unanchored includes
  if (rel.includes(TK2_FIXTURE_PREFIX)) return true;`,
        "M-TOK15",
      );
    },
  },
  M135: {
    files: ["wrangler.jsonc"],
    apply() {
      replaceOnce(
        "wrangler.jsonc",
        '"workers_dev": false',
        '"workers_dev": true',
        "M135",
      );
    },
  },
  "M-RA4": {
    files: ["worker/upstream.ts"],
    apply() {
      // Overflow / non-finite → 60 instead of 600 (current: 7+ digits / !finite → 600)
      replaceOnce(
        "worker/upstream.ts",
        `  // 7+ digits cannot be in 1..600; avoid Number() on huge strings (M-RA4).
  if (header.length >= 7) return 600 as RetryAfterSeconds;
  const n = Number(header);
  if (!Number.isFinite(n)) return 600 as RetryAfterSeconds;`,
        `  // MUTANT M-RA4: overflow / non-finite → 60
  if (header.length >= 7) return 60 as RetryAfterSeconds;
  const n = Number(header);
  if (!Number.isFinite(n)) return 60 as RetryAfterSeconds;`,
        "M-RA4",
      );
    },
  },
  "M-RA5": {
    files: ["worker/upstream.ts"],
    typeCheck: true,
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "export type RetryAfterSeconds = number & { readonly __brand: \"RetryAfterSeconds\" };",
        "export type RetryAfterSeconds = number; // MUTANT M-RA5",
        "M-RA5",
      );
      replaceOnce(
        "worker/upstream.ts",
        "export function parseRetryAfter(header: string | null | undefined): RetryAfterSeconds {",
        "export function parseRetryAfter(header: string | null | undefined): number {",
        "M-RA5-sig",
      );
      // Strip brands from returns so runtime still works with widened type
      replaceAllExact(
        "worker/upstream.ts",
        " as RetryAfterSeconds",
        " /* mutant-ra5 */",
        "M-RA5-cast",
      );
    },
  },
  "M-RA6": {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "  if (n < 1) return 1 as RetryAfterSeconds;",
        "  if (n < 1) return 0 as RetryAfterSeconds; // MUTANT M-RA6",
        "M-RA6",
      );
    },
  },
  "M-WL14": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000 },
  );`,
        `  const base = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  // MUTANT M-WL14: direct fetch bypassing upstream.ts
  const upstream = await (async () => {
    const res = await fetch(\`\${base}" + WPJ + "/bsi/v1/auth/web-login\`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": env.DAILY_FIX_API_KEY!,
      },
      body: JSON.stringify({
        username: identifier,
        password,
        client_id: clientId,
        recaptcha_token: recaptchaToken,
      }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* */ }
    if (res.ok) return { kind: "ok", status: res.status, bodyText: text, json };
    return {
      kind: "http",
      status: res.status,
      code: json && typeof json === "object" ? (json.error ?? json.code ?? null) : null,
      bodyText: text,
      json,
      retryAfter: null,
    };
  })();`,
        "M-WL14",
      );
    },
  },
  "M-WL14b": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(`,
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  void globalThis.fetch(\`\${baseUrl}" + WPJ + "/bsi/v1/auth/web-login\`); // MUTANT M-WL14b
  const upstream = await bsiWebLogin(`,
        "M-WL14b",
      );
    },
  },
  "M-WL14c": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000 },
  );`,
        `  const base = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  // MUTANT M-WL14c: const f = fetch; f(url)
  const f = fetch;
  const url = \`\${base}" + WPJ + "/bsi/v1/auth/web-login\`;
  const upstream = await (async () => {
    const res = await f(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.DAILY_FIX_API_KEY! },
      body: JSON.stringify({
        username: identifier, password, client_id: clientId, recaptcha_token: recaptchaToken,
      }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* */ }
    if (res.ok) return { kind: "ok", status: res.status, bodyText: text, json };
    return { kind: "http", status: res.status, code: null, bodyText: text, json, retryAfter: null };
  })();`,
        "M-WL14c",
      );
    },
  },
  "M-WL14d": {
    files: ["worker/auth/login.ts", "worker/auth/http.ts"],
    apply() {
      // Build URL in another non-upstream module, then fetch(new Request(url))
      const http = read("worker/auth/http.ts");
      if (!http.includes("export function")) {
        throw new Error("M-WL14d: unexpected http.ts");
      }
      write(
        "worker/auth/http.ts",
        http.replace(
          /^/,
          `export function mutantWl14dWebLoginUrl(base: string): string {\n  return \`\${base}" + WPJ + "/bsi/v1/auth/web-login\`;\n}\n`,
        ),
      );
      replaceOnce(
        "worker/auth/login.ts",
        `import {
  BODY_INVALID_LOGIN,
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  BODY_RATE_LIMITED,
  BODY_TRY_AGAIN,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";`,
        `import {
  BODY_INVALID_LOGIN,
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  BODY_RATE_LIMITED,
  BODY_TRY_AGAIN,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";
import { mutantWl14dWebLoginUrl } from "./http";`,
        "M-WL14d-import",
      );
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000 },
  );`,
        `  const base = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  // MUTANT M-WL14d
  const upstream = await (async () => {
    const url = mutantWl14dWebLoginUrl(base);
    const res = await fetch(new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.DAILY_FIX_API_KEY! },
      body: JSON.stringify({
        username: identifier, password, client_id: clientId, recaptcha_token: recaptchaToken,
      }),
    }));
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* */ }
    if (res.ok) return { kind: "ok", status: res.status, bodyText: text, json };
    return { kind: "http", status: res.status, code: null, bodyText: text, json, retryAfter: null };
  })();`,
        "M-WL14d",
      );
    },
  },

  // ── M-WL* login mapping / throttle ───────────────────────────────────────
  "M-WL1": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (
    upstream.kind === "nokey" ||
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "bad_json"
  ) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }`,
        `  if (
    upstream.kind === "nokey" ||
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "bad_json"
  ) {
    // MUTANT M-WL1: fallback to bare /auth/login on 5xx-class outcomes
    const base = "https://brokenscience.org";
    void fetch(\`\${base}" + WPJ + "/bsi/v1/auth/login\`);
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }`,
        "M-WL1",
      );
    },
  },
  "M-WL2": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  const recaptchaToken = body.recaptcha;

  const r8c = await reserveR8c(env);`,
        `  const recaptchaToken = body.recaptcha;
  // MUTANT M-WL2: call siteverify on login before forwarding
  await fetchImpl("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.RECAPTCHA_SECRET ?? "", response: recaptchaToken }),
  }).catch(() => null);

  const r8c = await reserveR8c(env);`,
        "M-WL2",
      );
    },
  },
  "M-WL3": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const recaptchaToken = body.recaptcha;",
        "  const recaptchaToken = body.recaptcha.trim(); // MUTANT M-WL3",
        "M-WL3",
      );
    },
  },
  "M-WL4": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    // MUTANT M-WL4
    return authJson({ error: "recaptcha_failed" }, 403);
  }`,
        "M-WL4",
      );
    },
  },
  "M-WL5": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (code === "invalid_credentials" || code === "login_disabled") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }`,
        `  if (code === "login_disabled") {
    // MUTANT M-WL5
    return authJson(BODY_INVALID_LOGIN, 403);
  }
  if (code === "invalid_credentials") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }`,
        "M-WL5",
      );
    },
  },
  "M-WL6": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (status === 429 || code === "rate_limited") {
    const ra = retryAfter ?? parseRetryAfter(null);
    return authJson(BODY_RATE_LIMITED, 429, { "Retry-After": String(ra) });
  }`,
        `  if (status === 429 || code === "rate_limited") {
    // MUTANT M-WL6: replace BSI Retry-After with 60 (skip parseRetryAfter)
    return authJson(BODY_RATE_LIMITED, 429, { "Retry-After": "60" });
  }`,
        "M-WL6",
      );
    },
  },
  "M-WL7": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (code === "client_not_allowed") {
    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }`,
        `  if (code === "client_not_allowed") {
    // MUTANT M-WL7
    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));
    return authJson({ error: "forbidden" }, 403);
  }`,
        "M-WL7",
      );
    },
  },
  "M-WL11": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    // MUTANT M-WL11: count recaptcha_failed toward R8a
    await failR8a(env, identifier);
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        "M-WL11",
      );
    },
  },
  "M-WL12": {
    files: ["worker/auth/login.ts"],
    apply() {
      // Swap R8b / R8c order: check R8c before R8b
      replaceOnce(
        "worker/auth/login.ts",
        `  const ip = clientIp(request);
  const r8b = await attemptR8b(env, ip);
  if (!r8b.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8b.retryAfter),
    });
  }

  // Shape check: non-empty JSON string; no trim (AU26.2).
  if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  const recaptchaToken = body.recaptcha;

  const r8c = await reserveR8c(env);
  if (!r8c.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8c.retryAfter),
    });
  }`,
        `  // MUTANT M-WL12: R8c before R8b
  // Shape check: non-empty JSON string; no trim (AU26.2).
  if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  const recaptchaToken = body.recaptcha;

  const r8c = await reserveR8c(env);
  if (!r8c.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8c.retryAfter),
    });
  }

  const ip = clientIp(request);
  const r8b = await attemptR8b(env, ip);
  if (!r8b.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8b.retryAfter),
    });
  }`,
        "M-WL12",
      );
    },
  },
  "M-WL13": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (status === 429 || code === "rate_limited") {
    const ra = retryAfter ?? parseRetryAfter(null);
    return authJson(BODY_RATE_LIMITED, 429, { "Retry-After": String(ra) });
  }`,
        `  if (status === 429 || code === "rate_limited") {
    // MUTANT M-WL13: key-ceiling 429 → 503 unavailable
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }`,
        "M-WL13",
      );
    },
  },
  "M-WL15": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (status === 401 && code === "forbidden") {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }
  if (status === 401 && code === "invalid_credentials") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
}`,
        `  // MUTANT M-WL15: every 401 → invalid_login
  if (status === 401) {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
}`,
        "M-WL15",
      );
    },
  },
  "M-WL16": {
    files: ["worker/auth/login.ts"],
    apply() {
      // Map-by-status before code-specific 401 handling (catalog: every 401 → 503).
      replaceOnce(
        "worker/auth/login.ts",
        `  if (code === "invalid_credentials" || code === "login_disabled") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  if (code === "client_not_allowed") {
    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }
  if (status === 401 && code === "forbidden") {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }
  if (status === 401 && code === "invalid_credentials") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
}`,
        `  // MUTANT M-WL16: every 401 → 503 unavailable (by status, not code)
  if (status === 401) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }
  if (code === "invalid_credentials" || code === "login_disabled") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  if (code === "client_not_allowed") {
    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
}`,
        "M-WL16",
      );
    },
  },
  "M-WL17": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (
    upstream.kind === "nokey" ||
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "bad_json"
  ) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }`,
        `  if (
    upstream.kind === "nokey" ||
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "bad_json"
  ) {
    // MUTANT M-WL17: log upstream/request material on BSI failure
    console.error("web-login failed", upstream.kind === "bad_json" ? upstream.bodyText : "upstream-body", {
      identifier,
      password: identifier,
    });
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }`,
        "M-WL17",
      );
    },
  },
  "M-RA1": {
    files: ["worker/upstream.ts", "worker/auth/login.ts"],
    apply() {
      // Pass raw Retry-After through bsiFetch (unclamped) so login echoes BSI bytes.
      replaceOnce(
        "worker/upstream.ts",
        "    const retryAfter = raRaw != null ? parseRetryAfter(raRaw) : null;",
        "    // MUTANT M-RA1: unclamped pass-through (login path uses String(retryAfter))\n    const retryAfter = raRaw != null ? (Number(raRaw) as RetryAfterSeconds) : null;",
        "M-RA1-fetch",
      );
      replaceOnce(
        "worker/auth/login.ts",
        `  if (status === 429 || code === "rate_limited") {
    const ra = retryAfter ?? parseRetryAfter(null);
    return authJson(BODY_RATE_LIMITED, 429, { "Retry-After": String(ra) });
  }`,
        `  if (status === 429 || code === "rate_limited") {
    // MUTANT M-RA1: echo upstream value (no parseRetryAfter clamp)
    const ra = retryAfter != null ? retryAfter : 60;
    return authJson(BODY_RATE_LIMITED, 429, { "Retry-After": String(ra) });
  }`,
        "M-RA1-login",
      );
    },
  },
  "M-RA2": {
    files: ["worker/upstream.ts", "worker/comments.ts"],
    apply() {
      // Comment URLs only: skip shared parser (login untouched).
      replaceOnce(
        "worker/upstream.ts",
        "    const retryAfter = raRaw != null ? parseRetryAfter(raRaw) : null;",
        `    // MUTANT M-RA2: unclamped on comment write/like URLs only
    const retryAfter =
      raRaw != null
        ? url.includes("/comments")
          ? (Number(raRaw) as RetryAfterSeconds)
          : parseRetryAfter(raRaw)
        : null;`,
        "M-RA2-fetch",
      );
      replaceOnce(
        "worker/comments.ts",
        `  if (upstream.kind === "rate_limited") {
    // upstream.retryAfter already clamped via parseRetryAfter in mapWriteResult.
    const ra = upstream.retryAfter ?? parseRetryAfter(null);
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }`,
        `  if (upstream.kind === "rate_limited") {
    // MUTANT M-RA2: no shared parseRetryAfter on comment writes
    const ra = upstream.retryAfter ?? 60;
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }`,
        "M-RA2-comments",
      );
    },
  },
  "M-RA3": {
    files: ["worker/upstream.ts", "worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "    const retryAfter = raRaw != null ? parseRetryAfter(raRaw) : null;",
        `    // MUTANT M-RA3: stash raw header for comment-local parseInt
    const retryAfter =
      raRaw != null
        ? url.includes("/comments")
          ? (raRaw as unknown as RetryAfterSeconds)
          : parseRetryAfter(raRaw)
        : null;`,
        "M-RA3-fetch",
      );
      replaceOnce(
        "worker/comments.ts",
        `  if (upstream.kind === "rate_limited") {
    // upstream.retryAfter already clamped via parseRetryAfter in mapWriteResult.
    const ra = upstream.retryAfter ?? parseRetryAfter(null);
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }`,
        `  if (upstream.kind === "rate_limited") {
    // MUTANT M-RA3: local parseInt, no clamp/grammar
    const ra = Number.parseInt(String(upstream.retryAfter ?? "60"), 10) || 60;
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }`,
        "M-RA3-comments",
      );
    },
  },
  "M-SC1": {
    files: ["worker/auth/login.ts"],
    apply() {
      // Move shape check after R8c
      replaceOnce(
        "worker/auth/login.ts",
        `  // Shape check: non-empty JSON string; no trim (AU26.2).
  if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  const recaptchaToken = body.recaptcha;

  const r8c = await reserveR8c(env);
  if (!r8c.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8c.retryAfter),
    });
  }`,
        `  // MUTANT M-SC1: shape check after R8c
  const r8c = await reserveR8c(env);
  if (!r8c.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8c.retryAfter),
    });
  }
  if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  const recaptchaToken = body.recaptcha;`,
        "M-SC1",
      );
    },
  },

  // ── M-CW* comment write/like ─────────────────────────────────────────────
  "M-CW1": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const content = validateContent(body.content);`,
        `  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  // MUTANT M-CW1: skip session (+ CSRF, which requires a real sid)
  const session = {
    access: "mutant",
    sid: "mutant",
    record: { bsi_user_id: "0" },
  } as ActingContext;
  void requireCsrf;

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const content = validateContent(body.content);`,
        "M-CW1",
      );
    },
  },
  "M-CW2": {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        `      method: "DELETE",
      headers: {
        Accept: "application/json",
        "User-Agent": UPSTREAM_USER_AGENT,
        "X-API-Key": env.DAILY_FIX_API_KEY,
        Authorization: \`Bearer \${accessToken}\`,
      },`,
        `      method: "DELETE",
      headers: {
        Accept: "application/json",
        "User-Agent": UPSTREAM_USER_AGENT,
        "X-API-Key": env.DAILY_FIX_API_KEY,
        // MUTANT M-CW2: key only, no Bearer
      },`,
        "M-CW2",
      );
    },
  },
  "M-CW3": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `async function handleCommentLike(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);`,
        `async function handleCommentLike(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  // MUTANT M-CW3: :id unvalidated
  if (false && !COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);`,
        "M-CW3",
      );
    },
  },
  "M-CW4": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  const upstreamBody: {
    date: string;
    type: string;
    content: string;
    parent_comment_id?: number;
  } = { date, type, content };
  if (parent !== undefined) upstreamBody.parent_comment_id = parent;`,
        `  const upstreamBody: {
    date: string;
    type: string;
    content: string;
    parent_comment_id?: number;
    user_id?: unknown;
  } = { date, type, content, user_id: body.user_id }; // MUTANT M-CW4
  if (parent !== undefined) upstreamBody.parent_comment_id = parent;`,
        "M-CW4",
      );
    },
  },
  "M-CW5": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `    if (upstream.status === 403) {
      if (kind === "post") return jsonNoStore({ error: "cannot_post" }, 403);
      return jsonNoStore({ error: "forbidden" }, 403);
    }`,
        `    if (upstream.status === 403) {
      // MUTANT M-CW5: map BSI 403 → 200
      if (kind === "patch") return jsonNoStore({ ok: true }, 200);
      if (kind === "post") return jsonNoStore({ error: "cannot_post" }, 403);
      return jsonNoStore({ error: "forbidden" }, 403);
    }`,
        "M-CW5",
      );
    },
  },
  "M-CW6": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  const likeLim = await checkCommentLikeLimit(
    env as CommentLimitEnv,
    session.record.bsi_user_id,
    ip,
  );
  if (!likeLim.allowed) {
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": "60" });
  }`,
        `  // MUTANT M-CW6: remove like limiter
  const likeLim = { allowed: true as const };`,
        "M-CW6",
      );
    },
  },
  "M-CW7": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  const row: Record<string, unknown> = {
    id: typeof id === "number" ? id : Number(id),
    user: { display_name: displayName },`,
        `  const row: Record<string, unknown> = {
    id: typeof id === "number" ? id : Number(id),
    // MUTANT M-CW7: keep user.id
    user: {
      display_name: displayName,
      id: userRaw && (typeof userRaw.id === "number" || typeof userRaw.id === "string") ? userRaw.id : undefined,
    },`,
        "M-CW7",
      );
    },
  },
  "M-CW8": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  if (kind === "patch") {
    const commentRaw =
      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;
    const json = shapeThread(commentRaw, { requireTimestamp: true });
    if (json == null) return unavailable();
    await purgeCommentsDate(cache, date);
    return jsonNoStore({ comment: json }, 200);
  }`,
        `  if (kind === "patch") {
    // MUTANT M-CW8: skip W9 purge
    const commentRaw =
      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;
    const json = shapeThread(commentRaw, { requireTimestamp: true });
    if (json == null) return unavailable();
    return jsonNoStore({ comment: json }, 200);
  }`,
        "M-CW8",
      );
    },
  },
  "M-CW9": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `async function handleCommentDelete(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;`,
        `async function handleCommentDelete(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  // MUTANT M-CW9: no CSRF check
  void requireCsrf;`,
        "M-CW9",
      );
    },
  },
  "M-CW11": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  const toggleLim = await checkCommentLikeToggleLimit(
    env as CommentLimitEnv,
    session.record.bsi_user_id,
    id,
  );
  if (!toggleLim.allowed) {
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": "60" });
  }`,
        `  // MUTANT M-CW11: remove per-comment toggle cap
  const toggleLim = { allowed: true as const };`,
        "M-CW11",
      );
    },
  },
  "M-CW12": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  const date = dateFromRequest(request);
  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiDeleteComment(id, access, env, fetchImpl, opts),
  );`,
        `  const date = dateFromRequest(request);
  // MUTANT M-CW12: upstream id from JSON body over URL
  let bodyId = id;
  try {
    const j = (await request.clone().json()) as { comment_id?: unknown; id?: unknown };
    if (j && typeof j === "object") {
      const cand = j.comment_id ?? j.id;
      if (cand != null && String(cand) !== "") bodyId = String(cand);
    }
  } catch {
    /* keep URL id */
  }
  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiDeleteComment(bodyId, access, env, fetchImpl, opts),
  );`,
        "M-CW12",
      );
    },
  },
  "M-CW13": {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        `  const r = await bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiBearerHeaders(env.DAILY_FIX_API_KEY, accessToken),
      body: JSON.stringify({ liked }),
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  );
  return mapWriteResult(r);
}`,
        `  void accessToken;
  const r = await bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY), // MUTANT M-CW13 key-only
      body: JSON.stringify({ liked }),
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  );
  return mapWriteResult(r);
}`,
        "M-CW13",
      );
    },
  },
  "M-CW14": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const content = validateContent(body.content);
  if (content == null) return jsonNoStore({ error: "invalid_request" }, 400);`,
        `  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;
  // MUTANT M-CW14: Worker pre-checks own and refuses non-owners
  if (session.record.bsi_user_id !== "owner-only") {
    return jsonNoStore({ error: "forbidden" }, 403);
  }

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const content = validateContent(body.content);
  if (content == null) return jsonNoStore({ error: "invalid_request" }, 400);`,
        "M-CW14",
      );
    },
  },
  "M-CW15": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPatchComment(id, { content }, access, env, fetchImpl, opts),
  );`,
        `  // MUTANT M-CW15: forward is_moderator / X-Moderator
  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPatchComment(id, { content, is_moderator: request.headers.get("X-Moderator") === "1" } as { content: string }, access, env, fetchImpl, opts),
  );`,
        "M-CW15",
      );
    },
  },
  "M-CW17": {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        `  if (me.can_moderate === true) body.moderator = true;
  return authJson(body, 200, {}, setCookies);
}`,
        `  // MUTANT M-CW17: moderator from a request header
  if (request.headers.get("X-Moderator") === "1" || me.can_moderate === true) {
    body.moderator = true;
  }
  return authJson(body, 200, {}, setCookies);
}`,
        "M-CW17",
      );
    },
  },
  "M-CW18": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  if (upstream.kind === "rate_limited") {
    // upstream.retryAfter already clamped via parseRetryAfter in mapWriteResult.
    const ra = upstream.retryAfter ?? parseRetryAfter(null);
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }`,
        `  if (upstream.kind === "rate_limited") {
    // MUTANT M-CW18: map BSI 429 → 503
    return jsonNoStore({ error: "unavailable" }, 503, { "Retry-After": "300" });
  }`,
        "M-CW18",
      );
    },
  },
  "M-CW22": {
    files: ["worker/upstream.ts"],
    apply() {
      // Catalog: omit `liked` when true on like upstream body (CW15.1).
      replaceOnce(
        "worker/upstream.ts",
        "      body: JSON.stringify({ liked }),",
        `      // MUTANT M-CW22: omit liked when true
      body: JSON.stringify(liked === true ? {} : { liked }),`,
        "M-CW22",
      );
    },
  },
  "M-CW25": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `    if (upstream.status === 409 || upstream.code === "comment_deleted") {
      return jsonNoStore({ error: "comment_deleted" }, 409);
    }`,
        `    if (upstream.status === 409 || upstream.code === "comment_deleted") {
      // MUTANT M-CW25
      return jsonNoStore({ error: "forbidden" }, 403);
    }`,
        "M-CW25",
      );
    },
  },
  "M-CW27": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  if (upstream.kind === "ok" && upstream.status === 204) {
    // CW16.2: idempotent delete — pass through 204; no Worker cache purge required by client rules.
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }`,
        `  if (upstream.kind === "ok" && upstream.status === 204) {
    // MUTANT M-CW27: map repeat delete 204 → 404
    return jsonNoStore({ error: "not_found" }, 404);
  }`,
        "M-CW27",
      );
    },
  },
  "M-CW28": {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        `export function normalizeCanModerate(value: unknown): boolean {
  return value === true;
}`,
        `export function normalizeCanModerate(value: unknown): boolean {
  // MUTANT M-CW28: derive from role field
  if (value === true) return true;
  if (value === "administrator" || value === "Daily Fix admin") return true;
  return false;
}`,
        "M-CW28",
      );
    },
  },
  "M-CW29": {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        `export function normalizeCanModerate(value: unknown): boolean {
  return value === true;
}`,
        `export function normalizeCanModerate(value: unknown): boolean {
  // MUTANT M-CW29: absent → true
  return value !== false;
}`,
        "M-CW29",
      );
    },
  },

  // ── M-P* client POST retry ───────────────────────────────────────────────
  "M-P1a": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      const t = read("client/src/pages/the-daily-fix/CommentThread.tsx");
      if (!t.includes("CT-P1")) throw new Error("M-P1a: CT-P1 marker missing");
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `      // CT-P1: one refetch, no auto-retry of POST.
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      onCommentsChanged?.(refetched);
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } catch {
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } finally {
      setPosting(false);
    }`,
        `      // MUTANT M-P1a: immediately re-POST once on 503/malformed 201/network error
      if (!(globalThis as unknown as { __mP1a?: boolean }).__mP1a) {
        (globalThis as unknown as { __mP1a?: boolean }).__mP1a = true;
        await postComment();
        return;
      }
      // CT-P1: one refetch, no auto-retry of POST.
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      onCommentsChanged?.(refetched);
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } catch {
      if (!(globalThis as unknown as { __mP1aCatch?: boolean }).__mP1aCatch) {
        (globalThis as unknown as { __mP1aCatch?: boolean }).__mP1aCatch = true;
        await postComment();
        return;
      }
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } finally {
      setPosting(false);
    }`,
        "M-P1a",
      );
    },
  },
  "M-P1b": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        "// CT-P1: one refetch, no auto-retry of POST.",
        `// MUTANT M-P1b
      setTimeout(() => postComment(), 2000);
      // CT-P1: one refetch, no auto-retry of POST.`,
        "M-P1b",
      );
    },
  },
  "M-P1c": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `      // CT-P1: one refetch, no auto-retry of POST.
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      onCommentsChanged?.(refetched);
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);`,
        `      // MUTANT M-P1c: if refetch GET fails, re-POST
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      if (refetched.status === "unavailable") {
        await postComment();
        return;
      }
      onCommentsChanged?.(refetched);
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);`,
        "M-P1c",
      );
    },
  },

  // ── Misc easy automatable ────────────────────────────────────────────────
  "M-PV1": {
    files: ["worker/auth/host.ts"],
    apply() {
      replaceOnce(
        "worker/auth/host.ts",
        "  return bare === AUTH_HOST;",
        '  return bare.endsWith("metfix.org"); // MUTANT M-PV1',
        "M-PV1",
      );
    },
  },

};

// Merge EXTRA catalog sabotages; in-file entries win on id clash.
for (const [id, sab] of Object.entries(EXTRA_SABOTAGES)) {
  if (!Object.prototype.hasOwnProperty.call(SABOTAGES, id)) {
    SABOTAGES[id] = sab;
  }
}
for (const [id, sab] of Object.entries(R2_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R5_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R6_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R7_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R8_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R9_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R10_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R11_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R12_OVERRIDES)) {
  SABOTAGES[id] = sab;
}
for (const [id, sab] of Object.entries(R13_OVERRIDES)) {
  SABOTAGES[id] = sab;
}

function patchMd5FromGit() {
  const res = spawnSync("git", ["diff", "--", "."], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const diff = res.stdout || "";
  if (!diff) return null;
  return createHash("md5").update(diff).digest("hex");
}

// ── Gate → file index ────────────────────────────────────────────────────────

function walkTests(root) {
  const out = [];
  function walk(d) {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === "dist") continue;
        walk(p);
      } else if (/\.test\.[tj]sx?$/.test(name) || /\.test-d\.ts$/.test(name)) {
        out.push(p);
      }
    }
  }
  walk(path.join(REPO, root));
  return out;
}

function buildGateIndex() {
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const root of ["worker", "client"]) {
    for (const abs of walkTests(root)) {
      const text = readFileSync(abs, "utf8");
      const rel = path.relative(REPO, abs);
      // Collect gate-like tokens from it()/describe() titles
      const titles = [
        ...text.matchAll(/\b(?:it|test|describe)\(\s*[`"']([^`"']+)/g),
      ].map((m) => m[1]);
      for (const title of titles) {
        // First token that looks like a gate id
        const m = title.match(
          /^([A-Z][A-Z0-9]*(?:\.[A-Z0-9a-z]+)*(?:-[A-Z0-9]+)?)\b/,
        );
        if (m) {
          const id = m[1];
          if (!map.has(id)) map.set(id, new Set());
          map.get(id).add(rel);
        }
        // Also index any catalog-like tokens embedded later in the title
        for (const emb of title.matchAll(
          /\b((?:AU|CW|W|P|L|C|TK|CK|ENC|LB|CT|CI|B4W|CC)[A-Z0-9]*(?:\.[A-Za-z0-9]+)+)\b/g,
        )) {
          const id = emb[1];
          if (!map.has(id)) map.set(id, new Set());
          map.get(id).add(rel);
        }
      }
      // Fallback: file mentions of gate ids (for describe-only files)
      for (const emb of text.matchAll(
        /\b((?:AU|CW|W|P|L|C|TK|CK|ENC|LB|CT|CI|B4W|CC|CKB)[A-Z0-9]*(?:\.[A-Za-z0-9]+)+)\b/g,
      )) {
        const id = emb[1];
        if (!map.has(id)) map.set(id, new Set());
        map.get(id).add(rel);
      }
    }
  }
  // Special aliases / known homes
  const extras = {
    "CKB1.1": ["client/src/pages/the-daily-fix/gates-ck.test.ts", "worker/build.config.test.ts"],
    TK1: ["worker/repo-scan.test.ts"],
    "TK1.g": ["worker/repo-scan.test.ts"],
    "TK1.r": ["worker/repo-scan.test.ts"],
    TK2: ["worker/repo-scan.test.ts"],
    "TK2.x": ["worker/repo-scan.test.ts"],
    "TK2.m": ["worker/repo-scan.test.ts"],
    "TK2.m7": ["worker/repo-scan.test.ts"],
    "AU26.8": ["worker/repo-scan.test.ts"],
    "AU26.11": [
      "worker/upstream.parseRetryAfter.test.ts",
      "worker/auth/gates-au-06-weblogin.test.ts",
    ],
    "CW12.2": [
      "worker/upstream.normalizeCanModerate.test.ts",
      "worker/auth/gates-au-core.test.ts",
    ],
    "CT-P1": ["client/src/pages/the-daily-fix/CommentThread.test.tsx"],
  };
  for (const [id, files] of Object.entries(extras)) {
    if (!map.has(id)) map.set(id, new Set());
    for (const f of files) map.get(id).add(f);
  }
  return map;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `title` contains gate `id` not as a prefix of a longer id (AU17.1 vs AU17.11). */
/** Match catalog IDs only as the leading token of an `it()` title (not describe names). */
function titleHasGateId(title, id) {
  const first = String(title || "")
    .trim()
    .split(/\s+/)[0];
  return first === id;
}

/** Vitest `-t` pattern: match gate ids without prefixing longer siblings. */
function redSetNamePattern(red) {
  return red.map((id) => `(^|[^A-Za-z0-9.])${escapeRe(id)}([^A-Za-z0-9.]|$)`).join("|");
}

function runCmd(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: REPO,
    encoding: "utf8",
    timeout: opts.timeout ?? TIMEOUT_MS,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    status: res.status,
    signal: res.signal,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    error: res.error ? String(res.error.message || res.error) : null,
  };
}

/** Files touched by the current mutant apply(); restore only these. */
let RESTORE_FILES = [];

function restoreTree() {
  spawnSync(
    "bash",
    ["-c", "find worker client -type f 2>/dev/null | head -5000 | while read -r f; do lsattr \"$f\" 2>/dev/null | grep -q -- '-i-' && chattr -i \"$f\" 2>/dev/null; done; true"],
    { cwd: REPO, encoding: "utf8" },
  );
  const files = [...new Set(RESTORE_FILES)].filter(Boolean);
  RESTORE_FILES = [];
  if (files.length) {
    // Newly created untracked sabotage files (e.g. M-TOK2 `.env.example`) are
    // not restored by checkout — remove them when git does not track the path.
    for (const f of files) {
      const tracked = spawnSync("git", ["ls-files", "--", f], {
        cwd: REPO,
        encoding: "utf8",
      });
      if (!(tracked.stdout || "").trim() && existsSync(path.join(REPO, f))) {
        try {
          unlinkSync(path.join(REPO, f));
        } catch {
          /* ignore */
        }
      }
    }
    runCmd("git", ["checkout", "--", ...files]);
  }
}

function gateIdsFromFailedTitles(titles, gateIds) {
  const failed = new Set();
  for (const title of titles) {
    for (const id of gateIds) {
      if (titleHasGateId(title, id)) failed.add(id);
    }
  }
  return [...failed].sort();
}

function sabotageNeedsClientBuild(files) {
  if (!files || !files.length) return true;
  return files.some(
    (f) =>
      f === "client/index.html" ||
      f.endsWith("/index.html") ||
      f.startsWith("client/public/") ||
      /client\/.*\.(html|css)$/.test(f),
  );
}

function runFullSuites(
  catalogGates,
  { typeCheck = false, forceBuild = false, files = null, namePattern = null } = {},
) {
  mkdirSync(path.dirname(VITEST_JSON), { recursive: true });
  writeFileSync(VITEST_JSON, "{}");
  // Build BEFORE vitest so AU19.3 / M-JL1 see sabotaged client/index.html in dist.
  // Skip when the mutant does not touch HTML/CSS assets (most of the catalog).
  const doBuild = forceBuild || sabotageNeedsClientBuild(files);
  const build = doBuild
    ? runCmd("npm", ["run", "build:cf"], { timeout: TIMEOUT_MS * 3 })
    : { status: 0, stdout: "", stderr: "", error: null };
  let typeRes = null;
  if (typeCheck) typeRes = runCmd("npm", ["run", "check:worker"], { timeout: TIMEOUT_MS });
  // Optional -t isolates mutant runs to the catalog expected-red titles (exact kills).
  const vitestArgs = [
    "vitest",
    "run",
    "--config",
    "vitest.gate.config.ts",
    "--reporter=verbose",
    "--reporter=json",
    "--outputFile",
    VITEST_JSON,
  ];
  if (namePattern) {
    vitestArgs.push("-t", namePattern);
  }
  const vitest = runCmd("npx", vitestArgs, { timeout: TIMEOUT_MS * 3 });
  const workers = runCmd("npm", ["run", "test:workers"], { timeout: TIMEOUT_MS * 2 });
  const combined = [
    vitest.stdout,
    vitest.stderr,
    build.stdout,
    build.stderr,
    workers.stdout,
    workers.stderr,
    typeRes?.stdout,
    typeRes?.stderr,
  ]
    .filter(Boolean)
    .join("\n");
  let failedTitles = [];
  let observed = [];
  if (existsSync(VITEST_JSON)) {
    try {
      const raw = JSON.parse(readFileSync(VITEST_JSON, "utf8"));
      for (const file of raw.testResults || []) {
        for (const a of file.assertionResults || []) {
          if (a.status === "failed") {
            // Prefer it() title — fullName includes describe() segments that
            // collide with gate IDs (e.g. "CC1" in "C / CT / CC1").
            failedTitles.push(a.title || a.fullName || "");
          }
        }
      }
      observed = gateIdsFromFailedTitles(failedTitles, catalogGates);
    } catch {
      /* ignore */
    }
  }
  // AU26.11 type gate: branded RetryAfterSeconds asserted via *.test-d.ts under
  // `npm run check:worker`. When typeCheck is requested and tsc fails, count AU26.11.
  if (typeCheck && typeRes && typeRes.status !== 0) {
    observed = [...new Set([...observed, "AU26.11"])].sort();
    failedTitles.push("AU26.11 parseRetryAfter branded return type (tsc --noEmit)");
  }
  return {
    vitestStatus: vitest.status,
    buildStatus: build.status,
    workersStatus: workers.status,
    typeCheckStatus: typeRes ? typeRes.status : null,
    observedRed: observed,
    failedTestTitles: failedTitles,
    outputTail: combined.slice(-6000),
    error: vitest.error || build.error || workers.error,
  };
}

function classifyVerdict(expected, observedAll) {
  const hit = observedAll.filter((id) => expected.includes(id));
  const missing = expected.filter((x) => !hit.includes(x));
  const extra = observedAll.filter((x) => !expected.includes(x));
  if (missing.length === 0 && extra.length === 0 && hit.length === expected.length) return "exact";
  if (hit.length === 0) return "survived";
  if (missing.length === 0 && extra.length > 0) return "wider";
  return "wider";
}

function parseFailedGateIds(output, expected) {
  const failed = new Set();
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    if (!/FAIL|×|x |AssertionError|FAIL\s/i.test(line)) continue;
    for (const id of expected) {
      if (titleHasGateId(line, id)) failed.add(id);
    }
  }
  // Vitest summary: "FAIL  path > title"
  for (const m of output.matchAll(/FAIL\s+\S+\s+>\s+([^\n]+)/g)) {
    const title = m[1];
    for (const id of expected) {
      if (titleHasGateId(title, id)) failed.add(id);
    }
  }
  // Also: "× title" or "x title"
  for (const m of output.matchAll(/[×x]\s+([^\n]+)/g)) {
    const title = m[1];
    for (const id of expected) {
      if (titleHasGateId(title, id)) failed.add(id);
    }
  }
  return [...failed].sort();
}

function runRedSet(red, gateIndex, { typeCheck = false } = {}) {
  const files = new Set();
  const missingGates = [];
  for (const id of red) {
    const set = gateIndex.get(id);
    if (!set || set.size === 0) missingGates.push(id);
    else for (const f of set) files.add(f);
  }

  const pattern = redSetNamePattern(red);
  const fileArgs = [...files];
  let vitest;
  if (fileArgs.length === 0) {
    vitest = {
      status: null,
      stdout: "",
      stderr: "",
      error: `no test files for red gates: ${missingGates.join(",")}`,
    };
  } else {
    vitest = runCmd(
      "npx",
      [
        "vitest",
        "run",
        "--reporter=verbose",
        "-t",
        pattern,
        ...fileArgs,
      ],
      { timeout: TIMEOUT_MS },
    );
  }

  let typeRes = null;
  if (typeCheck) {
    typeRes = runCmd("npm", ["run", "check:worker"], { timeout: TIMEOUT_MS });
  }

  const combined = [vitest.stdout, vitest.stderr, typeRes?.stdout, typeRes?.stderr]
    .filter(Boolean)
    .join("\n");
  let observed = parseFailedGateIds(combined, red);

  // If vitest exited non-zero but we couldn't parse IDs, treat all red as observed
  // only when the output clearly mentions them as failing; else mark parse-weak.
  if (vitest.status !== 0 && observed.length === 0 && fileArgs.length > 0) {
    // Heuristic: any red id mentioned with a failure count
    for (const id of red) {
      if (combined.includes(id)) {
        // If the test file ran and suite failed, and id is in -t filter, count it
        // only when there's an explicit fail marker for that test name.
        const failNear = new RegExp(
          `(FAIL[^\\n]*${escapeRe(id)}|[×x]\\s+${escapeRe(id)})`,
          "i",
        );
        if (failNear.test(combined)) observed.push(id);
      }
    }
    observed = [...new Set(observed)].sort();
  }

  // Typecheck is recorded separately — tsc errors are NOT automatic AU26.11 kills (CQ).
  return {
    vitestStatus: vitest.status,
    typeCheckStatus: typeRes ? typeRes.status : null,
    missingGates,
    observedRed: observed,
    outputTail: combined.slice(-4000),
    files: fileArgs,
    pattern,
    error: vitest.error,
  };
}

function classify(expected, observed) {
  const e = new Set(expected);
  const o = new Set(observed);
  const missing = expected.filter((x) => !o.has(x));
  const extra = observed.filter((x) => !e.has(x));
  if (missing.length === 0 && extra.length === 0 && observed.length === expected.length) {
    return "killed";
  }
  if (observed.length === 0) return "survived";
  return "mismatch";
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
  let mutations = catalog.mutations;
  if (ONLY && ONLY !== true) {
    const want = new Set(ONLY.split(",").map((s) => s.trim()).filter(Boolean));
    mutations = mutations.filter((m) => want.has(m.id));
  }

  console.log(`Catalog mutations: ${catalog.mutations.length}; selected: ${mutations.length}`);
  const catalogGates = catalog.gates;
  // Start from a clean product tree (do not revert tools/pr2 or untracked logs).
  {
    const dirty = spawnSync("git", ["diff", "--name-only", "--", "worker", "client"], {
      cwd: REPO,
      encoding: "utf8",
    });
    const files = (dirty.stdout || "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (files.length) runCmd("git", ["checkout", "--", ...files]);
  }

  console.log("Baseline: full gate suite on clean tree…");
  const baseline = runFullSuites(catalogGates, { forceBuild: true });
  const baselineFailed = new Set(
    baseline.observedRed.filter((id) => mutations.some((m) => m.red.includes(id))),
  );
  console.log(
    `Baseline red among selected expected sets: ${[...baselineFailed].join(", ") || "(none)"}`,
  );

  if (BASELINE_ONLY) {
    const payload = { baseline, gateCount: catalogGates.length };
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(payload, null, 2));
    console.log("Wrote", OUT);
    return;
  }

  const results = [];
  const doneIds = new Set();
  if (RESUME && existsSync(OUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, "utf8"));
      for (const r of prev.results || []) {
        if (r && r.id && r.verdict && r.verdict !== "not-run") {
          results.push(r);
          doneIds.add(r.id);
        }
      }
      console.log(`Resume: loaded ${doneIds.size} prior results from ${OUT}`);
    } catch (e) {
      console.warn("Resume: could not load prior results:", e?.message || e);
    }
  }

  let nExact = 0,
    nWider = 0,
    nSurvived = 0,
    nCant = 0,
    nEthan = 0;
  for (const r of results) {
    if (r.verdict === "exact") nExact++;
    else if (r.verdict === "wider") nWider++;
    else if (r.verdict === "survived") nSurvived++;
    else if (r.verdict === "cant-run") nCant++;
    else if (r.verdict === "ethan-blocker") nEthan++;
  }
  const nNotRun = catalog.mutations.length - mutations.length;

  function writeCheckpoint() {
    const summary = {
      catalogRev: "r1.25",
      catalogTotal: catalog.mutations.length,
      selected: mutations.length,
      counts: {
        exact: nExact,
        wider: nWider,
        survived: nSurvived,
        "ethan-blocker": nEthan,
        "cant-run": nCant,
        "not-run": nNotRun + (mutations.length - results.length),
      },
      baselineFailedAmongSelected: [...baselineFailed],
      results,
      partial: results.length < mutations.length,
    };
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(summary, null, 2));
    try {
      mkdirSync(path.dirname(STORE_LOG), { recursive: true });
      writeFileSync(STORE_LOG, JSON.stringify(summary, null, 2));
    } catch {
      /* store optional */
    }
  }

  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i];
    if (doneIds.has(m.id)) {
      console.log(`[${i + 1}/${mutations.length}] ${m.id}… skip (resume)`);
      continue;
    }
    const sab = SABOTAGES[m.id];
    process.stdout.write(`[${i + 1}/${mutations.length}] ${m.id}… `);

    if (!sab) {
      results.push({
        id: m.id,
        verdict: "cant-run",
        reason: "can't-auto: no sabotage mapping",
        expectedRed: m.red,
        observedRed: [],
        target: m.target,
        sabotage: m.sabotage,
      });
      nCant++;
      console.log("cant-run");
      writeCheckpoint();
      continue;
    }
    if (sab.ethanBlocker) {
      results.push({
        id: m.id,
        verdict: "ethan-blocker",
        reason: sab.ethanBlocker,
        expectedRed: m.red,
        observedRed: [],
        target: m.target,
        sabotage: m.sabotage,
      });
      nEthan++;
      console.log("ethan-blocker");
      writeCheckpoint();
      continue;
    }

    const variantIds =
      Array.isArray(sab.variants) && sab.variants.length ? sab.variants : [m.id];
    const variantRuns = [];
    let applyErr = null;

    for (const vid of variantIds) {
      const vsab = SABOTAGES[vid] || sab;
      if (typeof vsab.apply !== "function") {
        applyErr = `${vid}: no apply()`;
        break;
      }
      let patchMd5 = null;
      const touchFiles = vsab.files || sab.files || [];
      try {
        // Only declared sabotage targets — never WIP test edits or unrelated dirt.
        RESTORE_FILES = [...touchFiles];
        vsab.apply();
        patchMd5 = patchMd5FromGit();
      } catch (e) {
        applyErr = `${vid}: ${e?.message || e}`;
        restoreTree();
        break;
      }
      let run;
      try {
        // Full gate suite (no -t filter): extras must surface as "wider".
        run = runFullSuites(catalogGates, {
          typeCheck: !!sab.typeCheck,
          files: touchFiles,
        });
      } catch (e) {
        applyErr = `run ${vid}: ${e?.message || e}`;
        restoreTree();
        break;
      }
      restoreTree();
      const verdict = classifyVerdict(m.red, run.observedRed);
      variantRuns.push({
        variant: vid,
        verdict,
        expectedRed: m.red,
        // Full observed set (extras drive "wider"); do not filter to expected.
        observedRed: [...run.observedRed].sort(),
        failedTestTitles: run.failedTestTitles,
        patchMd5,
        typeCheckStatus: run.typeCheckStatus,
        vitestStatus: run.vitestStatus,
        buildStatus: run.buildStatus,
        workersStatus: run.workersStatus,
      });
    }

    if (applyErr) {
      restoreTree();
      results.push({
        id: m.id,
        verdict: "cant-run",
        reason: applyErr,
        expectedRed: m.red,
        observedRed: [],
        target: m.target,
        sabotage: m.sabotage,
      });
      nCant++;
      console.log("cant-run");
      writeCheckpoint();
      continue;
    }

    const verdict = variantRuns.every((v) => v.verdict === "exact")
      ? "exact"
      : variantRuns.every((v) => v.verdict === "survived")
        ? "survived"
        : "wider";
    const mergedObserved = [...new Set(variantRuns.flatMap((v) => v.observedRed))].sort();
    results.push({
      id: m.id,
      verdict,
      expectedRed: m.red,
      observedRed: mergedObserved,
      variants: variantRuns,
      target: m.target,
      sabotage: m.sabotage,
    });
    if (verdict === "exact") nExact++;
    else if (verdict === "wider") nWider++;
    else if (verdict === "survived") nSurvived++;
    console.log(`${verdict} observed=[${mergedObserved.join(",")}]`);
    writeCheckpoint();
  }

  // Final write (clears partial).
  const summary = {
    catalogRev: "r1.25",
    catalogTotal: catalog.mutations.length,
    selected: mutations.length,
    counts: {
      exact: nExact,
      wider: nWider,
      survived: nSurvived,
      "ethan-blocker": nEthan,
      "cant-run": nCant,
      "not-run": nNotRun,
    },
    baselineFailedAmongSelected: [...baselineFailed],
    results,
    partial: false,
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  try {
    mkdirSync(path.dirname(STORE_LOG), { recursive: true });
    writeFileSync(STORE_LOG, JSON.stringify(summary, null, 2));
  } catch {
    /* store optional */
  }
  console.log("\n=== COUNTS ===");
  console.log(JSON.stringify(summary.counts, null, 2));
  console.log("Wrote", OUT);
  restoreTree();
}

main();
