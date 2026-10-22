/**
 * PR2 r1.35 §M — M-DT11 (coalesced KV /me writes) and M-DT12 (non-grant Retry-After).
 *
 * M-DT11 red {AU7.6}: every coalesced caller writes KV /me
 *   (sabotage: make joiners also get refreshed:true / strip leader-only).
 * M-DT12 red {AU27.3, AU27.10}: non-grant 4xx codes pass upstream Retry-After
 *   instead of fixed 60.
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

/** Leader-only withRefreshLock (correct / post-CQ-B1). */
const WITH_REFRESH_LOCK_LEADER_ONLY = `  private async withRefreshLock(fn: () => Promise<Response>): Promise<Response> {
    const leader = !this.refreshInflight;
    if (!this.refreshInflight) {
      this.refreshInflight = this.state.blockConcurrencyWhile(fn).finally(() => {
        this.refreshInflight = null;
      });
    }
    const shared = await this.refreshInflight;
    if (leader) return shared.clone();
    // Leader-only KV /me write: joiners see refreshed:false (AU7.6).
    const clone = shared.clone();
    try {
      const body = (await clone.json()) as { refreshed?: boolean; [k: string]: unknown };
      if (body?.refreshed === true) body.refreshed = false;
      return json(body, shared.status);
    } catch {
      return shared.clone();
    }
  }`;

/** Mutant: every coalesced caller gets the leader body (refreshed:true). */
const WITH_REFRESH_LOCK_ALL_REFRESHED = `  private async withRefreshLock(fn: () => Promise<Response>): Promise<Response> {
    if (!this.refreshInflight) {
      this.refreshInflight = this.state.blockConcurrencyWhile(fn).finally(() => {
        this.refreshInflight = null;
      });
    }
    const shared = await this.refreshInflight;
    // MUTANT M-DT11: every coalesced caller gets refreshed:true (joiners write KV /me)
    const clone = shared.clone();
    try {
      const body = (await clone.json()) as { refreshed?: boolean; [k: string]: unknown };
      if (body && typeof body === "object") {
        body.refreshed = true;
        return json(body, shared.status);
      }
    } catch {
      /* non-JSON */
    }
    return shared.clone();
  }`;

/** Pre-fix simple lock (also a valid strip target once leader-only lands). */
const WITH_REFRESH_LOCK_SIMPLE = `  private async withRefreshLock(fn: () => Promise<Response>): Promise<Response> {
    if (!this.refreshInflight) {
      this.refreshInflight = this.state.blockConcurrencyWhile(fn).finally(() => {
        this.refreshInflight = null;
      });
    }
    const shared = await this.refreshInflight;
    return shared.clone();
  }`;

