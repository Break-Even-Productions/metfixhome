/**
 * Auth route rate limits (S-RL / R16) — Rate Limiting binding only.
 * Buckets: signup 5/60s/IP, username-check 20/60s/IP, Google 20/60s/IP.
 * Missing binding → fail closed (no in-memory fallback).
 */

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type AuthLimitEnv = {
  SIGNUP_LIMITER?: RateLimitBinding;
  USERNAME_CHECK_LIMITER?: RateLimitBinding;
  GOOGLE_AUTH_LIMITER?: RateLimitBinding;
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

export async function checkSignupLimit(
  env: AuthLimitEnv,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await limitOrDeny(env.SIGNUP_LIMITER, `signup:${ip}`);
  return ok ? { allowed: true } : { allowed: false };
}

export async function checkUsernameLimit(
  env: AuthLimitEnv,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await limitOrDeny(env.USERNAME_CHECK_LIMITER, `username:${ip}`);
  return ok ? { allowed: true } : { allowed: false };
}

export async function checkGoogleLimit(
  env: AuthLimitEnv,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await limitOrDeny(env.GOOGLE_AUTH_LIMITER, `google:${ip}`);
  return ok ? { allowed: true } : { allowed: false };
}
