/**
 * PR2 r1.25 §M — M-RA7, M-CW34, M-CW35, M-JL1d.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** @type {Record<string, { apply: () => void, files: string[], variants?: string[], typeCheck?: boolean }>} */
export const R14_OVERRIDES = {
  "M-RA7a": {
    files: ["worker/upstream.ts"],
    apply() {
      // Leading-zero all-digit value treated as non-numeric → 60 (`0` alone still → 1).
      replaceOnce(
        "worker/upstream.ts",
        `  if (!/^[0-9]+$/.test(header)) return 60 as RetryAfterSeconds;
  // Strip leading zeros before length guard (CQ r2): "0000017"→"17", "0000000"→"0".
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;`,
        `  if (!/^[0-9]+$/.test(header)) return 60 as RetryAfterSeconds;
  // MUTANT M-RA7a: leading zero + length > 1 → treat as non-numeric → 60
  if (header.length > 1 && header.startsWith("0")) return 60 as RetryAfterSeconds;
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;`,
        "M-RA7a",
      );
    },
  },
  "M-RA7b": {
    files: ["worker/upstream.ts"],
    apply() {
      // Parse as octal: 0000017 → 15.
      replaceOnce(
        "worker/upstream.ts",
        `  // Strip leading zeros before length guard (CQ r2): "0000017"→"17", "0000000"→"0".
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;
  // 7+ significant digits cannot be in 1..600; avoid Number() on huge strings (M-RA4).
  if (digits.length >= 7) return 600 as RetryAfterSeconds;
  const n = Number(digits);`,
        `  // MUTANT M-RA7b: octal parse (0000017 → 15)
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;
  if (digits.length >= 7) return 600 as RetryAfterSeconds;
  const n = header.length > 1 && header.startsWith("0")
    ? Number.parseInt(header, 8)
    : Number(digits);`,
        "M-RA7b",
      );
    },
  },
  "M-RA7": {
    files: ["worker/upstream.ts"],
    variants: ["M-RA7a", "M-RA7b"],
    apply() {
      throw new Error("M-RA7: use variants M-RA7a/b via runner");
    },
  },
  "M-CW34": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      // After 204 delete, skip the list refetch (remove the row locally only).
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `      if (res.status === 204) {
        // CW16.3: one cache-bypassing fresh list GET; no client cache purge (CW16.2b).
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
        return;
      }`,
        `      if (res.status === 204) {
        // MUTANT M-CW34: skip refetch after 204 — local remove only
        onCommentsChanged?.(patchComments(load, comment.id, comment.pillar, null));
        return;
      }`,
        "M-CW34",
      );
    },
  },
  "M-CW35": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      // Refetch without cache bypass (stale Map / default cache mode).
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `      if (res.status === 204) {
        // CW16.3: one cache-bypassing fresh list GET; no client cache purge (CW16.2b).
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
        return;
      }`,
        `      if (res.status === 204) {
        // MUTANT M-CW35: refetch without cache bypass
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: false });
        onCommentsChanged?.(refetched);
        return;
      }`,
        "M-CW35",
      );
    },
  },
  "M-JL1d": {
    files: ["client/public/x/index.html"],
    apply() {
      const rel = "client/public/x/index.html";
      const abs = path.join(REPO, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      write(
        rel,
        `<!doctype html><html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Thing","name":"x"}</script></body></html>\n`,
      );
    },
  },
  "M-JL1": {
    files: ["client/index.html", "client/public/x/index.html"],
    variants: ["M-JL1a", "M-JL1b", "M-JL1c", "M-JL1d"],
    apply() {
      throw new Error("M-JL1: use variants M-JL1a/b/c/d via runner");
    },
  },
  /** Absolute BFF URL in comments.ts — red {C1.1, C5.1, C5.2}. */
  M96: {
    files: ["client/src/pages/the-daily-fix/comments.ts"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/comments.ts",
        "  return `/api/daily-fix/comments?${params.toString()}`;",
        "  return `https://metfix-bff.wispy-mode-982d.workers.dev/api/daily-fix/comments?${params.toString()}`; // MUTANT M96",
        "M96",
      );
    },
  },
  /** Skip header gate-count compare in ck-p1.mjs (pin only) — red {CK-P1}. */
  "M-CK1": {
    files: ["tools/pr2/ck-p1.mjs"],
    apply() {
      replaceOnce(
        "tools/pr2/ck-p1.mjs",
        "if (gateIds.length !== headerCount) fail(qaPath);",
        "// MUTANT M-CK1: skip header gate-count compare (pin compare only)",
        "M-CK1",
      );
    },
  },

  /** r1.29: reply control on replies (client) — overrides R5 worker mapping. */
  "M-CW20": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `              {loggedIn &&
              comment.deleted === 0 &&
              (comment.parent_id == null || comment.parent_id === 0) ? (`,
        `              {/* MUTANT M-CW20: reply control on replies */}
              {loggedIn && comment.deleted === 0 ? (`,
        "M-CW20",
      );
    },
  },

  /** r1.29: siteverify before write limiter — red {P1.1, P8.2}. */
  "M-P1O1": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  const ip = clientIp(request);
  const limited = await checkCommentWriteLimit(env as CommentLimitEnv, ctx.record.bsi_user_id, ip);
  if (!limited.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }

  const recaptchaFail = await verifyCommentRecaptcha(body.recaptcha, env, fetchImpl);
  if (recaptchaFail) return recaptchaFail;

  const upstreamBody: {
    date: string;
    type: string;
    content: string;
    parent_comment_id?: number;
  } = { date, type, content };
  if (parent !== undefined) upstreamBody.parent_comment_id = parent;

  const ran = await runUserBsiCall(ctx, env, fetchImpl, opts, (access) =>
    bsiPostComment(upstreamBody, access, env, fetchImpl, opts),
  );`,
        `  // MUTANT M-P1O1: siteverify before write limiter
  const recaptchaFail = await verifyCommentRecaptcha(body.recaptcha, env, fetchImpl);
  if (recaptchaFail) return recaptchaFail;

  const ip = clientIp(request);
  const limited = await checkCommentWriteLimit(env as CommentLimitEnv, ctx.record.bsi_user_id, ip);
  if (!limited.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }

  const upstreamBody: {
    date: string;
    type: string;
    content: string;
    parent_comment_id?: number;
  } = { date, type, content };
  if (parent !== undefined) upstreamBody.parent_comment_id = parent;

  const ran = await runUserBsiCall(ctx, env, fetchImpl, opts, (access) =>
    bsiPostComment(upstreamBody, access, env, fetchImpl, opts),
  );`,
        "M-P1O1",
      );
    },
  },

  /** r1.29: logged-out POST/like burn like+toggle limiters before 401 — red {P4.1}. */
  "M-P4L1": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `async function handleCommentPost(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; cache?: Cache },
): Promise<Response> {
  const ctx = await requireSession(request, env, fetchImpl, opts);
  if (ctx instanceof Response) return ctx;`,
        `async function handleCommentPost(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; cache?: Cache },
): Promise<Response> {
  // MUTANT M-P4L1: burn like/toggle limiters before session 401
  {
    const ip = clientIp(request);
    await checkCommentLikeLimit(env as CommentLimitEnv, "anon", ip);
    await checkCommentLikeToggleLimit(env as CommentLimitEnv, "anon", "0");
  }
  const ctx = await requireSession(request, env, fetchImpl, opts);
  if (ctx instanceof Response) return ctx;`,
        "M-P4L1-post",
      );
      replaceOnce(
        "worker/comments.ts",
        `async function handleCommentLike(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;`,
        `async function handleCommentLike(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  // MUTANT M-P4L1: burn like/toggle limiters before session 401
  {
    const ip = clientIp(request);
    await checkCommentLikeLimit(env as CommentLimitEnv, "anon", ip);
    await checkCommentLikeToggleLimit(env as CommentLimitEnv, "anon", id);
  }
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;`,
        "M-P4L1-like",
      );
    },
  },

  /** r1.29: extra TODAY comments GET on mount — red {C6.2}. */
  "M-C62": {
    files: ["client/src/pages/the-daily-fix/TheDailyFixPage.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/TheDailyFixPage.tsx",
        `  useEffect(() => {
    if (!commentIso) {
      setCommentsLoad({ status: "unavailable" });
      return;
    }
    const controller = new AbortController();
    setCommentsLoad({ status: "loading" });
    void fetchDailyFixComments(commentIso, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setCommentsLoad(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCommentsLoad({ status: "unavailable" });
      });
    return () => controller.abort();
  }, [commentIso]);`,
        `  useEffect(() => {
    if (!commentIso) {
      setCommentsLoad({ status: "unavailable" });
      return;
    }
    const controller = new AbortController();
    setCommentsLoad({ status: "loading" });
    void fetchDailyFixComments(commentIso, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setCommentsLoad(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCommentsLoad({ status: "unavailable" });
      });
    // MUTANT M-C62: also fetch comments for TODAY
    if (commentIso !== todayIso) {
      void fetchDailyFixComments(todayIso, controller.signal).catch(() => {});
    }
    return () => controller.abort();
  }, [commentIso, todayIso]);`,
        "M-C62",
      );
    },
  },

  /** Fix M30 needle for parseRetryAfter Retry-After — red {P8.2}. */
  M30: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        `  if (!ctx.access) return unavailable();
  const csrf = await requireCsrf(request, env, ctx.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "";
  const type = typeof body.type === "string" ? body.type : "";
  const content = validateContent(body.content);
  const parent = validateParentId(body.parent_comment_id);
  if (
    !isIsoDate(date) ||
    !isCommentType(type) ||
    type === "all" ||
    content == null ||
    parent === "bad"
  ) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  const ip = clientIp(request);
  const limited = await checkCommentWriteLimit(env as CommentLimitEnv, ctx.record.bsi_user_id, ip);
  if (!limited.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }`,
        `  if (!ctx.access) return unavailable();

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "";
  const type = typeof body.type === "string" ? body.type : "";
  const content = validateContent(body.content);
  const parent = validateParentId(body.parent_comment_id);
  if (
    !isIsoDate(date) ||
    !isCommentType(type) ||
    type === "all" ||
    content == null ||
    parent === "bad"
  ) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  // MUTANT M30: limiter before CSRF
  const ip = clientIp(request);
  const limited = await checkCommentWriteLimit(env as CommentLimitEnv, ctx.record.bsi_user_id, ip);
  if (!limited.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }
  const csrf = await requireCsrf(request, env, ctx.sid);
  if (csrf) return csrf;`,
        "M30",
      );
    },
  },

  /** Fix M-P1a needle for CT-P1 refetch shape — red {CT-P1}. */
  "M-P1a": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `      // CT-P1: one refetch, no auto-retry of POST.
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      onCommentsChanged?.(refetched);
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } catch {
      // CT-P1 (c)(d): network/sync throw → one bypass GET, no second POST.
      invalidateCommentsCache(dateIso);
      try {
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
      } catch {
        /* message still shown */
      }
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } finally {
      setPosting(false);
    }`,
        `      // MUTANT M-P1a: immediately re-POST once on 503/malformed 201/network error
      if (!(globalThis as unknown as { __mP1a?: boolean }).__mP1a) {
        (globalThis as unknown as { __mP1a?: boolean }).__mP1a = true;
        await postComment(parent);
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
        await postComment(parent);
        return;
      }
      // CT-P1 (c)(d): network/sync throw → one bypass GET, no second POST.
      invalidateCommentsCache(dateIso);
      try {
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
      } catch {
        /* message still shown */
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
};

export default R14_OVERRIDES;
