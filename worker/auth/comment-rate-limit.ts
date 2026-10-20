/**
 * Comment write/like rate limits (P8, CW6) — Rate Limiting binding with counter fallback.
 * Keys: write/like `${userId}:${ip}`; per-comment toggle `${userId}:${commentId}`.
 */

export type CommentLimiterOp = "write" | "like" | "toggle";

export type CommentLimiterCall = { key: string; op: CommentLimiterOp };

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type CommentLimitEnv = {
  COMMENT_WRITE_LIMITER?: RateLimitBinding;
  COMMENT_LIKE_LIMITER?: RateLimitBinding;
  COMMENT_LIKE_TOGGLE_LIMITER?: RateLimitBinding;
};

const calls: CommentLimiterCall[] = [];
const writeWindows = new Map<string, number[]>();
const likeWindows = new Map<string, number[]>();
const toggleWindows = new Map<string, number[]>();

let chain = Promise.resolve();

function prune(times: number[], now: number): number[] {
  return times.filter((t) => now - t < 60_000);
}

async function queued<T>(fn: () => T | Promise<T>): Promise<T> {
  let result!: T;
  chain = chain.then(async () => {
    result = await fn();
  });
  await chain;
  return result;
}

function syncWindow(
  map: Map<string, number[]>,
  key: string,
  max: number,
  op: CommentLimiterOp,
): boolean {
  calls.push({ key, op });
  const now = Date.now();
  const w = prune(map.get(key) ?? [], now);
  if (w.length >= max) {
    map.set(key, w);
    return false;
  }
  w.push(now);
  map.set(key, w);
  return true;
}

export function resetCommentLimiters(): void {
  calls.length = 0;
  writeWindows.clear();
  likeWindows.clear();
  toggleWindows.clear();
  chain = Promise.resolve();
}

export function getLimiterCalls(): CommentLimiterCall[] {
  return [...calls];
}

async function limitWithBinding(
  binding: RateLimitBinding | undefined,
  key: string,
  op: CommentLimiterOp,
  fallback: () => boolean,
): Promise<boolean> {
  if (binding) {
    calls.push({ key, op });
    const r = await binding.limit({ key });
    return r.success === true;
  }
  return fallback();
}

/** POST/PATCH/DELETE: 5 per 60 s per `${userId}:${ip}`. */
export async function checkCommentWriteLimit(
  env: CommentLimitEnv,
  userId: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const key = `${userId}:${ip}`;
  const ok = await queued(() =>
    limitWithBinding(env.COMMENT_WRITE_LIMITER, key, "write", () =>
      syncWindow(writeWindows, key, 5, "write"),
    ),
  );
  return ok ? { allowed: true } : { allowed: false };
}

/** Likes: 30 per 60 s per `${userId}:${ip}`. */
export async function checkCommentLikeLimit(
  env: CommentLimitEnv,
  userId: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const key = `${userId}:${ip}`;
  const ok = await queued(() =>
    limitWithBinding(env.COMMENT_LIKE_LIMITER, key, "like", () =>
      syncWindow(likeWindows, key, 30, "like"),
    ),
  );
  return ok ? { allowed: true } : { allowed: false };
}

/** Per-comment toggles: 4 per 60 s per `${userId}:${commentId}` (5th → 429). */
export async function checkCommentLikeToggleLimit(
  env: CommentLimitEnv,
  userId: string,
  commentId: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const key = `${userId}:${commentId}`;
  const ok = await queued(() =>
    limitWithBinding(env.COMMENT_LIKE_TOGGLE_LIMITER, key, "toggle", () =>
      syncWindow(toggleWindows, key, 4, "toggle"),
    ),
  );
  return ok ? { allowed: true } : { allowed: false };
}
