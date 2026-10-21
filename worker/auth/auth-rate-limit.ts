/**
 * Auth route rate limits (S-RL / R16) — Rate Limiting binding with counter fallback.
 * Buckets: signup 5/60s/IP, username-check 20/60s/IP, Google 20/60s/IP.
 */

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type AuthLimitEnv = {
  SIGNUP_LIMITER?: RateLimitBinding;
  USERNAME_CHECK_LIMITER?: RateLimitBinding;
  GOOGLE_AUTH_LIMITER?: RateLimitBinding;
};

const signupWindows = new Map<string, number[]>();
const usernameWindows = new Map<string, number[]>();
const googleWindows = new Map<string, number[]>();

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

function syncWindow(map: Map<string, number[]>, key: string, max: number): boolean {
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

async function limitWithBinding(
  binding: RateLimitBinding | undefined,
  key: string,
  fallback: () => boolean,
): Promise<boolean> {
  if (binding) {
    const r = await binding.limit({ key });
    return r.success === true;
  }
  return fallback();
}

export function resetAuthLimiters(): void {
  signupWindows.clear();
  usernameWindows.clear();
  googleWindows.clear();
  chain = Promise.resolve();
}

export async function checkSignupLimit(
  env: AuthLimitEnv,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await queued(() =>
    limitWithBinding(env.SIGNUP_LIMITER, ip, () => syncWindow(signupWindows, ip, 5)),
  );
  return ok ? { allowed: true } : { allowed: false };
}

export async function checkUsernameLimit(
  env: AuthLimitEnv,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await queued(() =>
    limitWithBinding(env.USERNAME_CHECK_LIMITER, ip, () =>
      syncWindow(usernameWindows, ip, 20),
    ),
  );
  return ok ? { allowed: true } : { allowed: false };
}

export async function checkGoogleLimit(
  env: AuthLimitEnv,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await queued(() =>
    limitWithBinding(env.GOOGLE_AUTH_LIMITER, ip, () => syncWindow(googleWindows, ip, 20)),
  );
  return ok ? { allowed: true } : { allowed: false };
}