/** @type {Record<string, { apply?: () => void, typeCheck?: boolean, files?: string[], variants?: string[] }>} */
export const R17_OVERRIDES = {
  /**
   * r1.35 CQ B1: joiners also get refreshed:true / strip leader-only —
   * red {AU7.6}.
   */
  "M-DT11": {
    files: ["worker/do/session.ts", "worker/auth/session.ts"],
    apply() {
      const doSrc = read("worker/do/session.ts");
      if (doSrc.includes(WITH_REFRESH_LOCK_LEADER_ONLY)) {
        replaceOnce(
          "worker/do/session.ts",
          WITH_REFRESH_LOCK_LEADER_ONLY,
          WITH_REFRESH_LOCK_ALL_REFRESHED,
          "M-DT11-strip-leader",
        );
      } else if (doSrc.includes(WITH_REFRESH_LOCK_SIMPLE)) {
        // Pre-fix: force refreshed:true on every coalesced clone.
        replaceOnce(
          "worker/do/session.ts",
          WITH_REFRESH_LOCK_SIMPLE,
          WITH_REFRESH_LOCK_ALL_REFRESHED,
          "M-DT11-force-refreshed",
        );
      } else {
        throw new Error("M-DT11: withRefreshLock form not found in worker/do/session.ts");
      }
      replaceOnce(
        "worker/auth/session.ts",
        `  if (data.refreshed) await putMeCache(env, hex, data.record);
  return { hex, record: data.record };`,
        `  // MUTANT M-DT11: every coalesced caller writes KV /me
  await putMeCache(env, hex, data.record);
  return { hex, record: data.record };`,
        "M-DT11-auth-putMe",
      );
    },
  },

  /**
   * r1.35 CQ B2: non-grant 4xx pass upstream Retry-After instead of fixed 60 —
   * red {AU27.3, AU27.10}.
   */
  "M-DT12": {
    files: ["worker/auth/login.ts", "worker/auth/google.ts"],
    apply() {
      const loginSrc = read("worker/auth/login.ts");
      // Correct (fixed 60) → mutant (pass upstream).
      const loginFixed = `    if (status === 429 || status >= 500) {
      const ra = retryAfter ?? parseRetryAfter(null);
      return unavailable503(ra);
    }
    return unavailable503(60);`;
      const loginMutant = `    if (status === 429 || status >= 500) {
      const ra = retryAfter ?? parseRetryAfter(null);
      return unavailable503(ra);
    }
    // MUTANT M-DT12: non-grant 4xx pass upstream Retry-After
    return unavailable503(retryAfter ?? parseRetryAfter(null));`;
      const loginBuggy = `    if (
      code === "invalid_client" ||
      code === "unauthorized_client" ||
      code === "unsupported_grant_type" ||
      code === "invalid_request"
    ) {
      return unavailable503(retryAfter ?? parseRetryAfter(null));
    }
    return unavailable503(retryAfter ?? parseRetryAfter(null));`;
      const loginBuggyMarked = `    if (
      code === "invalid_client" ||
      code === "unauthorized_client" ||
      code === "unsupported_grant_type" ||
      code === "invalid_request"
    ) {
      // MUTANT M-DT12: non-grant 4xx pass upstream Retry-After
      return unavailable503(retryAfter ?? parseRetryAfter(null));
    }
    // MUTANT M-DT12: unknown non-grant 4xx also pass upstream Retry-After
    return unavailable503(retryAfter ?? parseRetryAfter(null));`;

      if (loginSrc.includes(loginFixed)) {
        replaceOnce("worker/auth/login.ts", loginFixed, loginMutant, "M-DT12-login-fixed");
      } else if (loginSrc.includes(loginBuggy)) {
        // Pre-fix product already has the mutant behaviour — mark it in place.
        replaceOnce("worker/auth/login.ts", loginBuggy, loginBuggyMarked, "M-DT12-login-buggy");
      } else {
        throw new Error("M-DT12: login non-grant Retry-After form not found");
      }

      const googleSrc = read("worker/auth/google.ts");
      const googleFixed = `  if (exchanged.kind !== "ok") {
    if (
      exchanged.kind === "http" &&
      (exchanged.status === 429 || exchanged.status >= 500)
    ) {
      const ra = exchanged.retryAfter ?? parseRetryAfter(null);
      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": String(ra) });
    }
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "60" });
  }`;
      const googleMutant = `  if (exchanged.kind !== "ok") {
    // MUTANT M-DT12: non-grant 4xx pass upstream Retry-After
    const ra =
      exchanged.kind === "http" || exchanged.kind === "bad_json"
        ? (exchanged.retryAfter ?? parseRetryAfter(null))
        : parseRetryAfter(null);
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": String(ra) });
  }`;
      const googleBuggy = `  if (exchanged.kind !== "ok") {
    const ra =
      exchanged.kind === "http" || exchanged.kind === "bad_json"
        ? (exchanged.retryAfter ?? parseRetryAfter(null))
        : parseRetryAfter(null);
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": String(ra) });
  }`;
      const googleBuggyMarked = `  if (exchanged.kind !== "ok") {
    // MUTANT M-DT12: non-grant 4xx pass upstream Retry-After
    const ra =
      exchanged.kind === "http" || exchanged.kind === "bad_json"
        ? (exchanged.retryAfter ?? parseRetryAfter(null))
        : parseRetryAfter(null);
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": String(ra) });
  }`;

      if (googleSrc.includes(googleFixed)) {
        replaceOnce("worker/auth/google.ts", googleFixed, googleMutant, "M-DT12-google-fixed");
      } else if (googleSrc.includes(googleBuggy)) {
        replaceOnce("worker/auth/google.ts", googleBuggy, googleBuggyMarked, "M-DT12-google-buggy");
      } else {
        throw new Error("M-DT12: google non-grant Retry-After form not found");
      }
    },
  },
};
