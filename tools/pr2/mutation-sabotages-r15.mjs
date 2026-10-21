/**
 * PR2 r1.31 §M — M137, M-DT3, M-DT6, M95 retargeted to /oauth/token.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");

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

/** @type {Record<string, { apply?: () => void, typeCheck?: boolean, files?: string[], variants?: string[] }>} */
export const R15_OVERRIDES = {
  /** r1.31: R8c before siteverify — red {AU17.9, AU27.4}. */
  M137: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `    if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
      return authJson(BODY_TRY_AGAIN, 403);
    }
    const recaptchaToken = body.recaptcha;

    const sv = await siteverifyLogin(recaptchaToken, cfg.recaptchaSecret, fetchImpl);
    if (sv === "fail") {
      return authJson(BODY_TRY_AGAIN, 403);
    }
    if (sv === "outage") {
      return unavailable503(60);
    }

    const r8c = await reserveR8c(env);
    if (!r8c.allowed) {
      return authJson(BODY_RATE_LIMITED, 429, {
        "Retry-After": String(r8c.retryAfter),
      });
    }`,
        `    if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
      return authJson(BODY_TRY_AGAIN, 403);
    }
    const recaptchaToken = body.recaptcha;

    // MUTANT M137: take R8c slot before siteverify
    const r8c = await reserveR8c(env);
    if (!r8c.allowed) {
      return authJson(BODY_RATE_LIMITED, 429, {
        "Retry-After": String(r8c.retryAfter),
      });
    }

    const sv = await siteverifyLogin(recaptchaToken, cfg.recaptchaSecret, fetchImpl);
    if (sv === "fail") {
      return authJson(BODY_TRY_AGAIN, 403);
    }
    if (sv === "outage") {
      return unavailable503(60);
    }`,
        "M137",
      );
    },
  },

  /** r1.31: trust token user_id over /me.id — red {AU27.2}. */
  "M-DT3": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  const profile = parseBsiMeProfile(meRes.json);
  if (!profile) {
    return unavailable503(60);
  }

  if (incomingSid) {
    try {
      await destroySession(env, incomingSid);
    } catch {
      /* ignore */
    }
  }
  const newSid = randomId32();
  await createSession(env, newSid, {
    access_token: tok.access_token,
    refresh_token: refreshToken,
    expires_in: tok.expires_in,
    public_name: profile.display_name,
    user_id: profile.id,
    can_moderate: profile.can_moderate,
  });`,
        `  const profile = parseBsiMeProfile(meRes.json);
  if (!profile) {
    return unavailable503(60);
  }

  // MUTANT M-DT3: prefer token JSON user_id when present
  const tokenUserId =
    typeof tok.user_id === "number" || typeof tok.user_id === "string"
      ? tok.user_id
      : profile.id;

  if (incomingSid) {
    try {
      await destroySession(env, incomingSid);
    } catch {
      /* ignore */
    }
  }
  const newSid = randomId32();
  await createSession(env, newSid, {
    access_token: tok.access_token,
    refresh_token: refreshToken,
    expires_in: tok.expires_in,
    public_name: profile.display_name,
    user_id: tokenUserId,
    can_moderate: profile.can_moderate,
  });`,
        "M-DT3",
      );
    },
  },

  /** r1.31: log form body on token error — red {AU20.1, AU27.6}. */
  "M-DT6": {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        `    if (response.ok) {
      return { kind: "ok", status: response.status, json, bodyText, retryAfter };
    }
    const oauthErr = readOAuthError(json);
    const bsiCode = readBsiCode(json);
    return {
      kind: "http",
      status: response.status,
      json,
      bodyText,
      code: oauthErr ?? bsiCode,
      retryAfter,
    };`,
        `    if (response.ok) {
      return { kind: "ok", status: response.status, json, bodyText, retryAfter };
    }
    // MUTANT M-DT6: log form request body on token error
    console.error("token failed", body.toString());
    const oauthErr = readOAuthError(json);
    const bsiCode = readBsiCode(json);
    return {
      kind: "http",
      status: response.status,
      json,
      bodyText,
      code: oauthErr ?? bsiCode,
      retryAfter,
    };`,
        "M-DT6",
      );
    },
  },

  /** r1.31: forward CF-Connecting-IP on /oauth/token — red {AU27.1}. */
  M95: {
    files: ["worker/upstream.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        `async function oauthTokenFetch(
  url: string,
  body: URLSearchParams,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<BsiHttpResult> {
  try {
    assertBsiHost(url);
  } catch {
    return { kind: "throw" };
  }
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: oauthFormHeaders(),
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });`,
        `async function oauthTokenFetch(
  url: string,
  body: URLSearchParams,
  fetchImpl: FetchImpl,
  timeoutMs: number,
  opts?: { forwardIp?: string },
): Promise<BsiHttpResult> {
  try {
    assertBsiHost(url);
  } catch {
    return { kind: "throw" };
  }
  try {
    const headers = oauthFormHeaders();
    if (opts?.forwardIp) headers["CF-Connecting-IP"] = opts.forwardIp; // MUTANT M95
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });`,
        "M95-fetch",
      );
      replaceOnce(
        "worker/upstream.ts",
        `  return oauthTokenFetch(url, form, fetchImpl, opts?.timeoutMs ?? 5000);
}

/** Pro OAuth: POST {origin}/oauth/token, grant_type=refresh_token (§0u.3). */`,
        `  return oauthTokenFetch(url, form, fetchImpl, opts?.timeoutMs ?? 5000, {
    forwardIp: opts?.forwardIp,
  });
}

/** Pro OAuth: POST {origin}/oauth/token, grant_type=refresh_token (§0u.3). */`,
        "M95-password",
      );
      replaceOnce(
        "worker/upstream.ts",
        `export async function oauthPasswordGrant(
  body: { username: string; password: string },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {`,
        `export async function oauthPasswordGrant(
  body: { username: string; password: string },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number; forwardIp?: string },
): Promise<BsiHttpResult> {`,
        "M95-sig",
      );
      replaceOnce(
        "worker/auth/login.ts",
        `    const tokenRes = await oauthPasswordGrant(
      { username: identifier, password },
      env,
      fetchImpl,
      { baseUrl, timeoutMs: 5000 },
    );`,
        `    const tokenRes = await oauthPasswordGrant(
      { username: identifier, password },
      env,
      fetchImpl,
      { baseUrl, timeoutMs: 5000, forwardIp: clientIp(request) }, // MUTANT M95
    );`,
        "M95-login",
      );
    },
  },

  /** r1.31: keep old can_moderate on refresh — red {CW12.3}. */
  "M-CW32": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        `    record.user_public_name = profile.display_name;
    record.bsi_user_id = String(profile.id);
    record.can_moderate = profile.can_moderate;
    await this.put(aad, record);
    return json({ status: "ok", record, refreshed: true });
  }`,
        `    record.user_public_name = profile.display_name;
    record.bsi_user_id = String(profile.id);
    // MUTANT M-CW32: keep old can_moderate on refresh
    void profile.can_moderate;
    await this.put(aad, record);
    return json({ status: "ok", record, refreshed: true });
  }`,
        "M-CW32",
      );
    },
  },

  /** r1.31: globalThis.fetch bait on /oauth/token — red {AU26.8}. */
  "M-WL14b": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;

  try {
    const cfg = requireAuthConfig(env, {`,
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  // MUTANT M-WL14b scan bait
  if (false) void globalThis.fetch(\`\${baseUrl}/oauth/token\`);

  try {
    const cfg = requireAuthConfig(env, {`,
        "M-WL14b",
      );
    },
  },
};

export default R15_OVERRIDES;
