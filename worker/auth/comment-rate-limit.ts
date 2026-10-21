/**
 * Comment write/like rate limits (P8, CW6) — Rate Limiting binding only.
 * Keys: write/like `${userId}:${ip}`; per-comment toggle `${userId}:${commentId}`.
 * Missing binding → fail closed (no in-memory fallback).
 */

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type CommentLimitEnv = {
  COMMENT_WRITE_LIMITER?: RateLimitBinding;
  COMMENT_LIKE_LIMITER?: RateLimitBinding;
  COMMENT_LIKE_TOGGLE_LIMITER?: RateLimitBinding;
};

/** Per-key chains so one rejection cannot poison other keys / users. */
const keyChains = new Map<string, Promise<unknown>>();

async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = keyChains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const next = prev.then(
    () => gate,
    () => gate,
  );
  keyChains.set(key, next);
  await prev.then(
    () => undefined,
    () => undefined,
  );
  try {
    return await fn();
  } finally {
    release();
    if (keyChains.get(key) === next) keyChains.delete(key);
  }
}

async function limitOrDeny(
  binding: RateLimitBinding | undefined,
  key: string,
): Promise<boolean> {
  if (!binding) return false;
  return withKeyLock(key, async () => {
    const r = await binding.limit({ key });
    return r.success === true;
  });
}

/** POST/PATCH/DELETE: 5 per 60 s per `${userId}:${ip}`. */
export async function checkCommentWriteLimit(
  env: CommentLimitEnv,
  userId: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const key = `${userId}:${ip}`;
  const ok = await limitOrDeny(env.COMMENT_WRITE_LIMITER, `write:${key}`);
  return ok ? { allowed: true } : { allowed: false };
}

/** Likes: 30 per 60 s per `${userId}:${ip}`. */
export async function checkCommentLikeLimit(
  env: CommentLimitEnv,
  userId: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const key = `${userId}:${ip}`;
  const ok = await limitOrDeny(env.COMMENT_LIKE_LIMITER, `like:${key}`);
  return ok ? { allowed: true } : { allowed: false };
}

/** Per-comment toggles: 4 per 60 s per `${userId}:${commentId}` (5th → 429). */
export async function checkCommentLikeToggleLimit(
  env: CommentLimitEnv,
  userId: string,
  commentId: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const key = `${userId}:${commentId}`;
  const ok = await limitOrDeny(env.COMMENT_LIKE_TOGGLE_LIMITER, `toggle:${key}`);
  return ok ? { allowed: true } : { allowed: false };
}
