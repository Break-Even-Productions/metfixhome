/**
 * PR2 r1.24 — R13: real behavioral sabotages for auth survivors
 * (M60/M158/M83/M148/M85/M129/M89/M162/M139/M140/M-SU1) + M65 JWKS cache fix.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(path.join(REPO, rel), "utf8");
}
function write(rel, text) {
  writeFileSync(path.join(REPO, rel), text);
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

/** @type {Record<string, { apply: () => void, files: string[] }>} */
export const R13_OVERRIDES = {
  M60: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  if (!audOk(payload.aud, clientId)) return null;",
        "  // MUTANT M60: skip aud\n  void audOk; void (payload as { aud?: unknown }).aud;",
        "M60",
      );
    },
  },
  M158: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        `function audOk(aud: unknown, clientId: string): boolean {
  if (aud === clientId) return true;
  if (Array.isArray(aud) && aud.length === 1 && aud[0] === clientId) return true;
  return false;
}`,
        `function audOk(aud: unknown, clientId: string): boolean {
  if (aud === clientId) return true;
  // MUTANT M158: accept any aud array containing ours
  if (Array.isArray(aud) && aud.includes(clientId)) return true;
  return false;
}`,
        "M158",
      );
    },
  },
  M65: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  if (!forceNetwork) {\n    const cached = await readCachedJson<{ keys: GoogleJwk[] }>(cache, JWKS_CACHE_URL);\n    if (cached?.keys) return cached;\n  }",
        "  // MUTANT M65: no JWKS cache\n  void forceNetwork; void readCachedJson; void JWKS_CACHE_URL;",
        "M65",
      );
    },
  },
  M83: {
    files: ["worker/auth/comment-siteverify.ts", "worker/auth/signup.ts"],
    apply() {
      for (const [rel, label] of [
        ["worker/auth/comment-siteverify.ts", "M83a"],
        ["worker/auth/signup.ts", "M83b"],
      ]) {
        replaceOnce(
          rel,
          '    if (!res.ok) return "outage";',
          '    if (!res.ok) return "pass"; // MUTANT M83 fail-open',
          `${label}-ok`,
        );
        replaceOnce(
          rel,
          '  } catch {\n    return "outage";\n  }\n}',
          '  } catch {\n    return "pass"; // MUTANT M83 fail-open\n  }\n}',
          `${label}-catch`,
        );
      }
    },
  },
  M148: {
    files: ["worker/auth/signup.ts", "worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        '  if (sv === "outage") return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });',
        '  if (sv === "outage") return authJson(BODY_TRY_AGAIN, 403); // MUTANT M148',
        "M148-signup",
      );
      replaceOnce(
        "worker/comments.ts",
        '  if (sv === "outage") return unavailable();',
        '  if (sv === "outage") return jsonNoStore({ error: "try_again" }, 403); // MUTANT M148',
        "M148-comment",
      );
    },
  },
  M85: {
    files: ["worker/index.ts"],
    apply() {
      replaceOnce(
        "worker/index.ts",
        "  \"script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/\",",
        "  \"script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/\", // MUTANT M85",
        "M85",
      );
    },
  },
  M129: {
    files: ["worker/index.ts"],
    apply() {
      replaceOnce(
        "worker/index.ts",
        "  \"frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/\",",
        "  \"frame-src 'none'\", // MUTANT M129: drop frame-src reCAPTCHA entries",
        "M129",
      );
    },
  },
  M89: {
    files: ["client/src/lib/session.ts"],
    apply() {
      replaceOnce(
        "client/src/lib/session.ts",
        "function mapMe(payload: MeResponse): MeState {\n  if (payload.signed_in !== true) return { status: \"signed_out\" };",
        `function mapMe(payload: MeResponse): MeState {
  // MUTANT M89: store signed_in in localStorage
  try {
    localStorage.setItem("signed_in", payload.signed_in === true ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (payload.signed_in !== true) return { status: "signed_out" };`,
        "M89",
      );
    },
  },
  M162: {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "tools/pr2/gates/repo-scan.test.ts",
        `    const assertClean = (scopedHits: string[], repoHits: { rel: string; text: string; line: number }[]) => {
      if (scopedHits.length > 0) throw new Error(scopedHits[0]!);
      for (const h of repoHits) {
        const key = \`\${h.rel}\\0\${h.text}\`;
        if (!allow.has(key)) {
          throw new Error(\`SCAN FAIL: storage \${h.rel}:\${h.line}\`);
        }
      }
    };`,
        `    const assertClean = (scopedHits: string[], repoHits: { rel: string; text: string; line: number }[]) => {
      if (scopedHits.length > 0) throw new Error(scopedHits[0]!);
      // MUTANT M162: allowlist by line number only (removeItem("auth") at Home line passes)
      const allowLines = new Set([
        "client/src/const.ts:45",
        "client/src/pages/Home.tsx:490",
        "client/src/pages/Home.tsx:492",
        "client/src/contexts/ThemeContext.tsx:26",
        "client/src/contexts/ThemeContext.tsx:41",
        "client/src/components/ui/sidebar.tsx:85",
      ]);
      for (const h of repoHits) {
        if (!allowLines.has(\`\${h.rel}:\${h.line}\`)) {
          throw new Error(\`SCAN FAIL: storage \${h.rel}:\${h.line}\`);
        }
      }
    };`,
        "M162",
      );
    },
  },
  M139: {
    files: ["worker/do/login-throttle.ts", "worker/auth/throttle.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        '      if (request.method === "POST" && path === "/r8b/attempt") {\n        return this.r8bAttempt(now);\n      }',
        `      if (request.method === "POST" && path === "/r8b/attempt") {
        return this.r8bAttempt(now);
      }
      if (request.method === "POST" && path === "/r8b/undo") {
        // MUTANT M139 helper
        const times = ((await this.state.storage.get<number[]>("ip")) ?? []).filter(
          (t) => now - t < WINDOW_MS,
        );
        times.pop();
        await this.state.storage.put("ip", times);
        return json({ ok: true, count: times.length });
      }`,
        "M139-do",
      );
      replaceOnce(
        "worker/auth/throttle.ts",
        `export async function attemptR8b(
  env: Env,
  ip: string,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const data = await post(env, await r8bName(ip), "/r8b/attempt");
  if (!data.allowed) return { allowed: false, retryAfter: data.retryAfter ?? 1 };
  return { allowed: true };
}`,
        `export async function attemptR8b(
  env: Env,
  ip: string,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const data = await post(env, await r8bName(ip), "/r8b/attempt");
  if (!data.allowed) return { allowed: false, retryAfter: data.retryAfter ?? 1 };
  return { allowed: true };
}

/** MUTANT M139: undo last R8b attempt so recaptcha_failed is not counted. */
export async function undoR8b(env: Env, ip: string): Promise<void> {
  await post(env, await r8bName(ip), "/r8b/undo");
}`,
        "M139-throttle",
      );
      replaceOnce(
        "worker/auth/login.ts",
        "  attemptR8b,\n  checkR8a,\n  clearR8a,\n  clientIp,\n  failR8a,\n  reserveR8c,",
        "  attemptR8b,\n  checkR8a,\n  clearR8a,\n  clientIp,\n  failR8a,\n  reserveR8c,\n  undoR8b,",
        "M139-import",
      );
      replaceOnce(
        "worker/auth/login.ts",
        "  return await mapWebLoginOutcome(upstream, {\n      env,\n      identifier,\n      incomingSid: getSid(request),\n    });",
        "  return await mapWebLoginOutcome(upstream, {\n      env,\n      identifier,\n      incomingSid: getSid(request),\n      ip, // MUTANT M139\n    });",
        "M139-ctx",
      );
      replaceOnce(
        "worker/auth/login.ts",
        "  ctx: { env: Env; identifier: string; incomingSid: string | null },\n): Promise<Response> {\n  const { env, identifier, incomingSid } = ctx;",
        "  ctx: { env: Env; identifier: string; incomingSid: string | null; ip?: string },\n): Promise<Response> {\n  const { env, identifier, incomingSid, ip } = ctx;",
        "M139-ctx-type",
      );
      replaceOnce(
        "worker/auth/login.ts",
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    // MUTANT M139: BSI 403 recaptcha_failed not counted toward R8b
    if (ip) await undoR8b(env, ip);
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        "M139-login",
      );
    },
  },
  M140: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        `  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    // MUTANT M140: BSI 403 recaptcha_failed counted toward R8a
    await failR8a(env, identifier);
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        "M140",
      );
    },
  },
  "M-SU1": {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        'import { clientIp } from "./throttle";',
        'import { clientIp, reserveR8c } from "./throttle";',
        "M-SU1-import",
      );
      replaceOnce(
        "worker/auth/signup.ts",
        '  if (sv === "fail") return authJson(BODY_TRY_AGAIN, 403);',
        `  if (sv === "fail") {
    // MUTANT M-SU1: failed signup siteverify takes an R8c login:global slot
    await reserveR8c(env);
    return authJson(BODY_TRY_AGAIN, 403);
  }`,
        "M-SU1",
      );
    },
  },
};

export default R13_OVERRIDES;
