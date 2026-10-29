import {
  isLocalAuthEnabled,
  LOCAL_AUTH_HOSTS,
  type LocalAuthEnv,
} from "../dev-auth";
import type { Env } from "../upstream";

/** AUTH-HOST: auth and write routes only on exact Host metfix.org (AU25.1). */
export const AUTH_HOST = "metfix.org";

/** Single declaration of STAGING_AUTH_HOSTS lives on Env; pick it here. */
export type AuthHostEnv = LocalAuthEnv & Pick<Env, "STAGING_AUTH_HOSTS">;

/** Module-level cache: raw env string → parsed exact host Set. */
let cachedRaw: string | undefined;
let cachedHosts: ReadonlySet<string> = new Set();
/** Log rejected entries once per distinct raw value. */
let loggedRaw: string | undefined;

/**
 * Normalize a Host header value or URL hostname to a bare lowercase hostname:
 * strip port and trailing dots. Shared by Host and Origin checks (S1).
 */
export function normalizeHost(hostOrHostname: string): string {
  const raw = hostOrHostname.trim();
  if (!raw) return "";
  try {
    const withScheme = raw.includes("://") ? raw : `http://${raw}`;
    const u = new URL(withScheme);
    return u.hostname.replace(/\.+$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function parseStagingAuthHostsRaw(raw: string): {
  hosts: ReadonlySet<string>;
  rejected: string[];
} {
  if (raw.length === 0) return { hosts: new Set(), rejected: [] };
  const hosts = new Set<string>();
  const rejected: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue; // "" / " , " → empty allowlist, not a reject log
    // Exact hostnames only — no wildcards, URLs, or host:port tokens in the var.
    if (trimmed.includes("*") || trimmed.includes("/") || trimmed.includes(":")) {
      rejected.push(trimmed);
      continue;
    }
    const h = normalizeHost(trimmed);
    if (!h) {
      rejected.push(trimmed);
      continue;
    }
    hosts.add(h);
  }
  return { hosts, rejected };
}

/**
 * Cached Set of exact staging auth hostnames from STAGING_AUTH_HOSTS.
 * Keyed on the raw env string (B1).
 */
export function stagingAuthHostsSet(env?: AuthHostEnv): ReadonlySet<string> {
  const raw = typeof env?.STAGING_AUTH_HOSTS === "string" ? env.STAGING_AUTH_HOSTS : "";
  if (raw === cachedRaw) return cachedHosts;
  const { hosts, rejected } = parseStagingAuthHostsRaw(raw);
  cachedRaw = raw;
  cachedHosts = hosts;
  if (rejected.length > 0 && loggedRaw !== raw) {
    loggedRaw = raw;
    console.warn(`[auth] STAGING_AUTH_HOSTS rejected entries: ${rejected.join(", ")}`);
  }
  return cachedHosts;
}

/** Parse STAGING_AUTH_HOSTS into exact bare hostnames (array view of the cached Set). */
export function parseStagingAuthHosts(env?: AuthHostEnv): string[] {
  return [...stagingAuthHostsSet(env)];
}

/** Exact hostname match against STAGING_AUTH_HOSTS (no suffix / wildcard). */
export function isStagingAuthHost(bareHost: string, env?: AuthHostEnv): boolean {
  const bare = normalizeHost(bareHost);
  if (!bare) return false;
  return stagingAuthHostsSet(env).has(bare);
}

/**
 * Production: only metfix.org.
 * Staging preview: exact hosts listed in STAGING_AUTH_HOSTS (env-driven).
 * Local: when env.LOCAL_AUTH is set, also localhost / 127.0.0.1 (never other hosts).
 */
export function isAuthHost(request: Request, env?: AuthHostEnv): boolean {
  const host = request.headers.get("Host") ?? new URL(request.url).host;
  const bare = normalizeHost(host);
  if (!bare) return false;
  if (bare === AUTH_HOST) return true;
  if (isStagingAuthHost(bare, env)) return true;
  if (isLocalAuthEnabled(env) && (LOCAL_AUTH_HOSTS as readonly string[]).includes(bare)) {
    return true;
  }
  return false;
}

/**
 * siteverify hostname: metfix.org, or an exact STAGING_AUTH_HOSTS entry when set.
 * Production (no STAGING_AUTH_HOSTS) stays metfix.org-only.
 */
export function isAllowedRecaptchaHostname(
  hostname: unknown,
  env?: AuthHostEnv,
): boolean {
  if (typeof hostname !== "string") return false;
  const bare = normalizeHost(hostname);
  if (!bare) return false;
  if (bare === AUTH_HOST) return true;
  return isStagingAuthHost(bare, env);
}
